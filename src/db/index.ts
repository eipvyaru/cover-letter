import 'server-only';
import {DatabaseSync} from 'node:sqlite';
import {dirname} from 'node:path';
import {mkdirSync} from 'node:fs';

let database:DatabaseSync|undefined;
export function getDb(){
 if(database)return database;
 const path=process.env.DATABASE_PATH;
 if(!path)throw new Error('DATABASE_PATH не настроен.');
 mkdirSync(dirname(path),{recursive:true});
 database=new DatabaseSync(path);
 database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
 return database;
}
