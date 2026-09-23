import 'server-only';
import {lookup as resolveDns} from 'node:dns/promises';
import type {LookupFunction} from 'node:net';
import {Agent,fetch as undiciFetch,type RequestInit as UndiciRequestInit} from 'undici';

export type ResolvedAddress={address:string;family:number};
export type AddressResolver=(hostname:string)=>Promise<ResolvedAddress[]>;

const resolveAll:AddressResolver=hostname=>resolveDns(hostname,{all:true,verbatim:true});

export function validateUrl(value:string):URL{
 let url:URL;try{url=new URL(value);}catch{throw new Error('Укажите корректную ссылку на страницу.');}
 const host=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port)||!host.includes('.')||host.endsWith('.')||/^(\d+\.){3}\d+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|lan|home|onion)$/.test(host))throw new Error('Разрешены только публичные HTTP/HTTPS страницы без пароля и нестандартного порта.');
 return url;
}

export function isPublicAddress(ip:string):boolean{
 if(ip.includes(':')){const value=ip.toLowerCase();return /^[23][0-9a-f]{0,3}:/.test(value)&&!value.startsWith('2001:db8:')&&!value.startsWith('2002:')&&!value.startsWith('2001:0:')&&!value.startsWith('2001:2:')&&!/^2001:0?1[0-9a-f]:/.test(value)&&!/^2001:0?2[0-9a-f]:/.test(value);}
 const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
 const[a,b,c]=parts;
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&c===0||b===0&&c===2||b===88&&c===99||b===175&&c===48)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}

export function isAllowedSourceHost(hostname:string,configuration?:string){
 const rules=(configuration||'').split(',').map(rule=>rule.trim().toLowerCase()).filter(Boolean);
 if(!rules.length)return true;
 const host=hostname.toLowerCase();
 return rules.some(rule=>{const suffix=rule.startsWith('*.')?rule.slice(2):rule;return host===suffix||(rule.startsWith('*.')&&host.endsWith(`.${suffix}`));});
}

export async function resolvePublicAddresses(hostname:string,resolver:AddressResolver=resolveAll){
 let addresses:ResolvedAddress[];try{addresses=await resolver(hostname);}catch{throw new Error('Не удалось проверить адрес источника.');}
 if(!addresses.length||addresses.some(({address})=>!isPublicAddress(address)))throw new Error('Адрес источника недоступен или указывает на закрытую сеть.');
 return addresses;
}

export async function assertPublicUrl(value:string,allowedHosts?:string){
 const url=validateUrl(value);
 if(!isAllowedSourceHost(url.hostname,allowedHosts))throw new Error('Домен источника не входит в список разрешённых.');
 await resolvePublicAddresses(url.hostname);
 return url;
}

export function createPublicLookup(resolver:AddressResolver=resolveAll):LookupFunction{
 return (hostname,options,callback)=>{
  void resolvePublicAddresses(hostname,resolver).then(addresses=>{
   const family=typeof options.family==='number'&&options.family?options.family:0;
   const eligible=family?addresses.filter(address=>address.family===family):addresses;
   if(!eligible.length){callback(Object.assign(new Error('У домена нет публичного адреса требуемого семейства.'),{code:'ENOTFOUND'}),'',0);return;}
   if(options.all)callback(null,eligible);
   else callback(null,eligible[0].address,eligible[0].family);
  }).catch(error=>callback(Object.assign(error instanceof Error?error:new Error('Адрес источника отклонён.'),{code:'EACCES'}),'',0));
 };
}

const publicDispatcher=new Agent({connect:{lookup:createPublicLookup()}});

export async function fetchPublicUrl(value:string,init:UndiciRequestInit={},allowedHosts?:string):Promise<Response>{
 const url=await assertPublicUrl(value,allowedHosts);
 return await undiciFetch(url,{...init,dispatcher:publicDispatcher}) as unknown as Response;
}

export async function readLimited(response:Response,maxBytes=2_000_000){const reader=response.body?.getReader();if(!reader)throw new Error('Пустой ответ страницы.');let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('Страница слишком большая для обработки.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);}
