import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
try{process.loadEnvFile(resolve('.env'));}catch{}
const path=process.env.DATABASE_PATH||resolve('data/cover-letter.sqlite');mkdirSync(dirname(path),{recursive:true});
const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL);');
for(const file of readdirSync('migrations').filter(x=>/^\d+.*\.sql$/.test(x)).sort()){const version=Number(file.match(/^\d+/)[0]);const sql=readFileSync(resolve('migrations',file),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');const row=db.prepare('SELECT checksum FROM schema_migrations WHERE version=?').get(version);if(row){if(row.checksum!==checksum)throw new Error(`Checksum mismatch: ${file}`);continue;}db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(version,checksum,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
console.log('Database migrations are current.');
