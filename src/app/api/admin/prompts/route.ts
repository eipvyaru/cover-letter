import {activateSystemPrompt,addSystemPrompt,listSystemPrompts} from '@/server/prompts/system-prompt';
import {isAdministrator,audit} from '@/server/services/admin-auth';
import {runtimeSettings} from '@/server/config/llm-models';
import {isSameOriginRequest} from '@/server/services/request-security';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
async function body(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error('Пустой запрос.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>700_000){await reader.cancel();throw new Error('Файл слишком велик.');}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;
}
export async function GET(request:Request){
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'Требуется вход администратора.'},{status:403,headers});
 try{return Response.json({items:await listSystemPrompts(runtimeSettings())},{headers});}
 catch{return Response.json({error:'Не удалось прочитать версии промпта.'},{status:503,headers});}
}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403,headers});
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'Требуется вход администратора.'},{status:403,headers});
 try{
  const data=await body(request);
  if(typeof data.content!=='string'||typeof data.modifiedAt!=='number')throw new Error('Некорректный файл.');
  const items=await addSystemPrompt(runtimeSettings(),data.content,new Date(data.modifiedAt));
  audit('admin_prompt_uploaded','admin',request);
  return Response.json({items},{headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Не удалось загрузить промпт.'},{status:400,headers});}
}
export async function PATCH(request:Request){
 if(!isSameOriginRequest(request))return Response.json({error:'Запрос с другого сайта запрещён.'},{status:403,headers});
 if(!await isAdministrator(request,runtimeSettings()))return Response.json({error:'Требуется вход администратора.'},{status:403,headers});
 try{
  const data=await body(request);
  if(typeof data.id!=='string')throw new Error('Некорректная версия.');
  const items=await activateSystemPrompt(runtimeSettings(),data.id);
  audit('admin_prompt_activated','admin',request);
  return Response.json({items},{headers});
 }catch{return Response.json({error:'Не удалось выбрать версию промпта.'},{status:400,headers});}
}
