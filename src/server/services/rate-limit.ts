const buckets=new Map<string,{start:number;count:number}>();
export function consumeRateLimit(request:Request,scope:string,limit=5){const now=Date.now(),ip=request.headers.get('x-real-ip')||'unknown',key=`${scope}:${ip}`,bucket=buckets.get(key);if(!bucket||now-bucket.start>=60000){buckets.set(key,{start:now,count:1});return true;}if(bucket.count>=limit)return false;bucket.count++;return true;}
