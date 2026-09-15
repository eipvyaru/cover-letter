import type {Model} from '@/shared/types';
export type Settings = Record<string,string|undefined>;
export function runtimeSettings():Settings{return process.env;}
export function routerSettings(env:Settings){return {endpoint:env.LLM_API_ENDPOINT||'',key:env.LLM_API_KEY||''};}
export function configuredModels(env:Settings):Model[]{
 const defaultId=env.LLM_DEFAULT_MODEL||env.LLM||'';
 if(env.LLM_MODELS_JSON){const rows=JSON.parse(env.LLM_MODELS_JSON);if(!Array.isArray(rows))throw new Error('Некорректная конфигурация моделей.');return rows.filter((m:Model)=>m.enabled&&typeof m.modelId==='string'&&typeof m.name==='string').map((m:Model)=>({...m,isDefault:m.modelId===defaultId||m.isDefault}));}
 return defaultId?[{name:defaultId.split('/').pop()!.replace(/-/g,' '),modelId:defaultId,enabled:true,isDefault:true}]:[];
}
