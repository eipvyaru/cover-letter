import type {CanonicalContacts,ResumeContacts} from '@/shared/types';
export type {CanonicalContacts,ResumeContacts} from '@/shared/types';
export type ContactCheck={passed:boolean;warnings:string[]};
export type CanonicalContactSelection={contacts:CanonicalContacts;warnings:string[]};
export type NormalizedLetter={body:string;letter:string};

const EMAIL=/(?<![A-Z0-9._%+\-\\])[A-Z0-9](?:[A-Z0-9._%+\-]*[A-Z0-9])?@[A-Z0-9](?:[A-Z0-9.\-]*[A-Z0-9])?\.[A-Z]{2,}(?![A-Z0-9\-])/gi;
const TELEGRAM_LINK=/(?:https?:\/\/)?t\.me\/[A-Z0-9_]{5,}/gi;
const TELEGRAM_HANDLE=/(?<![A-Z0-9._%+\-])@[A-Z0-9_]{5,}(?![A-Z0-9_])/gi;
const PHONE=/(?:\+[ \t]*\d{1,3}|8)[\d \t()\-]{8,}\d/g;
const NAME=/^[А-ЯЁA-Z][а-яёa-z]+(?:[-'][А-ЯЁA-Z][а-яёa-z]+)?(?:\s+[А-ЯЁA-Z][а-яёa-z]+(?:[-'][А-ЯЁA-Z][а-яёa-z]+)?){1,3}$/u;

export function extractResumeContacts(resumeText:string):ResumeContacts{
 const contacts=extractContacts(resumeText);
 const name=resumeText.split(/\r?\n/).map(line=>line.trim()).find(line=>NAME.test(line));
 return {...(name?{name}:{}),...contacts};
}

export function chooseCanonicalContacts(resumeText:string,resumeContacts:ResumeContacts):CanonicalContactSelection{
 const contacts:CanonicalContacts={...(resumeContacts.name?{name:resumeContacts.name}:{})};
 const warnings:string[]=[];
 contacts.phone=chooseValue(resumeText,resumeContacts.phones);
 contacts.email=chooseValue(resumeText,resumeContacts.emails);
 contacts.telegram=chooseValue(resumeText,resumeContacts.telegrams);
 for(const [label,values,selected] of [
  ['email',resumeContacts.emails,contacts.email],['телефонов',resumeContacts.phones,contacts.phone],['Telegram',resumeContacts.telegrams,contacts.telegram],
 ] as const)if(values.length>1)warnings.push(`В RESUME_TEXT найдено несколько разных ${label}: ${values.join(', ')}. Каноническим выбран ${selected}.`);
 return {contacts,warnings};
}

export function normalizeAndAppendSignature(letter:string,canonical:CanonicalContacts):NormalizedLetter{
 const lines=letter.replace(/\r\n/g,'\n').trim().split('\n');
 let cut=lines.length;
 const tailStart=Math.max(0,lines.length-12);
 for(let index=lines.length-1;index>=tailStart;index--){
  const line=lines[index].trim();
  if(/^с уважением[!,.]?$/i.test(line)){cut=index;break;}
  if(canonical.name&&line.localeCompare(canonical.name,undefined,{sensitivity:'accent'})===0){cut=index;continue;}
 }
 if(cut===lines.length){
  while(cut>tailStart&&isContactOnlyLine(lines[cut-1]))cut--;
  if(cut>tailStart&&canonical.name&&lines[cut-1].trim().localeCompare(canonical.name,undefined,{sensitivity:'accent'})===0)cut--;
 }
 while(cut>0&&!lines[cut-1].trim())cut--;
 const body=lines.slice(0,cut).join('\n').trim();
 const signature=['С уважением,',canonical.name,canonical.phone,canonical.email,canonical.telegram?`Telegram: ${canonical.telegram}`:undefined].filter(Boolean).join('\n');
 return {body,letter:[body,signature].filter(Boolean).join('\n\n')};
}

export function validateFinalLetterContacts(letter:string,resumeContacts:ResumeContacts,canonical:CanonicalContacts):ContactCheck{
 const found=extractContacts(letter);const warnings:string[]=[];
 const resumeEmails=new Set(resumeContacts.emails.map(normalizeEmail));
 const resumePhones=new Set(resumeContacts.phones.map(normalizePhone));
 const resumeTelegrams=new Set(resumeContacts.telegrams.map(normalizeTelegram));
 for(const email of found.emails)if(!resumeEmails.has(normalizeEmail(email)))warnings.push(`В итоговом письме обнаружен email ${email}, которого нет среди контактов резюме.`);
 for(const phone of found.phones)if(!resumePhones.has(normalizePhone(phone)))warnings.push(`В итоговом письме обнаружен телефон ${phone}, которого нет среди контактов резюме.`);
 for(const telegram of found.telegrams)if(!resumeTelegrams.has(normalizeTelegram(telegram)))warnings.push(`В итоговом письме обнаружен Telegram ${telegram}, которого нет среди контактов резюме.`);
 const {email,phone,telegram}=canonical;
 if(email&&!found.emails.some(value=>normalizeEmail(value)===normalizeEmail(email)))warnings.push(`В итоговом письме отсутствует канонический email ${email}.`);
 if(phone&&!found.phones.some(value=>normalizePhone(value)===normalizePhone(phone)))warnings.push(`В итоговом письме отсутствует канонический телефон ${phone}.`);
 if(telegram&&!found.telegrams.some(value=>normalizeTelegram(value)===normalizeTelegram(telegram)))warnings.push(`В итоговом письме отсутствует канонический Telegram ${telegram}.`);
 return {passed:warnings.length===0,warnings};
}

export function withoutLLMContactWarnings(warnings:string[]){
 return warnings.filter(warning=>!/(?:e-?mail|электронн\w*\s+почт|телефон|telegram|телеграм|контакт\w*|[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i.test(warning));
}

function extractContacts(text:string):Omit<ResumeContacts,'name'>{
 const emails=unique(text.match(EMAIL)||[],normalizeEmail);
 const phones=unique((text.match(PHONE)||[]).map(value=>value.trim()).filter(value=>{const digits=normalizePhone(value).length;return digits>=10&&digits<=15;}),normalizePhone);
 const telegrams=unique([...(text.match(TELEGRAM_LINK)||[]),...(text.match(TELEGRAM_HANDLE)||[])],normalizeTelegram);
 return {emails,phones,telegrams};
}
function chooseValue(text:string,values:string[]){
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 const nonEmpty=lines.map(line=>line.trim()).filter(Boolean);
 return [...values].sort((left,right)=>contactRank(right)-contactRank(left)||values.indexOf(left)-values.indexOf(right))[0];
 function contactRank(value:string){
  const key=contactKey(value);let section='';let best=0;
  for(let index=0;index<lines.length;index++){
   const line=lines[index].trim();
   if(/^(контакты|обо мне)\s*:?$/i.test(line))section=line.toLowerCase();
   if(!contactKey(line).includes(key))continue;
   if(/предпочитаем|предпочтительн|основн\w*\s+способ\w*\s+связ/i.test(line))best=Math.max(best,3);
   else if(nonEmpty.indexOf(line)<20)best=Math.max(best,2);
   else if(/контакты|обо мне/.test(section))best=Math.max(best,1);
  }
  return best;
 }
}
function isContactOnlyLine(line:string){
 const value=line.trim().replace(/^(?:e-?mail|телефон|мобильный|telegram|телеграм)\s*:\s*/i,'');
 if(!value)return false;
 const contacts=extractContacts(value);
 return contacts.emails.length+contacts.phones.length+contacts.telegrams.length>0;
}
function contactKey(value:string){return value.toLowerCase().replace(/[\s()\-]/g,'');}
function unique(values:string[],key:(value:string)=>string){const seen=new Set<string>();return values.map(value=>value.trim().replace(/[.,;:!?]+$/,'')).filter(value=>{const normalized=key(value);if(!normalized||seen.has(normalized))return false;seen.add(normalized);return true;});}
function normalizeEmail(value:string){return value.trim().toLowerCase();}
function normalizePhone(value:string){return value.replace(/\D/g,'');}
function normalizeTelegram(value:string){return value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^t\.me\//,'').replace(/^@/,'');}
