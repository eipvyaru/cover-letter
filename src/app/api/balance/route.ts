import {runtimeSettings} from '@/server/config/llm-models';
import {fetchKodikRouterBalance} from '@/server/services/kodikrouter-balance';
import {isSameOriginRequest} from '@/server/services/request-security';
import {consumeRateLimit} from '@/server/services/rate-limit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403});
 if(!consumeRateLimit(request,'balance',30))return Response.json({error:'Слишком много запросов баланса.'},{status:429});
 try{return Response.json({balance:await fetchKodikRouterBalance(runtimeSettings())},{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('KodikRouter balance request failed',error instanceof Error?error.message:'unknown error');return Response.json({error:'Не удалось получить текущий баланс.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
