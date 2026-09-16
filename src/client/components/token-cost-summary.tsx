import type {TokenCost} from '@/shared/types';

const rub=(value:number,minimumFractionDigits=2,maximumFractionDigits=2)=>value.toLocaleString('ru-RU',{minimumFractionDigits,maximumFractionDigits});
const usd=(value:number)=>value.toLocaleString('ru-RU',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:6});

export default function TokenCostSummary({cost,balanceRub}:{cost?:TokenCost;balanceRub?:number|null}){
 if(!cost&&balanceRub===undefined)return null;
 const balanceLabel=balanceRub===undefined?null:balanceRub===null?'Текущий баланс = недоступен':`Текущий баланс = ${rub(balanceRub)} ₽`;
 if(!cost)return <div className="token-cost token-cost-static" role="status">{balanceLabel}</div>;
 return <details className="token-cost"><summary>Стоимость токенов: {rub(cost.rub,2,4)} ₽ · {usd(cost.usd)}{balanceLabel&&<> · {balanceLabel}</>}</summary>{'inputTokens' in cost&&<div><span>Вход: {cost.inputTokens.toLocaleString('ru-RU')} × {cost.multiplier||1} × {cost.inputRubPerMillion.toLocaleString('ru-RU')} ₽ / 1 млн</span><span>Выход: {cost.outputTokens.toLocaleString('ru-RU')} × {cost.multiplier||1} × {cost.outputRubPerMillion.toLocaleString('ru-RU')} ₽ / 1 млн</span><span>Итого: {rub(cost.rub,4,6)} ₽ ÷ {rub(cost.usdRubRate,4,4)} ₽/$ = {usd(cost.usd)}</span><span>{usd(cost.usd)} × {rub(cost.usdRubRate,4,4)} ₽/$ = {rub(cost.rub,2,4)} ₽ · <a href="https://cbr.ru/currency_base/daily/" target="_blank" rel="noopener noreferrer">курс ЦБ РФ</a> на {cost.rateDate}</span></div>}</details>;
}
