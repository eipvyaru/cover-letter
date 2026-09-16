import {describe,expect,it,vi} from 'vitest';
import {isPublicAddress,validateUrl} from '@/server/services/safe-fetch';
import {ensureResumeContacts} from '@/server/services/contacts';
import {parseResult} from '@/server/services/result-parser';
import {fetchProxyApiBalance,PROXYAPI_BALANCE_URL} from '@/server/services/proxyapi-balance';

describe('SSRF validation',()=>{
 it.each(['http://127.0.0.1','http://[::1]','file:///etc/passwd','http://user:pass@example.com','http://example.local','http://example.com:8080'])('rejects %s',url=>expect(()=>validateUrl(url)).toThrow());
 it('accepts public https domains',()=>expect(validateUrl('https://hh.ru/vacancy/1').hostname).toBe('hh.ru'));
 it.each(['10.0.0.1','172.16.1.1','192.168.1.1','169.254.1.1','100.64.0.1'])('marks %s private',ip=>expect(isPublicAddress(ip)).toBe(false));
});

describe('result processing',()=>{
 it('adds resume contacts',()=>expect(ensureResumeContacts('Здравствуйте.','Иван, ivan@example.com, +7 999 123-45-67, @ivan_work')).toContain('ivan@example.com'));
 it('parses required sections',()=>{const raw=['АНАЛИЗ ДАННЫХ','Вакансия: Разработчик\nКомпания: Тест','ВЫЯВЛЕННЫЕ СТРАХИ РАБОТОДАТЕЛЯ','1. Риск 1\n2. Риск 2\n3. Риск 3','СОПОСТАВЛЕНИЕ С РЕЗЮМЕ','Риск 1 | Опыт | высокая','ИТОГОВОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО','Письмо','ИСПОЛЬЗОВАННЫЕ ИСТОЧНИКИ','Вакансия и резюме','СТАТИСТИКА','Готово'].join('\n');expect(parseResult(raw).letter).toContain('Письмо');});
});

describe('ProxyAPI balance',()=>{
 it('requests the fixed balance endpoint with GET and bearer authorization',async()=>{
  const request=vi.fn(async()=>Response.json({balance:123.45}));
  await expect(fetchProxyApiBalance({LLM_API_KEY:'secret'},request)).resolves.toBe(123.45);
  expect(request).toHaveBeenCalledWith(PROXYAPI_BALANCE_URL,expect.objectContaining({method:'GET',headers:{Authorization:'Bearer secret'},cache:'no-store',redirect:'manual'}));
 });
 it('rejects a response without a numeric balance',async()=>{
  await expect(fetchProxyApiBalance({LLM_API_KEY:'secret'},async()=>Response.json({balance:'123'}))).rejects.toThrow('некорректный баланс');
 });
});
