'use client';

import Script from 'next/script';
import {usePathname,useSearchParams} from 'next/navigation';
import {useEffect} from 'react';

const COUNTER_ID=112797266;

declare global{
 interface Window{
  ym?:(counterId:number,method:string,...args:unknown[])=>void;
  __coverLetterMetrikaUrl?:string;
 }
}

export default function YandexMetrika(){
 const pathname=usePathname(),query=useSearchParams().toString();
 useEffect(()=>{
  if(typeof window.ym!=='function')return;
  const url=window.location.href,referer=window.__coverLetterMetrikaUrl||document.referrer;
  if(window.__coverLetterMetrikaUrl===url)return;
  window.ym(COUNTER_ID,'hit',url,{title:document.title,referer});
  window.__coverLetterMetrikaUrl=url;
 },[pathname,query]);
 return <Script id="yandex-metrika" strategy="afterInteractive">{`
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
  })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}','ym');
  ym(${COUNTER_ID},'init',{defer:true,ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',accurateTrackBounce:true,trackLinks:true});
  ym(${COUNTER_ID},'hit',window.location.href,{title:document.title,referer:document.referrer});
  window.__coverLetterMetrikaUrl=window.location.href;
 `}</Script>;
}
