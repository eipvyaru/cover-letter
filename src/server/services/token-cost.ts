import type {TokenCost} from '@/shared/types';

type Price={inputRubPerMillion:number;outputRubPerMillion:number};
type Rate={value:number;date:string};
const priceCache=new Map<string,{expiresAt:number;price:Price}>();
let cachedRate:({expiresAt:number}&Rate)|undefined;

function numberFromRussian(value:string){return Number(value.replace(/[^\d,]/g,'').replace(',','.'));}

async function getModelPrice(modelId:string):Promise<Price>{
 const cached=priceCache.get(modelId);if(cached&&cached.expiresAt>Date.now())return cached.price;
 const response=await fetch(`https://proxyapi.ru/models/${modelId}`,{headers:{'User-Agent':'HRLetter/1.0'},signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw new Error(`каталог ProxyAPI ответил HTTP ${response.status}`);
 const html=await response.text();
 const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ');
 const pair=text.match(/Ввод\s*\/\s*Вывод\s*([\d\s]+(?:,\d+)?)\s*₽\s*\/\s*([\d\s]+(?:,\d+)?)\s*₽/i);
 if(!pair)throw new Error('в каталоге ProxyAPI не найдены цены модели');
 const price={inputRubPerMillion:numberFromRussian(pair[1]),outputRubPerMillion:numberFromRussian(pair[2])};
 if(!price.inputRubPerMillion||!price.outputRubPerMillion)throw new Error('каталог ProxyAPI вернул некорректные цены');
 priceCache.set(modelId,{price,expiresAt:Date.now()+6*60*60*1000});return price;
}

export async function getUsdRubRate():Promise<Rate>{
 if(cachedRate&&cachedRate.expiresAt>Date.now())return cachedRate;
 const response=await fetch('https://www.cbr.ru/scripts/XML_daily.asp',{headers:{'User-Agent':'HRLetter/1.0'},signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw new Error(`ЦБ РФ ответил HTTP ${response.status}`);
 const xml=await response.text();
 const usd=xml.match(/<Valute ID="R01235">[\s\S]*?<Nominal>([^<]+)<\/Nominal>[\s\S]*?<Value>([^<]+)<\/Value>/),date=xml.match(/<ValCurs[^>]*Date="([^"]+)"/);
 if(!usd)throw new Error('в ответе ЦБ РФ нет курса доллара США');
 const value=Number(usd[2].replace(',','.'))/Number(usd[1].replace(',','.'));
 if(!Number.isFinite(value)||value<=0)throw new Error('ЦБ РФ вернул некорректный курс доллара США');
 cachedRate={value,date:date?.[1]||new Date().toLocaleDateString('ru-RU'),expiresAt:Date.now()+6*60*60*1000};return cachedRate;
}

export async function calculateTokenCost(modelId:string,statistics:Record<string,number|null>):Promise<TokenCost|undefined>{
 const input=(statistics.inputTokens||0)+(statistics.qualityInputTokens||0),output=(statistics.outputTokens||0)+(statistics.qualityOutputTokens||0);
 if(!input&&!output)return undefined;
 const [price,rate]=await Promise.all([getModelPrice(modelId),getUsdRubRate()]);
 const multiplier=2,rub=multiplier*(input*price.inputRubPerMillion+output*price.outputRubPerMillion)/1_000_000;
 return {rub,usd:rub/rate.value,usdRubRate:rate.value,rateDate:rate.date,inputTokens:input,outputTokens:output,inputRubPerMillion:price.inputRubPerMillion,outputRubPerMillion:price.outputRubPerMillion,multiplier};
}
