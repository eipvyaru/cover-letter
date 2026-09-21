"use client";
import {useState} from 'react';
import {ArrowLeft, History, Settings, X} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose} from '@/components/ui/dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {Input,Model} from '@/shared/types';
export type GeneratorSettings=Pick<Input,'modelId'|'maxAttempts'|'retryInterval'|'temperature'|'maxOutputTokens'>;
type SettingsValue=GeneratorSettings;
type PromptItem={id:string;modifiedAt:string;active:boolean};
export default function SettingsDialog({value,models,disabled,historyCount,inHistory,onSave,onNavigateHistory}:{value:SettingsValue;models:Model[];disabled:boolean;historyCount:number;inHistory:boolean;onSave:(settings:SettingsValue)=>void;onNavigateHistory:()=>void}){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState<SettingsValue>(value);
 const [prompts,setPrompts]=useState<PromptItem[]>([]),[promptError,setPromptError]=useState(''),[promptBusy,setPromptBusy]=useState(false);
 async function requestPrompts(method:'GET'|'POST'|'PATCH',data?:unknown){
  const response=await fetch('/api/admin/prompts',{method,headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,cache:'no-store'});
  const result=await response.json() as {items?:PromptItem[];error?:string};
  if(!response.ok||!result.items)throw new Error(result.error||'Не удалось получить версии промпта.');
  setPrompts(result.items);
 }
 async function promptAction(action:()=>Promise<void>){setPromptBusy(true);setPromptError('');try{await action();}catch(error){setPromptError(error instanceof Error?error.message:'Ошибка работы с промптом.');}finally{setPromptBusy(false);}}
 const fixedTemperature=models.find(m=>m.modelId===draft.modelId)?.supportsTemperature===false;
 return <Dialog open={open} onOpenChange={next=>{if(next){setDraft({...value});void promptAction(()=>requestPrompts('GET'));}setOpen(next);}}>
  <DialogTrigger asChild><button type="button" className="secondary settings-button" aria-label="Настройки" title="Настройки" disabled={disabled}><Settings size={21} aria-hidden="true"/></button></DialogTrigger>
  <DialogContent className="generator-settings" showCloseButton={false}>
   <DialogHeader><DialogTitle>Настройки</DialogTitle><DialogDescription>Модель, чтение источников и параметры генерации письма.</DialogDescription></DialogHeader>
   <DialogClose asChild><button type="button" className="settings-close" aria-label="Закрыть настройки"><X size={20}/></button></DialogClose>
   <form onSubmit={e=>{e.preventDefault();if(!models.some(m=>m.modelId===draft.modelId))return;onSave({...draft,temperature:fixedTemperature?1:draft.temperature});setOpen(false);}}>
   <fieldset disabled={disabled}>
     <button type="button" className="settings-history" onClick={()=>{onNavigateHistory();setOpen(false);}}>{inHistory?<ArrowLeft size={18}/>:<History size={18}/>}<span>{inHistory?'Вернуться к генератору':'История генераций'}</span>{!inHistory&&historyCount>0&&<strong>{historyCount}</strong>}</button>
     <label htmlFor="settings-model">Модель LLM</label>
     <Select value={draft.modelId} onValueChange={modelId=>setDraft(d=>({...d,modelId,temperature:models.find(m=>m.modelId===modelId)?.supportsTemperature===false?1:.3}))}>
      <SelectTrigger id="settings-model" className="select-field"><SelectValue placeholder="GPT-5.6 Luna"/></SelectTrigger>
      <SelectContent>{models.map(m=><SelectItem key={m.modelId} value={m.modelId}>{m.name}</SelectItem>)}</SelectContent>
     </Select>
     <h3 className="section-title">Чтение источников</h3>
     <div className="row"><label htmlFor="settings-attempts">Максимальное количество попыток чтения<input id="settings-attempts" type="number" min={1} max={10} required value={draft.maxAttempts} onChange={e=>setDraft(d=>({...d,maxAttempts:e.target.valueAsNumber}))}/></label><label htmlFor="settings-interval">Интервал между попытками, секунд<input id="settings-interval" type="number" min={0} max={60} required value={draft.retryInterval} onChange={e=>setDraft(d=>({...d,retryInterval:e.target.valueAsNumber}))}/></label></div>
     <h3 className="section-title">Генерация</h3>
     <div className="row"><label htmlFor="settings-temperature">Температура<input id="settings-temperature" disabled={fixedTemperature} type="number" min={0} max={2} step={.1} required value={draft.temperature} onChange={e=>setDraft(d=>({...d,temperature:e.target.valueAsNumber}))}/></label><label htmlFor="settings-tokens">Лимит токенов ответа<input id="settings-tokens" type="number" min={2000} max={16000} step={500} required value={draft.maxOutputTokens} onChange={e=>setDraft(d=>({...d,maxOutputTokens:e.target.valueAsNumber}))}/></label></div>
     {fixedTemperature&&<p className="helper">Для этой модели температура фиксирована: 1.</p>}
     <h3 className="section-title">Системный промпт</h3>
     <p className="helper">Версии определяются датой изменения файла. Выбранная версия применяется к новым генерациям сразу после переключения.</p>
     <div className="prompt-list" aria-label="Версии системного промпта">{prompts.map(item=><div className="prompt-item" key={item.id}><span>{new Date(item.modifiedAt).toLocaleString('ru-RU')} <small>{item.id.slice(-15,-3)}</small></span>{item.active?<strong>Текущий</strong>:<button type="button" className="secondary" disabled={promptBusy} onClick={()=>void promptAction(()=>requestPrompts('PATCH',{id:item.id}))}>Выбрать</button>}</div>)}</div>
     <label htmlFor="prompt-upload" className="prompt-upload">Добавить версию (.md или .txt)<input id="prompt-upload" type="file" accept=".md,.txt,text/markdown,text/plain" disabled={promptBusy} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;void promptAction(async()=>{if(file.size>200_000)throw new Error('Файл слишком велик (максимум 200 КБ).');await requestPrompts('POST',{content:await file.text(),modifiedAt:file.lastModified});});}}/></label>
     {promptError&&<p className="error" role="alert">{promptError}</p>}
     <DialogFooter><button type="button" className="secondary admin-logout" onClick={()=>{void fetch('/api/admin/session',{method:'DELETE'}).then(()=>window.location.reload());}}>Выйти</button><DialogClose asChild><button type="button" className="secondary">Отмена</button></DialogClose><button type="submit" className="primary settings-save">Сохранить настройки</button></DialogFooter>
    </fieldset>
   </form>
  </DialogContent>
 </Dialog>;
}
