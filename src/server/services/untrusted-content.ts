export type PreparedUntrustedContent={text:string;warnings:string[]};

const CONTROL_CHARACTERS=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const BOUNDARY_MARKERS=/\b(?:BEGIN|END)_UNTRUSTED_[A-Z_]+\b/gi;
const INJECTION_PATTERNS=[
 /\b(?:ignore|disregard|forget|override)\b.{0,100}\b(?:previous|prior|system|developer|instruction|prompt|rules?)\b/i,
 /\b(?:reveal|show|print|repeat|return|expose)\b.{0,100}\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/i,
 /(?:игнорир|забудь|отмени|переопредели)\w*.{0,100}(?:предыдущ|системн|инструкц|промпт|правил)/i,
 /(?:покажи|раскрой|выведи|повтори)\w*.{0,100}(?:системн|developer|промпт|инструкц)/i,
 /^\s*(?:system|developer|assistant)\s*:/i,
 /["']?checks["']?\s*:\s*\{[^\n]{0,200}\btrue\b/i,
];

export function prepareUntrustedContent(value:string,label:string):PreparedUntrustedContent{
 let escapedMarkers=0;
 const normalized=value.replace(/\r\n?/g,'\n').replace(CONTROL_CHARACTERS,'').replace(BOUNDARY_MARKERS,()=>{escapedMarkers++;return '[Исключён поддельный маркер границы]';});
 let removed=0;
 const lines=normalized.split('\n').map(line=>{
  if(INJECTION_PATTERNS.some(pattern=>pattern.test(line))){removed++;return `[Исключена потенциальная инструкция из ${label}]`;}
  return line;
 });
 const warnings:string[]=[];
 if(removed)warnings.push(`В ${label} исключено потенциальных инструкций: ${removed}. Проверьте исходный текст.`);
 if(escapedMarkers)warnings.push(`В ${label} исключено поддельных маркеров границы: ${escapedMarkers}.`);
 return {text:lines.join('\n').trim(),warnings};
}

export function wrapUntrustedContent(label:string,value:string){
 const escaped=value.replace(BOUNDARY_MARKERS,'[Исключён поддельный маркер границы]');
 return `BEGIN_UNTRUSTED_${label}\n${escaped}\nEND_UNTRUSTED_${label}`;
}

export function containsPromptLeak(output:string,systemPrompt:string){
 const normalize=(value:string)=>value.toLowerCase().replace(/\s+/g,' ').trim();
 const candidate=normalize(output);const protectedText=normalize(systemPrompt);
 const chunkLength=320;
 if(candidate.length<chunkLength||protectedText.length<chunkLength)return false;
 for(let offset=0;offset+chunkLength<=protectedText.length;offset+=160)if(candidate.includes(protectedText.slice(offset,offset+chunkLength)))return true;
 return false;
}
