import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,rename,stat,unlink,utimes,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import type {Settings} from '@/server/config/llm-models';

const FILE_RE=/^\d{8}T\d{9}Z_[0-9a-f-]{36}\.md$/;
const MAX_BYTES=200_000;
function paths(settings:Settings){
 const active=settings.SYSTEM_PROMPT_PATH;
 if(!active)throw new Error('SYSTEM_PROMPT_PATH не настроен.');
 const directory=join(dirname(active),'prompt-history');
 return {active,directory,selection:join(directory,'active.json')};
}
function validate(content:string){
 if(Buffer.byteLength(content,'utf8')>MAX_BYTES||content.trim().length<100)throw new Error('Промпт должен содержать от 100 символов до 200 КБ.');
 return content;
}
function fileName(date:Date){return `${date.toISOString().replace(/[-:.]/g,'')}_${randomUUID()}.md`;}
async function atomicWrite(path:string,content:string){
 const temporary=`${path}.${randomUUID()}.tmp`;
 try{await writeFile(temporary,content,{flag:'wx',mode:0o600});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>{});}
}
async function selection(settings:Settings){
 const {selection}=paths(settings);
 try{const id=JSON.parse(await readFile(/* turbopackIgnore: true */ selection,'utf8')).id as unknown;if(typeof id!=='string'||!FILE_RE.test(id))throw new Error('Некорректный указатель на системный промпт.');return id;}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
async function initialize(settings:Settings){
 const {active,directory,selection:selectionPath}=paths(settings);
 const selected=await selection(settings);
 if(selected)return selected;
 const content=validate(await readFile(active,'utf8'));
 const modifiedAt=(await stat(active)).mtime;
 await mkdir(directory,{recursive:true,mode:0o700});
 const id=fileName(modifiedAt);
 await writeFile(join(directory,id),content,{flag:'wx',mode:0o600});
 await utimes(join(directory,id),modifiedAt,modifiedAt);
 await atomicWrite(selectionPath,JSON.stringify({id}));
 return id;
}
export async function listSystemPrompts(settings:Settings){
 const {directory}=paths(settings);
 const activeId=await initialize(settings);
 const files=(await readdir(/* turbopackIgnore: true */ directory)).filter(name=>FILE_RE.test(name));
 const items=await Promise.all(files.map(async id=>{
  const info=await stat(join(directory,id));
  return {id,modifiedAt:info.mtime.toISOString(),active:id===activeId};
 }));
 return items.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt)||b.id.localeCompare(a.id));
}
export async function addSystemPrompt(settings:Settings,content:string,modifiedAt:Date){
 validate(content);
 if(!Number.isFinite(modifiedAt.getTime())||modifiedAt.getTime()>Date.now()+60_000)throw new Error('Некорректная дата изменения файла.');
 const {directory}=paths(settings);
 await initialize(settings);
 const id=fileName(modifiedAt);
 await writeFile(join(directory,id),content,{flag:'wx',mode:0o600});
 await utimes(join(directory,id),modifiedAt,modifiedAt);
 return listSystemPrompts(settings);
}
export async function activateSystemPrompt(settings:Settings,id:string){
 if(!FILE_RE.test(id))throw new Error('Некорректный идентификатор промпта.');
 const {directory,selection:selectionPath}=paths(settings);
 await initialize(settings);
 validate(await readFile(join(directory,id),'utf8'));
 await atomicWrite(selectionPath,JSON.stringify({id}));
 return listSystemPrompts(settings);
}
export async function loadSystemPrompt(settings:Settings){
 const {active,directory}=paths(settings);
 const id=await selection(settings);
 const promptPath=id?join(/* turbopackIgnore: true */ directory,id):active;
 const content=validate(await readFile(/* turbopackIgnore: true */ promptPath,'utf8')).trim();
 const hash=createHash('sha256').update(content).digest('hex');
 return {content,hash,version:id?`${id.slice(0,19)} · ${hash.slice(0,12)}`:`sha256:${hash.slice(0,12)}`};
}
