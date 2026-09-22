import {describe,expect,it,vi} from 'vitest';
import {isPublicAddress,validateUrl} from '@/server/services/safe-fetch';
import {ensureResumeContacts} from '@/server/services/contacts';
import {parseResult} from '@/server/services/result-parser';
import {fetchKodikRouterBalance,KODIKROUTER_BALANCE_URL} from '@/server/services/kodikrouter-balance';
import {estimateTokenCost,kodikRouterModelUrl} from '@/server/services/token-cost';
import {cookieAttributes} from '@/server/services/admin-auth';
vi.mock('server-only',()=>({}));

describe('SSRF validation',()=>{
 it.each(['http://127.0.0.1','http://[::1]','file:///etc/passwd','http://user:pass@example.com','http://example.local','http://example.com:8080'])('rejects %s',url=>expect(()=>validateUrl(url)).toThrow());
 it('accepts public https domains',()=>expect(validateUrl('https://hh.ru/vacancy/1').hostname).toBe('hh.ru'));
 it.each(['10.0.0.1','172.16.1.1','192.168.1.1','169.254.1.1','100.64.0.1'])('marks %s private',ip=>expect(isPublicAddress(ip)).toBe(false));
});

describe('result processing',()=>{
 it('adds resume contacts',()=>expect(ensureResumeContacts('Здравствуйте.','Иван, ivan@example.com, +7 999 123-45-67, @ivan_work')).toContain('ivan@example.com'));
 it('parses required sections',()=>{const raw=['АНАЛИЗ ДАННЫХ','Вакансия: Разработчик\nКомпания: Тест','ВЫЯВЛЕННЫЕ СТРАХИ РАБОТОДАТЕЛЯ','1. Риск 1\n2. Риск 2\n3. Риск 3','СОПОСТАВЛЕНИЕ С РЕЗЮМЕ','Риск 1 | Опыт | высокая','ИТОГОВОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО','Письмо','ИСПОЛЬЗОВАННЫЕ ИСТОЧНИКИ','Вакансия и резюме','СТАТИСТИКА','Готово'].join('\n');expect(parseResult(raw).letter).toContain('Письмо');});
});

describe('KodikRouter pricing',()=>{
 it('builds an encoded public model-catalog URL',()=>expect(kodikRouterModelUrl('openai/gpt-5.6-luna')).toBe('https://api.kodikrouter.ru/v1/catalog/models/openai%2Fgpt-5.6-luna'));
 it('converts catalog USD prices to rubles without an extra multiplier',()=>{
  const cost=estimateTokenCost(1_000_000,1_000_000,{inputUsdPerMillion:.2,outputUsdPerMillion:1.2},{value:100,date:'01.01.2026'});
  expect(cost).toMatchObject({usd:1.4,rub:140,inputRubPerMillion:20,outputRubPerMillion:120,multiplier:1});
 });
});

describe('KodikRouter balance',()=>{
 it('requests billing summary with GET and bearer authorization',async()=>{
  const request=vi.fn(async()=>Response.json({credit_balance:'123.45',currency:'RUB'}));
  await expect(fetchKodikRouterBalance({LLM_API_KEY:'secret'},request)).resolves.toBe(123.45);
  expect(request).toHaveBeenCalledWith(KODIKROUTER_BALANCE_URL,expect.objectContaining({method:'GET',headers:{Authorization:'Bearer secret'},cache:'no-store',redirect:'manual'}));
 });
 it('rejects a non-RUB or malformed balance',async()=>{
  await expect(fetchKodikRouterBalance({LLM_API_KEY:'secret'},async()=>Response.json({credit_balance:'unknown',currency:'RUB'}))).rejects.toThrow('некорректный баланс');
 });
});

describe('administrator session cookie',()=>{
 it('allows the cookie on a local HTTP preview',()=>expect(cookieAttributes(new Request('http://127.0.0.1:8792/'))).not.toContain('Secure'));
 it('keeps the cookie secure for the public service',()=>expect(cookieAttributes(new Request('https://cover-letter.ai-run.ru/'))).toContain('Secure'));
});
