import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
let dir='';afterEach(()=>{if(dir)rmSync(dir,{recursive:true,force:true});});
describe('initial migration',()=>{it('creates required tables and is repeatable',()=>{dir=mkdtempSync(join(tmpdir(),'cover-letter-'));const db=new DatabaseSync(join(dir,'test.sqlite'));const sql=readFileSync('migrations/0001_initial.sql','utf8');db.exec(sql);db.exec(sql);const names=(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(x=>x.name);expect(names).toEqual(expect.arrayContaining(['schema_migrations','admin_sessions','app_settings','generations','audit_events']));db.close();});});
