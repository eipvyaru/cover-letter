import {readFileSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';

const path=resolve('.env');const temp=path+'.tmp';const lines=readFileSync(path,'utf8').split(/\r?\n/);let changed=false;
const values=new Map(lines.map(line=>{const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);return match?[match[1],unquote(match[2])]:['',''];}));
const current=values.get('ADMIN_PASSWORD_HASH')||'';if(!/^\d{6,}:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{32,}$/.test(current)){if(!current||current.startsWith('replace-'))throw new Error('Enter the admin password in ADMIN_PASSWORD_HASH once, then rerun.');const salt=randomBytes(18);const iterations=210000;const hash=pbkdf2Sync(current,salt,iterations,32,'sha256');replace('ADMIN_PASSWORD_HASH',`${iterations}:${salt.toString('base64url')}:${hash.toString('base64url')}`);changed=true;}
const session=values.get('ADMIN_SESSION_SECRET')||'';if(session.length<32||session.startsWith('replace-')){replace('ADMIN_SESSION_SECRET',randomBytes(48).toString('base64url'));changed=true;}
if(changed){writeFileSync(temp,lines.join('\n'),{encoding:'utf8',mode:0o600});renameSync(temp,path);}console.log('Admin configuration secured; values redacted.');
function replace(key,value){const index=lines.findIndex(line=>line.startsWith(key+'='));if(index<0)throw new Error(`Missing ${key}`);lines[index]=`${key}="${value}"`;}
function unquote(value){const text=value.trim();return ((text.startsWith('"')&&text.endsWith('"'))||(text.startsWith("'")&&text.endsWith("'")))?text.slice(1,-1):text;}
process.on('exit',()=>{try{rmSync(temp,{force:true});}catch{}});
