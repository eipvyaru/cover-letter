import 'server-only';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Settings} from '@/server/config/llm-models';

export async function loadSystemPrompt(settings:Settings){
 const path=settings.SYSTEM_PROMPT_PATH;
 if(!path)throw new Error('SYSTEM_PROMPT_PATH не настроен.');
 const content=(await readFile(path,'utf8')).trim();
 if(content.length<100)throw new Error('Системный промпт отсутствует или слишком короткий.');
 const hash=createHash('sha256').update(content).digest('hex');
 return {content,hash,version:`sha256:${hash.slice(0,12)}`};
}
