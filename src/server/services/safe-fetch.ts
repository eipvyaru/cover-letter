// Only public DNS hosts are accepted. A/AAAA records are checked before every redirect.
export function validateUrl(value:string):URL{
 let u:URL;try{u=new URL(value);}catch{throw new Error('Укажите корректную ссылку на страницу.');}
 const host=u.hostname.toLowerCase();
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||!host.includes('.')||host.endsWith('.')||/^(\d+\.){3}\d+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|lan|home|onion)$/.test(host))throw new Error('Разрешены только публичные HTTP/HTTPS страницы без пароля и нестандартного порта.');
 return u;
}
export function isPublicAddress(ip:string):boolean{
 if(ip.includes(':')){const v=ip.toLowerCase();return /^[23][0-9a-f]{0,3}:/.test(v)&&!v.startsWith('2001:db8:')&&!v.startsWith('2002:')&&!v.startsWith('2001:0:');}
 const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const[a,b]=p;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);
}
export async function assertPublicUrl(value:string){const u=validateUrl(value);let addresses:{address:string}[];try{addresses=await lookup(u.hostname,{all:true,verbatim:true});}catch{throw new Error('Не удалось проверить адрес источника.');}if(!addresses.length||addresses.some(({address})=>!isPublicAddress(address)))throw new Error('Адрес источника недоступен или указывает на закрытую сеть.');return u;}
export async function readLimited(response:Response,maxBytes=2_000_000){const reader=response.body?.getReader();if(!reader)throw new Error('Пустой ответ страницы.');let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('Страница слишком большая для обработки.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);}
import {lookup} from 'node:dns/promises';
