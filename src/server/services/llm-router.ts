import {routerSettings,configuredModels,type Settings} from '../config/llm-models';
export class LLMRouterClient {
 constructor(private env:Settings){}
 async complete({modelId,systemPrompt,userPrompt,temperature,maxOutputTokens}:{modelId:string;systemPrompt:string;userPrompt:string;temperature:number;maxOutputTokens:number}){
  const {endpoint,key}=routerSettings(this.env);if(!endpoint||!key)throw new Error('Не настроено подключение к LLM Router.');
  const target=new URL(endpoint.replace(/\/$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions');if(target.protocol!=='https:')throw new Error('LLM Router должен использовать HTTPS.');
  let response:Response;try{response=await fetch(target,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:modelId,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],...(configuredModels(this.env).find(m=>m.modelId===modelId)?.supportsTemperature===false?{}:{temperature}),max_completion_tokens:maxOutputTokens}),signal:AbortSignal.timeout(180000),redirect:'manual'});}catch{throw new Error('LLM Router не ответил за отведённое время или недоступен.');}
  if(!response.ok){await response.body?.cancel();const messages:Record<number,string>={401:'Ошибка авторизации LLM Router. Проверьте ключ.',402:'Недостаточно средств на балансе LLM Router.',403:'Доступ к модели запрещён.',404:'Выбранная модель или endpoint недоступны.',429:'Лимит запросов LLM Router. Повторите позже.'};throw new Error(messages[response.status]||`Ошибка LLM Router: HTTP ${response.status}. Проверьте модель и параметры.`);}
  const data=await response.json() as {choices?:{message?:{content?:string};finish_reason?:string}[];usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
  const raw=data.choices?.[0]?.message?.content;if(typeof raw!=='string'||!raw.trim())throw new Error('LLM вернула пустой ответ.');
  if(data.choices?.[0]?.finish_reason==='length')throw new Error('Ответ модели обрезан. Увеличьте лимит токенов ответа.');
  return {text:raw,usage:data.usage};
 }
}



