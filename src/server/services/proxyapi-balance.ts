import {routerSettings,type Settings} from '@/server/config/llm-models';

export const PROXYAPI_BALANCE_URL='https://api.proxyapi.ru/proxyapi/balance';
type FetchLike=(input:string|URL|Request,init?:RequestInit)=>Promise<Response>;

export async function fetchProxyApiBalance(env:Settings,request:FetchLike=fetch):Promise<number>{
 const {key}=routerSettings(env);if(!key)throw new Error('API-ключ ProxyAPI не настроен.');
 let response:Response;
 try{response=await request(PROXYAPI_BALANCE_URL,{method:'GET',headers:{Authorization:`Bearer ${key}`},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new Error('ProxyAPI не ответил на запрос баланса.');}
 if(!response.ok){await response.body?.cancel();throw new Error(`ProxyAPI вернул HTTP ${response.status} при запросе баланса.`);}
 const data=await response.json() as {balance?:unknown};
 if(typeof data.balance!=='number'||!Number.isFinite(data.balance))throw new Error('ProxyAPI вернул некорректный баланс.');
 return data.balance;
}
