import type {Generation} from '@/shared/types';
import {getDb} from '@/db';

const LIMIT=30;const RETENTION_MS=30*24*60*60*1000;

export async function listHistory():Promise<Generation[]>{
 purge();const result=getDb().prepare('SELECT payload FROM generations ORDER BY created_at DESC, row_id DESC LIMIT ?').all(LIMIT) as {payload:string}[];
 const items:Generation[]=[];
 for(const row of result){try{items.push(JSON.parse(row.payload) as Generation);}catch{}}
 return items;
}

export async function saveHistory(userId:string,items:Generation[]):Promise<void>{
 if(!items.length)return;
 const db=getDb();const insert=db.prepare('INSERT INTO generations (user_id,generation_id,created_at,status,model,prompt_version,payload) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,generation_id) DO UPDATE SET created_at=excluded.created_at,status=excluded.status,model=excluded.model,prompt_version=excluded.prompt_version,payload=excluded.payload');
 db.exec('BEGIN IMMEDIATE');
 try{for(const item of items.slice(0,LIMIT))insert.run(userId,item.id,historyTime(item),item.execution.status,item.llm.modelId,item.llm.promptVersion,JSON.stringify(item));purge(db);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}

export async function clearHistory():Promise<void>{
 getDb().exec('DELETE FROM generations');
}

function historyTime(item:Generation):number{
 const parsed=Date.parse(item.execution?.startedAt||'');
 return Number.isFinite(parsed)?parsed:Date.now();
}
function purge(db=getDb()){db.prepare('DELETE FROM generations WHERE created_at < ?').run(Date.now()-RETENTION_MS);db.prepare('DELETE FROM generations WHERE row_id NOT IN (SELECT row_id FROM generations ORDER BY created_at DESC,row_id DESC LIMIT ?)').run(LIMIT);}
