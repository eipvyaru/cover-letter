import {fetchPublicUrl,readLimited} from './safe-fetch';
import {extractText} from './html-parser';
import {headHunterVacancyEndpoint,headHunterVacancyText} from './head-hunter';
import type {Attempt,Input,Source} from '@/shared/types';
import type {Settings} from '../config/llm-models';

function appUrl(env:Settings){try{return new URL(env.APP_PUBLIC_URL||'https://example.com').origin;}catch{return 'https://example.com';}}
function pageHeaders(env:Settings){return {
 'User-Agent':`Mozilla/5.0 (compatible; CoverLetter/1.0; +${appUrl(env)})`,
 'Accept':'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
 'Accept-Language':'ru-RU,ru;q=0.9,en;q=0.7',
};}

async function requestWithRedirects(initialUrl:string,headers:Record<string,string>,allowedHosts?:string){
 let target=initialUrl;
 for(let redirects=0;redirects<6;redirects++){
  const response=await fetchPublicUrl(target,{redirect:'manual',headers,signal:AbortSignal.timeout(20000)},allowedHosts);
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');
   await response.body?.cancel();
   if(!location)throw new Error('Некорректное перенаправление.');
   target=new URL(location,target).href;
   continue;
  }
  return response;
 }
 throw new Error('Слишком много перенаправлений.');
}

export async function fetchSource(kind:'vacancy'|'resume',input:Input,env:Settings,onAttempt:(a:Attempt)=>void):Promise<Source>{
 const url=kind==='vacancy'?input.vacancyUrl:input.resumeUrl;
 const manual=kind==='vacancy'?input.vacancyText:input.resumeText;
 if(manual?.trim()){
  if(manual.trim().length<100)throw new Error('Вставленный текст слишком короткий для анализа (минимум 100 символов).');
  onAttempt({source:kind,attempt:0,time:new Date().toISOString(),httpStatus:null,result:'Текст введён пользователем',durationMs:0,method:'manual'});
  return {url,text:manual.trim(),method:'manual',status:'получено'};
 }

 const hhEndpoint=kind==='vacancy'?headHunterVacancyEndpoint(url):null;
 let last='';
 for(let attempt=1;attempt<=input.maxAttempts;attempt++){
  const start=Date.now();let status:number|null=null;let method='http';
  try{
   let response=await requestWithRedirects(url,pageHeaders(env),env.SOURCE_ALLOWED_HOST_MASKS_JSON);status=response.status;
   if(!response.ok&&hhEndpoint){
    await response.body?.cancel();method='hh-api';
    response=await requestWithRedirects(hhEndpoint,{
     'User-Agent':`CoverLetter/1.0 (+${appUrl(env)})`,
     'HH-User-Agent':`CoverLetter/1.0 (+${appUrl(env)})`,
     'Accept':'application/json',
    },env.SOURCE_ALLOWED_HOST_MASKS_JSON);
    status=response.status;
   }
   if(!response.ok){
    await response.body?.cancel();
    if(hhEndpoint)throw new Error(`HeadHunter открывается в вашем браузере, но заблокировал отдельный серверный запрос и официальный API (HTTP ${status}). Вставьте описание в поле «Текст вакансии».`);
    if(status===406)throw new Error('Сайт отклонил автоматическую загрузку (HTTP 406). Откройте страницу в браузере и вставьте её содержимое в поле текста ниже.');
    throw new Error(`Источник ответил HTTP ${status}. Страница может требовать вход или блокировать автоматическое чтение.`);
   }
   const type=response.headers.get('content-type')||'';
   if(!/text\/html|text\/plain|application\/json|application\/xhtml/.test(type)){
    await response.body?.cancel();throw new Error('Формат страницы не поддерживается. Вставьте текст вручную.');
   }
   const body=await readLimited(response);
   const text=method==='hh-api'?await headHunterVacancyText(body):/html/.test(type)?(await extractText(body)).text:body;
   if(text.length<200||/captcha|докажите, что вы|подтвердите, что вы|enable javascript|access denied|checking your browser/i.test(text.slice(0,1500))){
    throw new Error('Страница требует JavaScript, авторизацию или CAPTCHA. Вставьте её текст вручную.');
   }
   if(typeof text!=='string'||text.length<100)throw new Error('На странице не найден содержательный текст.');
   if(text.length>60000)throw new Error('Текст превышает 60 000 символов. Вставьте содержательную часть вручную.');
   onAttempt({source:kind,attempt,time:new Date(start).toISOString(),httpStatus:status,result:'Данные получены',durationMs:Date.now()-start,method});
   return {url,text,method,status:'получено'};
  }catch(error){
   last=error instanceof Error?error.message:'Сетевая ошибка при чтении страницы.';
   onAttempt({source:kind,attempt,time:new Date(start).toISOString(),httpStatus:status,result:'Ошибка',error:last,durationMs:Date.now()-start,method});
   if(attempt<input.maxAttempts)await new Promise(r=>setTimeout(r,input.retryInterval*1000));
  }
 }
 throw new Error(`${kind==='vacancy'?'Вакансия':'Резюме'}: ${last}`);
}
