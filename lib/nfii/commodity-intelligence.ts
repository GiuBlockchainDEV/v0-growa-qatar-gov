import type {FoodBalanceResult} from '@/lib/food-security/balance'

export type CommoditySignalRisk='critical'|'high'|'attention'|'stable'|'unknown'
export type CommoditySignal={
 risk:CommoditySignalRisk
 coverageDays:number|null
 coverageFraction:number|null
 usableStockTonnes:number|null
 deficitTonnes:number|null
 availableTonnes:number|null
 requiredTonnes:number|null
 domesticShare:number|null
 importShare:number|null
 sourceCount:number
 complete:boolean
}
const measured=(value:number|null|undefined):value is number=>
 typeof value==='number'&&Number.isFinite(value)&&value>=0
/** Only complete reviewed organization balance inputs enter these visual signals.
 * A horizon accounting summary is NOT a daily stock forecast or reserve target.
 */
export function buildCommoditySignal(balance:FoodBalanceResult|null):CommoditySignal{
 const sourceCount=balance?.evidence.sourceRefs.length??0
 const empty:CommoditySignal={
  risk:'unknown',coverageDays:null,coverageFraction:null,
  usableStockTonnes:null,deficitTonnes:null,availableTonnes:null,
  requiredTonnes:null,domesticShare:null,importShare:null,
  sourceCount,complete:false,
 }
 if(!balance||balance.status!=='complete')return empty
 const t=balance.totals
 if(!measured(t.openingStockTonnes)||!measured(t.domesticProductionTonnes)||
  !measured(t.confirmedImportsTonnes)||!measured(t.consumptionTonnes)||
  !measured(t.lossesTonnes)||!measured(t.projectedClosingStockTonnes)||
  !measured(t.deficitTonnes))return empty
 const supply=t.openingStockTonnes+t.domesticProductionTonnes+t.confirmedImportsTonnes
 const required=t.consumptionTonnes+t.lossesTonnes
 const days=measured(t.projectedCoverageDays)?t.projectedCoverageDays:null
 const risk:CommoditySignalRisk=t.deficitTonnes>0||
  (days!==null&&days<7)?'critical':
  days===null?'unknown':days<14?'high':days<30?'attention':'stable'
 return {
  risk,coverageDays:days,
  coverageFraction:days===null?null:Math.min(1,days/30),
  usableStockTonnes:t.projectedClosingStockTonnes,
  deficitTonnes:t.deficitTonnes,
  availableTonnes:supply,requiredTonnes:required,
  domesticShare:supply>0?t.domesticProductionTonnes/supply:null,
  importShare:supply>0?t.confirmedImportsTonnes/supply:null,
  sourceCount,complete:true,
 }
}
