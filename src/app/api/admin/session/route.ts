import {audit,clearAdminSession,createAdminCookie,isAdministrator,verifyAdminCredentials} from '@/server/services/admin-auth';
import {runtimeSettings} from '@/server/config/llm-models';
import {isSameOriginRequest} from '@/server/services/request-security';
import {consumeRateLimit} from '@/server/services/rate-limit';

export const runtime='nodejs';
export async function GET(request:Request){return Response.json({isAdmin:await isAdministrator(request,runtimeSettings())},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403});
 if(!consumeRateLimit(request,'admin-login',5))return Response.json({error:'Слишком много попыток. Повторите позже.'},{status:429});
 try{const text=await request.text();if(text.length>2000)throw new Error('large');const body=JSON.parse(text) as {login?:unknown;password?:unknown};if(typeof body.login!=='string'||typeof body.password!=='string'||body.login.length>200||body.password.length>500)throw new Error('invalid');const settings=runtimeSettings();if(!await verifyAdminCredentials(body.login,body.password,settings)){audit('admin_login_failed',body.login,request);return Response.json({error:'Неверный логин или пароль.'},{status:401});}audit('admin_login',body.login,request);return Response.json({isAdmin:true},{headers:{'Set-Cookie':await createAdminCookie(settings),'Cache-Control':'no-store'}});}catch{return Response.json({error:'Проверьте логин и пароль.'},{status:400});}
}
export async function DELETE(request:Request){if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403});return Response.json({isAdmin:false},{headers:{'Set-Cookie':await clearAdminSession(request),'Cache-Control':'no-store'}});}
