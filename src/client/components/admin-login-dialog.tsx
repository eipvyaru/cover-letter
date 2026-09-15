"use client";
import {useState} from 'react';
import {LockKeyhole,X} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose} from '@/components/ui/dialog';

export default function AdminLoginDialog(){
 const [open,setOpen]=useState(false),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,password})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Не удалось войти.');sessionStorage.setItem('hrletter.admin-login-complete','1');window.location.reload();}catch(e){setError(e instanceof Error?e.message:'Не удалось войти.');setBusy(false);}}
 return <Dialog open={open} onOpenChange={next=>{setOpen(next);if(next)setError('');}}>
  <DialogTrigger asChild><button type="button" className="secondary settings-button" aria-label="Вход администратора" title="Вход администратора"><LockKeyhole size={20}/></button></DialogTrigger>
  <DialogContent className="admin-login" showCloseButton={false}>
   <DialogHeader><DialogTitle>Вход администратора</DialogTitle><DialogDescription>Доступ к настройкам и истории генераций.</DialogDescription></DialogHeader>
   <DialogClose asChild><button type="button" className="settings-close" aria-label="Закрыть"><X size={20}/></button></DialogClose>
   <form onSubmit={submit}><label htmlFor="admin-login">Логин<input id="admin-login" autoComplete="username" required value={login} onChange={e=>setLogin(e.target.value)}/></label><label htmlFor="admin-password">Пароль<input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<DialogFooter><DialogClose asChild><button type="button" className="secondary">Отмена</button></DialogClose><button className="primary settings-save" type="submit" disabled={busy}>{busy?'Входим…':'Войти'}</button></DialogFooter></form>
  </DialogContent>
 </Dialog>;
}
