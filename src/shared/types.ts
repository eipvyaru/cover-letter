export type Model = {name:string;modelId:string;enabled:boolean;isDefault?:boolean;supportsTemperature?:boolean};
export type Input = {vacancyUrl:string;resumeUrl:string;length:'short'|'standard'|'long';wishes:string;maxAttempts:number;retryInterval:number;modelId:string;temperature:number;maxOutputTokens:number;vacancyText?:string;resumeText?:string};
export type Attempt = {source:string;attempt:number;time:string;httpStatus:number|null;result:string;error?:string;durationMs:number;method:string};
export type Source = {url:string;text:string;method:string;status:string};
export type TokenCost = {usd:number;rub:number;usdRubRate:number;rateDate:string;inputTokens:number;outputTokens:number;inputRubPerMillion:number;outputRubPerMillion:number;multiplier:number};
export type Generation = {id:string;success:boolean;input:Input;llm:{name:string;modelId:string;temperature:number;maxOutputTokens:number;promptVersion:string;promptHash?:string};sources:{vacancy?:Source;resume?:Source};analysis:{text:string;title:string;company:string};fears:string[];matching:{fear:string;evidence:string;strength:string}[];letter:string;rawResponse:string;statistics:Record<string,number|null>;tokenCost?:TokenCost;execution:{startedAt:string;finishedAt:string;durationMs:number;attempts:Attempt[];errors:string[];warnings:string[];status:string};quality?:{passed:boolean;checks:Record<string,boolean>;warnings:string[]}};
export type Event = {type:'progress';message:string;attempt?:Attempt}|{type:'result';data:Generation};

