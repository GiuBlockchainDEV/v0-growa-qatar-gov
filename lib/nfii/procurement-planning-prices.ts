/**
 * Historical Qatar-import-based planning prices by country/area.
 * These ARE NOT supplier quotations, farm-gate prices or 2026 spot prices.
 * Customs unit values can be CIF-like and may already include freight.
 */
import type {OriginPriceReport} from './origin-price-model'
import {QAR_PER_USD} from './origin-price-model'
import type {Wits2024Snapshot} from './wits-2024-prices'

export type PlanningPriceKind='origin_customs'|'regional_proxy'|'national_proxy'
export type PlanningPriceReference={
 kind:PlanningPriceKind
 countryCode:string
 area:string
 year:number
 unitQarPerKg:number
 lowQarPerKg:number
 highQarPerKg:number
 sourceName:string
 sourceUrl:string|null
 comparisonOrigins:number
 /**
  * Observed historical CIF-like import unit values, not a local supplier offer.
  * Scenario ranges are descriptive planning buffers, not statistical intervals.
  */
 basis:string
}
const REGIONS:Readonly<Record<string,string>>={
 'Gulf':'QA AE SA OM BH KW',
 'Levant':'JO LB PS SY IQ IL CY',
 'North Africa':'EG DZ TN MA LY SD',
 'Southern Europe':'ES IT PT GR MT',
 'North and West Europe':'DE FR NL BE CH AT GB IE DK NO SE FI LU IS',
 'Eastern Europe and Black Sea':'RU UA RO BG PL CZ SK HU HR RS MD BY TR GE AM AZ AL SI BA ME MK EE LV LT',
 'South Asia':'IN PK BD LK NP AF BT MV',
 'Southeast Asia':'TH VN MY ID PH SG KH LA MM BN TL',
 'East and Central Asia':'CN JP KR TW HK MN KZ UZ TJ TM KG',
 'East Africa':'KE ET UG TZ RW BI DJ SO ER SS',
 'West and Central Africa':'NG GH CI SN CM GN BJ BF ML NE TG GM SL LR GA CG CD CF',
 'Southern Africa':'ZA ZW ZM MW MZ BW NA LS SZ AO',
 'North America':'US CA MX',
 'Latin America':'BR AR UY PY CL CO PE EC BO VE GY SR CR GT HN NI PA',
 'Oceania':'AU NZ FJ PG',
}
const AREA_BY_COUNTRY=new Map(
 Object.entries(REGIONS).flatMap(([area,values])=>
  values.split(' ').map(code=>[code,area] as const)))
export const procurementArea=(countryCode:string)=>AREA_BY_COUNTRY.get(countryCode)??null
const round=(n:number)=>Math.round(n*1000)/1000
const good=(n:number|null|undefined):n is number=>
 typeof n==='number'&&Number.isFinite(n)&&n>0
const median=(values:readonly number[]):number=>{
 const sorted=[...values].sort((a,b)=>a-b)
 const mid=Math.floor(sorted.length/2)
 return sorted.length%2===0?(sorted[mid-1]+sorted[mid])/2:sorted[mid]
}
function reference(countryCode:string,area:string,kind:PlanningPriceKind,
 value:number,year:number,sourceName:string,sourceUrl:string|null,
 comparisonOrigins:number,basis:string):PlanningPriceReference{
 // Deliberate scenario buffers: 20% observed, 30% regional, 40% national.
 // No invented current-market precision or implied confidence interval.
 const buffer=kind==='origin_customs'?.2:kind==='regional_proxy'?.3:.4
 return {countryCode,area,kind,year,unitQarPerKg:round(value),
  lowQarPerKg:round(value*(1-buffer)),
  highQarPerKg:round(value*(1+buffer)),
  sourceName,sourceUrl,comparisonOrigins,basis}
}
export function estimateAreaPlanningPrice(
 countryCode:string,report:OriginPriceReport,
 snapshot:Wits2024Snapshot|null,
):PlanningPriceReference|null{
 // Live/currently selected annual Comtrade observations remain the first priority.
 const direct=report.origins.find(row=>row.countryCode===countryCode&&
  good(row.unitValueQarKg))
 if(direct&&report.analyzedYear!==null){
  return reference(countryCode,countryCode,'origin_customs',
   direct.unitValueQarKg,direct.sourceYear,report.sourceName,report.sourceUrl,
   1,'Observed Qatar import unit value for the country of origin')
 }
 const weightMin=report.annualMinimumTonnes*1000
 const witsPartners=snapshot?.observation.partners.filter(row=>
  row.importWeightKg>=weightMin&&row.importValueUsd>=10000&&
  good(row.importValueUsd*QAR_PER_USD/row.importWeightKg))??[]
 const directWits=witsPartners.find(row=>row.countryCode===countryCode)
 if(directWits&&snapshot){
  return reference(countryCode,countryCode,'origin_customs',
   directWits.importValueUsd*QAR_PER_USD/directWits.importWeightKg,
   snapshot.year,snapshot.sourceName,snapshot.sourceUrls[0]??null,
   1,'Published 2024 Qatar import unit value for the country of origin')
 }
 const area=procurementArea(countryCode)
 if(area){
  const sameArea=report.origins.filter(row=>
   row.countryCode!==countryCode&&procurementArea(row.countryCode)===area&&
   good(row.unitValueQarKg))
  if(sameArea.length>=2&&report.analyzedYear!==null){
   return reference(countryCode,area,'regional_proxy',
    median(sameArea.map(row=>row.unitValueQarKg)),report.analyzedYear,
    report.sourceName,report.sourceUrl,sameArea.length,
    'Median of same-commodity Qatar import unit values from comparable origins in the named area')
  }
  const witsArea=witsPartners.filter(row=>procurementArea(row.countryCode)===area)
  if(witsArea.length>=2&&snapshot){
   return reference(countryCode,area,'regional_proxy',
    median(witsArea.map(row=>row.importValueUsd*QAR_PER_USD/row.importWeightKg)),
    snapshot.year,snapshot.sourceName,snapshot.sourceUrls[0]??null,
    witsArea.length,
    'Median of published 2024 same-commodity Qatar import unit values from the named area')
  }
 }
 // Wider same-commodity Qatar benchmark if no defensible regional observations.
 if(good(report.weightedAverageQarKg)&&report.analyzedYear!==null){
  return reference(countryCode,'Qatar import basket','national_proxy',
   report.weightedAverageQarKg,report.analyzedYear,report.sourceName,
   report.sourceUrl,report.origins.length,
   'National Qatar weighted import unit value; no country-specific or regional price evidence')
 }
 if(snapshot&&good(snapshot.worldImportWeightKg)&&good(snapshot.worldImportValueUsd)){
  return reference(countryCode,'Qatar import basket','national_proxy',
   snapshot.worldImportValueUsd*QAR_PER_USD/snapshot.worldImportWeightKg,
   snapshot.year,snapshot.sourceName,snapshot.sourceUrls[0]??null,
   snapshot.observation.partners.length,
   'Published 2024 Qatar-wide same-commodity import unit value; origin not priced')
 }
 return null
}
