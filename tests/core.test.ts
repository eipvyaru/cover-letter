import {describe,expect,it} from 'vitest';
import {isPublicAddress,validateUrl} from '@/server/services/safe-fetch';
import {ensureResumeContacts} from '@/server/services/contacts';
import {parseResult} from '@/server/services/result-parser';

describe('SSRF validation',()=>{
 it.each(['http://127.0.0.1','http://[::1]','file:///etc/passwd','http://user:pass@example.com','http://example.local','http://example.com:8080'])('rejects %s',url=>expect(()=>validateUrl(url)).toThrow());
 it('accepts public https domains',()=>expect(validateUrl('https://hh.ru/vacancy/1').hostname).toBe('hh.ru'));
 it.each(['10.0.0.1','172.16.1.1','192.168.1.1','169.254.1.1','100.64.0.1'])('marks %s private',ip=>expect(isPublicAddress(ip)).toBe(false));
});

describe('result processing',()=>{
 it('adds resume contacts',()=>expect(ensureResumeContacts('Здравствуйте.','Иван, ivan@example.com, +7 999 123-45-67, @ivan_work')).toContain('ivan@example.com'));
 it('parses required sections',()=>{const raw=['АНАЛИЗ ДАННЫХ','Вакансия: Разработчик\nКомпания: Тест','ВЫЯВЛЕННЫЕ СТРАХИ РАБОТОДАТЕЛЯ','1. Риск 1\n2. Риск 2\n3. Риск 3','СОПОСТАВЛЕНИЕ С РЕЗЮМЕ','Риск 1 | Опыт | высокая','ИТОГОВОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО','Письмо','ИСПОЛЬЗОВАННЫЕ ИСТОЧНИКИ','Вакансия и резюме','СТАТИСТИКА','Готово'].join('\n');expect(parseResult(raw).letter).toContain('Письмо');});
});
