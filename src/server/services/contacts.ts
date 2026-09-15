export function ensureResumeContacts(letter:string,resumeText:string):string{
 const contacts=extractContacts(resumeText);const missing:string[]=[];
 if(contacts.phone&&!letter.includes(contacts.phone))missing.push(`Телефон: ${contacts.phone}`);
 if(contacts.email&&!letter.toLowerCase().includes(contacts.email.toLowerCase()))missing.push(`Email: ${contacts.email}`);
 if(contacts.telegram&&!letter.toLowerCase().includes(contacts.telegram.toLowerCase()))missing.push(`Telegram: ${contacts.telegram}`);
 return missing.length?`${letter.trim()}\n\n${missing.join('\n')}`:letter;
}

export function extractContacts(text:string){
 const email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
 const telegram=text.match(/(?:https?:\/\/)?t\.me\/[A-Z0-9_]{5,}/i)?.[0]||text.match(/(^|[\s(])(@[A-Z0-9_]{5,})(?=$|[\s),.;])/im)?.[2]||'';
 const candidates=text.match(/(?:\+\s*\d{1,3}|8)[\d\s()\-]{8,}\d/g)||[];
 const phone=candidates.find(value=>{const digits=value.replace(/\D/g,'').length;return digits>=10&&digits<=15;})?.trim()||'';
 return {phone,email,telegram};
}
