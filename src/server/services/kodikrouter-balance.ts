import {routerSettings,type Settings} from '@/server/config/llm-models';

export const KODIKROUTER_BALANCE_URL='https://api.kodikrouter.ru/v1/billing/summary';
type FetchLike=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;

export async function fetchKodikRouterBalance(env:Settings,request:FetchLike=fetch):Promise<number>{
 const {key}=routerSettings(env);if(!key)throw new Error('API-ключ KodikRouter не настроен.');
 let response:Response;
 try{response=await request(KODIKROUTER_BALANCE_URL,{method:'GET',headers:{Authorization:`Bearer ${key}`},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new Error('KodikRouter не ответил на запрос баланса.');}
 if(!response.ok){await response.body?.cancel();throw new Error(`KodikRouter вернул HTTP ${response.status} при запросе баланса.`);}
 const data=await response.json() as {credit_balance?:unknown;currency?:unknown};
 const balance=typeof data.credit_balance==='number'?data.credit_balance:typeof data.credit_balance==='string'&&data.credit_balance.trim()!==''?Number(data.credit_balance):Number.NaN;
 if(data.currency!=='RUB'||!Number.isFinite(balance)||balance<0)throw new Error('KodikRouter вернул некорректный баланс.');
 return balance;
}
