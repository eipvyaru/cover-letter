import {describe,expect,it} from 'vitest';
import {chooseCanonicalContacts,extractResumeContacts,normalizeAndAppendSignature,validateFinalLetterContacts,withoutLLMContactWarnings} from '@/server/services/contacts';
import {QUALITY_CHECK_SYSTEM_PROMPT} from '@/server/prompts/quality-check';

const fullResume=`Ерошенко Игорь Павлович
+7 967 250-07-05 — предпочитаемый способ связи
Телефон подтвержден
eipv@yandex.ru

Директор по информационным технологиям
Опыт работы...

Контакты
Ерошенко Игорь Павлович
Мобильный: +7 967 250-07-05
Email: eipv@yandex.ru
Telegram: @EroshenkoIgor`;

describe('resume contact extraction',()=>{
 it('extracts an email after a real newline without adding the escape letter',()=>{
  const emails=extractResumeContacts('Контакты\nТелефон подтвержден\neipv@yandex.ru\nУказан район').emails;
  expect(emails).toEqual(['eipv@yandex.ru']);expect(emails).not.toContain('neipv@yandex.ru');
 });
 it('uses decoded text after JSON parsing',()=>{
  const parsed=JSON.parse('{"text":"Телефон подтвержден\\neipv@yandex.ru\\nУказан район"}') as {text:string};
  expect(extractResumeContacts(parsed.text).emails).toEqual(['eipv@yandex.ru']);
 });
 it('finds name, phone and email when contacts exist only at the beginning',()=>{
  expect(extractResumeContacts('Ерошенко Игорь Павлович\n+7 967 250-07-05\neipv@yandex.ru\n\nДиректор по информационным технологиям\n...')).toEqual({name:'Ерошенко Игорь Павлович',phones:['+7 967 250-07-05'],emails:['eipv@yandex.ru'],telegrams:[]});
 });
 it('allows a resume without contacts',()=>{
  expect(extractResumeContacts('Иван Иванов\nДиректор по ИТ\nОпыт работы...')).toEqual({name:'Иван Иванов',phones:[],emails:[],telegrams:[]});
 });
 it('deduplicates email case-insensitively and removes trailing punctuation',()=>{
  expect(extractResumeContacts('EIPV@YANDEX.RU.\n\nEmail: eipv@yandex.ru').emails).toEqual(['EIPV@YANDEX.RU']);
 });
});

describe('canonical contacts and signature',()=>{
 const extracted=extractResumeContacts(fullResume);
 const canonical=chooseCanonicalContacts(fullResume,extracted).contacts;
 const signature='С уважением,\nЕрошенко Игорь Павлович\n+7 967 250-07-05\neipv@yandex.ru\nTelegram: @EroshenkoIgor';

 it('selects one canonical value for every real contact',()=>{
  expect(extracted).toEqual({name:'Ерошенко Игорь Павлович',phones:['+7 967 250-07-05'],emails:['eipv@yandex.ru'],telegrams:['@EroshenkoIgor']});
  expect(canonical).toEqual({name:'Ерошенко Игорь Павлович',phone:'+7 967 250-07-05',email:'eipv@yandex.ru',telegram:'@EroshenkoIgor'});
 });
 it('adds missing contacts to an LLM signature',()=>{
  expect(normalizeAndAppendSignature('Готов обсудить задачи позиции.\n\nС уважением,\nЕрошенко Игорь Павлович',canonical).letter).toBe(`Готов обсудить задачи позиции.\n\n${signature}`);
 });
 it('replaces an existing correct signature without duplicates',()=>{
  const result=normalizeAndAppendSignature(`Готов обсудить задачи позиции.\n\n${signature}`,canonical).letter;
  expect(result).toBe(`Готов обсудить задачи позиции.\n\n${signature}`);
  expect(result.match(/eipv@yandex\.ru/g)).toHaveLength(1);
 });
 it('removes an invented email from the old signature',()=>{
  const result=normalizeAndAppendSignature('Готов обсудить задачи позиции.\n\nС уважением,\nЕрошенко Игорь Павлович\nnneipv@yandex.ru',canonical).letter;
  expect(result).not.toContain('nneipv@yandex.ru');expect(result).toContain('eipv@yandex.ru');
 });
 it('creates a name-only signature and passes validation when contacts are absent',()=>{
  const resume=extractResumeContacts('Иван Иванов\nДиректор по ИТ\nОпыт работы...');
  const selected=chooseCanonicalContacts('Иван Иванов\nДиректор по ИТ\nОпыт работы...',resume).contacts;
  const finalLetter=normalizeAndAppendSignature('Готов обсудить задачи.',selected).letter;
  expect(finalLetter).toBe('Готов обсудить задачи.\n\nС уважением,\nИван Иванов');
  expect(validateFinalLetterContacts(finalLetter,resume,selected)).toEqual({passed:true,warnings:[]});
 });
 it('chooses a preferred email, keeps both extracted values and logs the ambiguity',()=>{
  const text='Иван Иванов\nfirst@example.ru\n\nКонтакты\npreferred@example.ru — предпочитаемый способ связи';
  const all=extractResumeContacts(text);const selection=chooseCanonicalContacts(text,all);
  expect(all.emails).toEqual(['first@example.ru','preferred@example.ru']);
  expect(selection.contacts.email).toBe('preferred@example.ru');
  expect(selection.warnings[0]).toContain('найдено несколько разных email');
 });
});

describe('final contact validation',()=>{
 it('requires canonical contacts in the final letter',()=>{
  const resume=extractResumeContacts(fullResume);const canonical=chooseCanonicalContacts(fullResume,resume).contacts;
  expect(validateFinalLetterContacts(normalizeAndAppendSignature('Текст письма.',canonical).letter,resume,canonical)).toEqual({passed:true,warnings:[]});
  expect(validateFinalLetterContacts('Текст письма.',resume,canonical).passed).toBe(false);
 });
 it.each(['neipv@yandex.ru','nneipv@yandex.ru'])('rejects invented email %s',email=>{
  const resume=extractResumeContacts('Иван Иванов\neipv@yandex.ru');const canonical=chooseCanonicalContacts('Иван Иванов\neipv@yandex.ru',resume).contacts;
  expect(validateFinalLetterContacts(`Текст. ${email}\nС уважением,\nИван Иванов\neipv@yandex.ru`,resume,canonical).warnings).toContain(`В итоговом письме обнаружен email ${email}, которого нет среди контактов резюме.`);
 });
 it('discards contact conclusions returned by the quality LLM',()=>{
  expect(withoutLLMContactWarnings(['В резюме два email: neipv@yandex.ru и eipv@yandex.ru','Письмо недостаточно отражает пожелания.'])).toEqual(['Письмо недостаточно отражает пожелания.']);
 });
});

describe('semantic quality contract',()=>{
 it('checks fears in analysis without requiring them in the letter',()=>{
  expect(QUALITY_CHECK_SYSTEM_PROMPT).toContain('Страхи должны находиться в ANALYSIS');
  expect(QUALITY_CHECK_SYSTEM_PROMPT).toContain('не считай их отсутствие в письме ошибкой');
 });
 it('does not require every vacancy item or volunteered weaknesses',()=>{
  expect(QUALITY_CHECK_SYSTEM_PROMPT).toContain('Не требуй перечисления всех требований вакансии');
  expect(QUALITY_CHECK_SYSTEM_PROMPT).toContain('self-hosted LLM');
  expect(QUALITY_CHECK_SYSTEM_PROMPT).toContain('2–4 наиболее сильных аргумента');
 });
});
