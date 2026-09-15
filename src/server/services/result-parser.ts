export function parseResult(raw:string){
 const names=['АНАЛИЗ ДАННЫХ','ВЫЯВЛЕННЫЕ СТРАХИ РАБОТОДАТЕЛЯ','СОПОСТАВЛЕНИЕ С РЕЗЮМЕ','ИТОГОВОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО','ИСПОЛЬЗОВАННЫЕ ИСТОЧНИКИ','СТАТИСТИКА'];
 const normalized=raw.replace(/^\s*#{1,6}\s*/gm,'').replace(/\*\*/g,'').replace(/^ИТОГОВОЕ ПИСЬМО\s*$/gm,names[3]);
 const sections=names.map((name,i)=>{const start=normalized.indexOf(name);if(start<0)return '';const end=names.slice(i+1).map(n=>normalized.indexOf(n,start+name.length)).find(n=>n>=0);return normalized.slice(start+name.length,end).trim();});
 const field=(name:string)=>(sections[0].match(new RegExp(name+':\\s*([^\\n]+)'))?.[1]||'').trim();
 const fears=sections[1].split(/\n(?=\d+[.)]\s)/).map(x=>x.trim()).filter(Boolean);
 const matching=sections[2].split('\n').filter(l=>l.includes('|')).map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim())).filter(c=>c.length>=3&&!/страх работодателя/i.test(c[0])&&!/^[-: ]+$/.test(c[0])).map(c=>({fear:c[0],evidence:c[1],strength:c[2]}));
 return {analysis:{text:sections[0],title:field('Название вакансии')||field('Должность'),company:field('Компания')},fears,matching,letter:sections[3]};
}
