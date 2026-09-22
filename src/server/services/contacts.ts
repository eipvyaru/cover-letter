import type {ResumeContacts} from '@/shared/types';
export type {ResumeContacts} from '@/shared/types';
export type ContactCheck={passed:boolean;warnings:string[]};

const EMAIL=/(?<![A-Z0-9._%+\-\\])[A-Z0-9](?:[A-Z0-9._%+\-]*[A-Z0-9])?@[A-Z0-9](?:[A-Z0-9.\-]*[A-Z0-9])?\.[A-Z]{2,}(?![A-Z0-9\-])/gi;
const TELEGRAM_LINK=/(?:https?:\/\/)?t\.me\/[A-Z0-9_]{5,}/gi;
const TELEGRAM_HANDLE=/(?<![A-Z0-9._%+\-])@[A-Z0-9_]{5,}(?![A-Z0-9_])/gi;
const PHONE=/(?:\+[ \t]*\d{1,3}|8)[\d \t()\-]{8,}\d/g;

export function extractResumeContacts(resumeText:string):ResumeContacts{return extractContacts(resumeText);}

export function validateLetterContacts(letter:string,resumeContacts:ResumeContacts):ContactCheck{
 const letterContacts=extractContacts(letter);const warnings:string[]=[];
 const resumeEmails=new Set(resumeContacts.emails.map(normalizeEmail));
 const resumePhones=new Set(resumeContacts.phones.map(normalizePhone));
 const resumeTelegrams=new Set(resumeContacts.telegrams.map(normalizeTelegram));
 for(const email of letterContacts.emails)if(!resumeEmails.has(normalizeEmail(email)))warnings.push(`В сопроводительном письме указан email ${email}, который не найден в RESUME_TEXT.`);
 for(const phone of letterContacts.phones)if(!resumePhones.has(normalizePhone(phone)))warnings.push(`В сопроводительном письме указан телефон ${phone}, который не найден в RESUME_TEXT.`);
 for(const telegram of letterContacts.telegrams)if(!resumeTelegrams.has(normalizeTelegram(telegram)))warnings.push(`В сопроводительном письме указан Telegram ${telegram}, который не найден в RESUME_TEXT.`);
 return {passed:warnings.length===0,warnings};
}

export function withoutLLMContactWarnings(warnings:string[]){
 return warnings.filter(warning=>!/(?:e-?mail|электронн\w*\s+почт|телефон|telegram|телеграм|контакт\w*|[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i.test(warning));
}

function extractContacts(text:string):ResumeContacts{
 const emails=unique(text.match(EMAIL)||[],normalizeEmail);
 const phones=unique((text.match(PHONE)||[]).map(value=>value.trim()).filter(value=>{const digits=normalizePhone(value).length;return digits>=10&&digits<=15;}),normalizePhone);
 const telegrams=unique([...(text.match(TELEGRAM_LINK)||[]),...(text.match(TELEGRAM_HANDLE)||[])],normalizeTelegram);
 return {emails,phones,telegrams};
}
function unique(values:string[],key:(value:string)=>string){const seen=new Set<string>();return values.filter(value=>{const normalized=key(value.trim());if(!normalized||seen.has(normalized))return false;seen.add(normalized);return true;}).map(value=>value.trim());}
function normalizeEmail(value:string){return value.trim().toLowerCase();}
function normalizePhone(value:string){return value.replace(/\D/g,'');}
function normalizeTelegram(value:string){return value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^t\.me\//,'').replace(/^@/,'');}
