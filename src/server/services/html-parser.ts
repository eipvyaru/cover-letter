import {load} from 'cheerio';

export async function extractText(html:string){
 const $=load(html);const jobs:unknown[]=[];
 $('script[type="application/ld+json"]').each((_,element)=>{try{const data=JSON.parse($(element).text());const entries=Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data];for(const item of entries)if(item&&item['@type']==='JobPosting')jobs.push(item);}catch{}});
 const title=normalize($('title').first().text());
 $('script,style,noscript,nav,header,footer,svg,form,iframe').remove();
 $('br,p,div,li,h1,h2,h3,section,tr').append('\n');
 const candidates=[$('[itemprop="description"],[data-qa="vacancy-description"]').text(),$('main').text(),$('article').text(),$('body').text()].map(normalize);
 const selected=candidates.find(text=>text.length>200)||candidates.at(-1)||'';
 return {text:(jobs.length?'Структурированные данные вакансии:\n'+JSON.stringify(jobs)+'\n\n':'')+selected,title};
}

function normalize(value:string){return value.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
