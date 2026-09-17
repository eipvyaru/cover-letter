import type {TokenCost} from '@/shared/types';

export type Price={inputUsdPerMillion:number;outputUsdPerMillion:number};
export type Rate={value:number;date:string};
const priceCache=new Map<string,{expiresAt:number;price:Price}>();
let cachedRate:({expiresAt:number}&Rate)|undefined;

export const KODIKROUTER_CATALOG_URL='https://api.kodikrouter.ru/v1/catalog/models';
export function kodikRouterModelUrl(modelId:string){return `${KODIKROUTER_CATALOG_URL}/${encodeURIComponent(modelId)}`;}

async function getModelPrice(modelId:string):Promise<Price>{
 const cached=priceCache.get(modelId);if(cached&&cached.expiresAt>Date.now())return cached.price;
 const response=await fetch(kodikRouterModelUrl(modelId),{headers:{'User-Agent':'HRLetter/1.0'},signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw new Error(`каталог KodikRouter ответил HTTP ${response.status}`);
 const data=await response.json() as {input_price_per_1m?:unknown;output_price_per_1m?:unknown};
 const price={inputUsdPerMillion:Number(data.input_price_per_1m),outputUsdPerMillion:Number(data.output_price_per_1m)};
 if(!Number.isFinite(price.inputUsdPerMillion)||price.inputUsdPerMillion<0||!Number.isFinite(price.outputUsdPerMillion)||price.outputUsdPerMillion<0||(price.inputUsdPerMillion===0&&price.outputUsdPerMillion===0))throw new Error('каталог KodikRouter вернул некорректные цены');
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

export function estimateTokenCost(input:number,output:number,price:Price,rate:Rate):TokenCost{
 const usd=(input*price.inputUsdPerMillion+output*price.outputUsdPerMillion)/1_000_000,rub=usd*rate.value;
 return {rub,usd,usdRubRate:rate.value,rateDate:rate.date,inputTokens:input,outputTokens:output,inputRubPerMillion:price.inputUsdPerMillion*rate.value,outputRubPerMillion:price.outputUsdPerMillion*rate.value,multiplier:1};
}

export async function calculateTokenCost(modelId:string,statistics:Record<string,number|null>):Promise<TokenCost|undefined>{
 const input=(statistics.inputTokens||0)+(statistics.qualityInputTokens||0),output=(statistics.outputTokens||0)+(statistics.qualityOutputTokens||0);
 if(!input&&!output)return undefined;
 const [price,rate]=await Promise.all([getModelPrice(modelId),getUsdRubRate()]);
 return estimateTokenCost(input,output,price,rate);
}
