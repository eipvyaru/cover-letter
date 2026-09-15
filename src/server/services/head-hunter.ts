import {extractText} from './html-parser';
export function headHunterVacancyEndpoint(value:string):string|null{
 const url=new URL(value);if(url.hostname!=='hh.ru'&&!url.hostname.endsWith('.hh.ru'))return null;
 const match=url.pathname.match(/^\/vacancy\/(\d+)\/?$/);return match?`https://api.hh.ru/vacancies/${match[1]}`:null;
}
export async function headHunterVacancyText(body:string){
 const data=JSON.parse(body) as Record<string,unknown>;
 if(typeof data.name!=='string'||typeof data.description!=='string')throw new Error('API HeadHunter не вернул название и описание вакансии. Вставьте текст вакансии вручную.');
 const description=(await extractText(`<html><body><main>${data.description}</main></body></html>`)).text;
 const fields:Record<string,string>={name:'Название вакансии',employer:'Работодатель',area:'Регион',address:'Адрес',salary:'Зарплата',salary_range:'Условия оплаты',experience:'Опыт работы',employment:'Занятость',schedule:'График',work_format:'Формат работы',working_hours:'Рабочие часы',work_schedule_by_days:'Рабочие дни',key_skills:'Ключевые навыки',professional_roles:'Профессиональные роли',archived:'Вакансия в архиве',published_at:'Дата публикации'};
 const lines=Object.entries(fields).filter(([key])=>data[key]!==undefined&&data[key]!==null).map(([key,label])=>`${label}: ${typeof data[key]==='string'?data[key]:JSON.stringify(data[key])}`);
 return lines.join('\n')+'\n\nОписание вакансии:\n'+description;
}
