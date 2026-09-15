import {clearHistory,listHistory,saveHistory} from '@/server/services/history-store';
import {isAdministrator} from '@/server/services/admin-auth';
import {runtimeSettings} from '@/server/config/llm-models';
import {isSameOriginRequest} from '@/server/services/request-security';
import type {Generation} from '@/shared/types';

const MAX_BODY_BYTES=5_000_000;
export const runtime='nodejs';

export async function GET(request:Request){
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'История доступна только администратору.'},{status:403});
 try{return Response.json({items:await listHistory()});}catch(error){console.error('history list failed',error);return Response.json({error:'Серверная история временно недоступна.'},{status:503});}
}

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403});
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'Импорт истории доступен только администратору.'},{status:403});
 try{
  const body=await request.text();if(body.length>MAX_BODY_BYTES)throw new Error('large');
  const parsed=JSON.parse(body) as {items?:unknown};const raw=Array.isArray(parsed.items)?parsed.items:[];
  const items=raw.filter(isGeneration).slice(0,30);
  if(!items.length)return Response.json({error:'Нет корректных записей для сохранения.'},{status:400});
  await saveHistory('legacy-admin',items);return Response.json({items:await listHistory()});
 }catch(error){console.error('history save failed',error);return Response.json({error:'Не удалось сохранить историю на сервере.'},{status:503});}
}

export async function DELETE(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403});
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'Очистка истории доступна только администратору.'},{status:403});
 try{await clearHistory();return Response.json({items:[]});}catch(error){console.error('history clear failed',error);return Response.json({error:'Не удалось очистить историю на сервере.'},{status:503});}
}

function isGeneration(value:unknown):value is Generation{
 if(!value||typeof value!=='object')return false;
 const item=value as Partial<Generation>;
 return typeof item.id==='string'&&item.id.length>0&&item.id.length<=200&&!!item.execution&&typeof item.execution.startedAt==='string'&&!!item.input&&!!item.llm&&!!item.analysis&&!!item.statistics&&!!item.sources&&Array.isArray(item.fears)&&Array.isArray(item.matching);
}
