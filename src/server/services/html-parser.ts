import {load} from 'cheerio';

export async function extractText(html:string){
 const $=load(html);
 const title=normalize($('title').first().text());
 $('script,style,noscript,nav,header,footer,svg,form,iframe,[hidden],[aria-hidden="true"]').remove();
 $('[style]').each((_,element)=>{const style=($(element).attr('style')||'').replace(/\s+/g,'').toLowerCase();if(/(?:display:none|visibility:hidden|opacity:0)(?:!important)?(?:;|$)/.test(style))$(element).remove();});
 $('br,p,div,li,h1,h2,h3,section,tr').append('\n');
 const candidates=[$('[itemprop="description"],[data-qa="vacancy-description"]').text(),$('main').text(),$('article').text(),$('body').text()].map(normalize);
 const selected=candidates.find(text=>text.length>200)||candidates.at(-1)||'';
 return {text:selected,title};
}

function normalize(value:string){return value.replace(/[\u00a0\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
