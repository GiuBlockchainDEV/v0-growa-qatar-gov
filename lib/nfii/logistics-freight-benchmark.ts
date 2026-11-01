/**
 * Optional commercial freight pricing via published Freightos marketplace
 * ESTIMATE endpoint. A benchmark is NOT an accepted carrier quotation.
 * Dry, non-hazardous FCL cargo only; reefer cargo is explicitly unsupported.
 */
import {getExportHub,QATAR_PORT} from './logistics-lanes'
const QAR_PER_USD=3.64
type Json=Record<string,unknown>
const obj=(x:unknown):Json=>x&&typeof x==='object'&&!Array.isArray(x)?x as Json:{}
const numeric=(x:unknown):number|null=>{
  const n=typeof x==='string'&&x.trim()?Number(x):typeof x==='number'?x:NaN
  return Number.isFinite(n)&&n>0?n:null
}
export type FreightEstimate={
  mode:'sea';amountMinQar:number;amountMaxQar:number
  perKgMinQar:number;perKgMaxQar:number
  daysMin:number|null;daysMax:number|null
  load:'container40';source:'freightos_marketplace_estimate'
  checkedAt:string;sourceUrl:'https://ship.freightos.com'
}
export type FreightEstimateStatus='available'|'no_coverage'|'unavailable'|'not_applicable'
export type FreightResult={estimate:FreightEstimate|null;status:FreightEstimateStatus;message:string}

export function parseFreightosEstimate(payload:unknown,tonnes:number):FreightEstimate|null{
  const response=obj(obj(payload).response)
  const estimated=obj(response.estimatedFreightRates)
  const raw=estimated.mode
  const variants=Array.isArray(raw)?raw:[raw]
  const selected=variants.map(obj).find(x=>String(x.mode).toUpperCase()==='FCL')
  if(!selected||!Number.isFinite(tonnes)||tonnes<=0)return null
  const price=obj(selected.price),min=obj(obj(price.min).moneyAmount),
    max=obj(obj(price.max).moneyAmount)
  if(min.currency!=='USD'||max.currency!=='USD')return null
  const a=numeric(min.amount),b=numeric(max.amount)
  if(a===null||b===null||b<a||b/a>20)return null
  const transit=obj(selected.transitTimes)
  const dmin=numeric(transit.min),dmax=numeric(transit.max)
  const daysOk=transit.unit==='days'&&dmin!==null&&dmax!==null&&
    dmin<=dmax&&dmax<=120
  return {
    mode:'sea',amountMinQar:Math.round(a*QAR_PER_USD*100)/100,
    amountMaxQar:Math.round(b*QAR_PER_USD*100)/100,
    perKgMinQar:Math.round(a*QAR_PER_USD/tonnes/1000*1000)/1000,
    perKgMaxQar:Math.round(b*QAR_PER_USD/tonnes/1000*1000)/1000,
    daysMin:daysOk?dmin:null,daysMax:daysOk?dmax:null,
    load:'container40',source:'freightos_marketplace_estimate',
    sourceUrl:'https://ship.freightos.com',
    checkedAt:new Date().toISOString(),
  }
}

export async function fetchFreightEstimate(country:string,tonnes:number,
  coldChain:boolean):Promise<FreightResult>{
  if(coldChain)return {estimate:null,status:'not_applicable',
    message:'Freightos standard container rate cannot price refrigerated food.'}
  if(!Number.isFinite(tonnes)||tonnes<1||tonnes>22)
    return {estimate:null,status:'not_applicable',
      message:'Marketplace FCL benchmark shown only for 1-22 t dry standard-container loads.'}
  const hub=getExportHub(country)
  if(!hub)return {estimate:null,status:'not_applicable',message:'No origin port.'}
  const url=new URL('https://ship.freightos.com/api/shippingCalculator')
  url.searchParams.set('estimate','true')
  url.searchParams.set('format','json')
  url.searchParams.set('currency','USD')
  url.searchParams.set('mode','FCL')
  url.searchParams.set('loadtype','container40')
  url.searchParams.set('weight',String(Math.round(tonnes*1000)))
  url.searchParams.set('quantity','1')
  url.searchParams.set('origin',hub.unlocode)
  url.searchParams.set('destination',QATAR_PORT.code)
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(7200),
      next:{revalidate:14400},headers:{Accept:'application/json'}})
    if(!response.ok)return {estimate:null,status:'unavailable',
      message:'Freightos marketplace API HTTP '+response.status}
    const content=await response.text()
    if(content.length>150000)return {estimate:null,status:'unavailable',
      message:'Freight response size exceeded safety limit.'}
    const parsed=parseFreightosEstimate(JSON.parse(content) as unknown,tonnes)
    return parsed?{estimate:parsed,status:'available',
      message:'Historical/marketplace FCL estimate, not cold-chain or final carrier quote.'}:
      {estimate:null,status:'no_coverage',
        message:'No matching public marketplace rate for this origin/Qatar.'}
  }catch{return {estimate:null,status:'unavailable',
    message:'Freightos public marketplace estimate unavailable.'}}
}
