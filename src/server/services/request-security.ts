export function isSameOriginRequest(request:Request):boolean{
 const fetchSite=request.headers.get('sec-fetch-site')?.toLowerCase();
 if(fetchSite)return fetchSite==='same-origin';
 const origin=request.headers.get('origin');if(!origin)return true;
 let originHost:string;try{originHost=new URL(origin).host.toLowerCase();}catch{return false;}
 const hosts=new Set<string>();
 try{hosts.add(new URL(request.url).host.toLowerCase());}catch{}
 for(const name of ['host','x-forwarded-host','x-original-host']){const value=request.headers.get(name)?.split(',')[0]?.trim().toLowerCase();if(value)hosts.add(value);}
 const forwarded=request.headers.get('forwarded')?.match(/(?:^|;)\s*host=(?:"([^"]+)"|([^;,\s]+))/i);const forwardedHost=(forwarded?.[1]||forwarded?.[2]||'').toLowerCase();if(forwardedHost)hosts.add(forwardedHost);
 return hosts.has(originHost);
}
