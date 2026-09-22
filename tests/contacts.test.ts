import {describe,expect,it} from 'vitest';
import {extractResumeContacts,validateLetterContacts,withoutLLMContactWarnings} from '@/server/services/contacts';

describe('canonical resume contact extraction',()=>{
 it('extracts an email after a real newline without adding the escape letter',()=>{
  const contacts=extractResumeContacts('Контакты\nТелефон подтвержден\neipv@yandex.ru\nУказан примерный район');
  expect(contacts.emails).toEqual(['eipv@yandex.ru']);
  expect(contacts.emails).not.toContain('neipv@yandex.ru');
 });

 it('extracts only from decoded text after JSON parsing',()=>{
  const parsed=JSON.parse('{"text":"Телефон подтвержден\\neipv@yandex.ru\\nУказан примерный район"}') as {text:string};
  expect(extractResumeContacts(parsed.text).emails).toEqual(['eipv@yandex.ru']);
  expect(extractResumeContacts(JSON.stringify(parsed)).emails).not.toContain('neipv@yandex.ru');
 });

 it('deduplicates repeated emails case-insensitively and removes trailing punctuation',()=>{
  expect(extractResumeContacts('EIPV@YANDEX.RU.\n\nКонтакты:\nEmail: eipv@yandex.ru').emails).toEqual(['EIPV@YANDEX.RU']);
 });

 it('does not treat the n from a newline as part of an email',()=>{
  const emails=extractResumeContacts('\neipv@yandex.ru').emails;
  expect(emails).toContain('eipv@yandex.ru');
  expect(emails).not.toContain('neipv@yandex.ru');
 });
});

describe('deterministic letter contact validation',()=>{
 const resumeContacts=extractResumeContacts('Email: eipv@yandex.ru\nТелефон: +7 967 250-07-05\nTelegram: @EroshenkoIgor');

 it('passes when the letter contains no contacts',()=>{
  expect(validateLetterContacts('С уважением,\nЕрошенко Игорь Павлович',resumeContacts)).toEqual({passed:true,warnings:[]});
 });

 it('passes when the letter contains a confirmed email',()=>{
  expect(validateLetterContacts('Для связи: eipv@yandex.ru',resumeContacts)).toEqual({passed:true,warnings:[]});
 });

 it.each(['neipv@yandex.ru','nneipv@yandex.ru'])('rejects invented email %s with an explicit warning',email=>{
  const check=validateLetterContacts(`Для связи: ${email}`,resumeContacts);
  expect(check.passed).toBe(false);
  expect(check.warnings).toEqual([`В сопроводительном письме указан email ${email}, который не найден в RESUME_TEXT.`]);
 });

 it('validates optional phones and Telegram only when they appear',()=>{
  expect(validateLetterContacts('Связь: +7 (967) 250-07-05, @eroshenkoigor',resumeContacts)).toEqual({passed:true,warnings:[]});
  const check=validateLetterContacts('Связь: +7 999 111-22-33, @unknown_user',resumeContacts);
  expect(check.passed).toBe(false);
  expect(check.warnings).toHaveLength(2);
 });

 it('discards contact conclusions returned by the quality LLM',()=>{
  expect(withoutLLMContactWarnings(['В резюме указаны два разных токена электронной почты: neipv@yandex.ru и eipv@yandex.ru','Письмо недостаточно отражает пожелания.'])).toEqual(['Письмо недостаточно отражает пожелания.']);
 });
});

describe('resume contact integration scenario',()=>{
 it('produces one canonical value for every real contact',()=>{
  const resumeText=`Контакты
+7 967 250-07-05 — предпочитаемый способ связи
Телефон подтвержден
eipv@yandex.ru
Указан примерный район поиска работы

Контакты
Ерошенко Игорь Павлович
Мобильный: +7 967 250-07-05
Email: eipv@yandex.ru
Telegram: @EroshenkoIgor`;
  expect(extractResumeContacts(resumeText)).toEqual({
   emails:['eipv@yandex.ru'],
   phones:['+7 967 250-07-05'],
   telegrams:['@EroshenkoIgor'],
  });
 });
});
