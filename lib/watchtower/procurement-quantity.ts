import type {FoodPostureCommodity} from './food-posture'

export type QuantityBasis='reviewed_deficit'|'reserve_replenishment'|'weekly_consumption'|'planning_lot'
export type QuantitySuggestion={
 tonnes:number;basis:QuantityBasis;label:string;explanation:string
 verifiedDemand:boolean;uncappedTonnes:number|null
}
const round=(v:number)=>Math.round(v*10)/10
const clamp=(v:number)=>Math.max(0.1,Math.min(600,round(v)))
const positive=(n:number|null|undefined):n is number=>
 typeof n==='number'&&Number.isFinite(n)&&n>0

/**
 * A recommendation must be traceable to the selected organization's balance.
 * When demand evidence is missing, 20t is a *pricing comparison lot*, not
 * an inferred national requirement or a legally approved procurement need.
 */
export function suggestProcurementQuantity(
 commodity:Pick<FoodPostureCommodity,
 'status'|'deficitTonnes'|'coverageDays'|'consumptionTonnes'>,
 periodDays:number,
 sourceMode:'live'|'demo',
):QuantitySuggestion {
 if(sourceMode==='live'&&commodity.status==='complete'&&positive(commodity.deficitTonnes)){
  const qty=commodity.deficitTonnes
  return {tonnes:clamp(qty),uncappedTonnes:round(qty),basis:'reviewed_deficit',
   verifiedDemand:true,label:'Reviewed projected deficit',
   explanation:qty>600?
    'First purchasing tranche of 600 t; total reviewed shortfall '+round(qty)+' t.':
    'Suggested directly from the reviewed organization food-balance shortfall.'}
 }
 if(sourceMode==='live'&&commodity.status==='complete'&&positive(commodity.consumptionTonnes)&&
  Number.isFinite(periodDays)&&periodDays>0){
  const daily=commodity.consumptionTonnes/periodDays
  if(commodity.coverageDays!==null&&Number.isFinite(commodity.coverageDays)&&
   commodity.coverageDays<30){
    const raw=daily*(30-Math.max(commodity.coverageDays,0))
    if(raw>0)return {tonnes:clamp(raw),uncappedTonnes:round(raw),
     basis:'reserve_replenishment',verifiedDemand:false,
     label:'Proposed 30-day coverage top-up',
     explanation:'Planning assumption: average reviewed daily consumption '+round(daily)+
      ' t/day × days required to reach a 30-day buffer. Not an approved order.'}
  }
  if(daily>0)return {tonnes:clamp(7*daily),uncappedTonnes:round(7*daily),
   basis:'weekly_consumption',verifiedDemand:false,
   label:'Seven-day demand research batch',
   explanation:'Planning assumption: 7 days × reviewed daily consumption of '+
    round(daily)+' t/day, not a verified shortage.'}
 }
 return {tonnes:20,uncappedTonnes:null,basis:'planning_lot',verifiedDemand:false,
  label:'20 t indicative logistics lot',
  explanation:'No verified demand baseline for this commodity. 20 t is only a '+
   'comparative sourcing/logistics scenario, NOT a suggested national purchase volume.'}
}
export function parseRequestedTonnes(value:string):number|null{
 if(!/^\d{1,3}(?:\.\d{1,3})?$/.test(value.trim()))return null
 const qty=Number(value)
 return Number.isFinite(qty)&&qty>=0.1&&qty<=600?qty:null
}
