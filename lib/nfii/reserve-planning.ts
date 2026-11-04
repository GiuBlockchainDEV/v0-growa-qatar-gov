import type {ReserveAgentReport,ReserveLotView} from './reserves-intelligence'

/**
 * Read-only reserve planning helpers. Never create release records, modify
 * inventory, double-count commitments or claim an official policy threshold.
 */
const round=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000
const finiteNonnegative=(n:unknown):n is number=>
 typeof n==='number'&&Number.isFinite(n)&&n>=0
export type ReserveCoverageTarget=14|30|60|90
export type ReserveCoveragePlan={
 commodityCode:string
 commodityName:string
 targetDays:ReserveCoverageTarget
 dailyDemandTonnes:number|null
 uncommittedTonnes:number
 coverageDays:number|null
 targetReserveTonnes:number|null
 suggestedReplenishmentTonnes:number|null
 sourceRefs:number
 status:'insufficient_evidence'|'below_target'|'at_target'
}
export function planReserveCoverage(
 coverage:Readonly<ReserveAgentReport['coverage']>,
 targetDays:ReserveCoverageTarget,
):ReserveCoveragePlan[]{
 const rows=coverage.map(row=>{
  const valid=finiteNonnegative(row.dailyDemand)&&row.dailyDemand>0&&
   finiteNonnegative(row.uncommittedTonnes)&&row.sourceRefs.length>0
  const target=valid?round(row.dailyDemand!*targetDays):null
  const needed=target===null?null:round(Math.max(0,target-row.uncommittedTonnes))
  const status:ReserveCoveragePlan['status']=needed===null?'insufficient_evidence':
   needed>0?'below_target':'at_target'
  return {
   commodityCode:row.commodityCode,commodityName:row.commodityName,
   targetDays,dailyDemandTonnes:valid?row.dailyDemand:null,
   uncommittedTonnes:row.uncommittedTonnes,
   coverageDays:valid?row.days:null,
   targetReserveTonnes:target,
   suggestedReplenishmentTonnes:needed,
   sourceRefs:row.sourceRefs.length,status,
  }
 })
 return rows.sort((a,b)=>{
  const order={below_target:0,insufficient_evidence:1,at_target:2}
  return order[a.status]-order[b.status]||
   (b.suggestedReplenishmentTonnes??0)-(a.suggestedReplenishmentTonnes??0)||
   a.commodityName.localeCompare(b.commodityName)
 })
}
export type FefoAllocation={
 lotId:string
 lotRef:string
 warehouse:string
 expiryDate:string
 daysToExpiry:number
 tonnes:number
 pendingRequestedTonnes:number
}
export type FefoPlan={
 commodityCode:string
 requestedTonnes:number
 availableTonnes:number
 allocatedTonnes:number
 shortfallTonnes:number
 allocations:FefoAllocation[]
 valid:boolean
}
export function planFefoRelease(
 lots:readonly ReserveLotView[],
 commodityCode:string,
 requestedTonnes:number,
):FefoPlan{
 const valid=finiteNonnegative(requestedTonnes)&&requestedTonnes<=1e9&&
  Boolean(commodityCode.trim())
 const request=valid?round(requestedTonnes):0
 const available=lots.filter(lot=>lot.eligible&&
  lot.commodityCode===commodityCode&&
  lot.daysToExpiry!==null&&lot.daysToExpiry>=0&&
  finiteNonnegative(lot.uncommittedTonnes)&&lot.uncommittedTonnes>0)
  .sort((a,b)=>(a.daysToExpiry??Infinity)-(b.daysToExpiry??Infinity)||
   a.reference.localeCompare(b.reference))
 const availableTonnes=round(available.reduce((n,lot)=>n+lot.uncommittedTonnes,0))
 const allocations:FefoAllocation[]=[]
 let left=request
 for(const lot of available){
  if(left<=0)break
  const taken=round(Math.min(left,lot.uncommittedTonnes))
  if(taken<=0)continue
  allocations.push({
   lotId:lot.id,lotRef:lot.reference,warehouse:lot.warehouse,
   expiryDate:lot.expiryDate!,daysToExpiry:lot.daysToExpiry!,
   tonnes:taken,pendingRequestedTonnes:lot.pendingRequestedTonnes,
  })
  left=round(Math.max(0,left-taken))
 }
 return {
  commodityCode,requestedTonnes:request,availableTonnes,
  allocatedTonnes:round(request-left),shortfallTonnes:left,
  allocations,valid,
 }
}

/** Previous complete calendar days, before the as-of date (Asia/Qatar).
 * Never use future consumption as the denominator of reserve coverage.
 */
export function reserveDemandWindow(asOfDate:string,days:7|30|90|180=30){
 const timestamp=Date.parse(asOfDate+'T00:00:00Z')
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||!Number.isFinite(timestamp)||
  new Date(timestamp).toISOString().slice(0,10)!==asOfDate){
  throw new Error('Invalid reserve demand date')
 }
 return {
  from:new Date(timestamp-days*86400000).toISOString().slice(0,10),
  through:new Date(timestamp-86400000).toISOString().slice(0,10),
  days,
 }
}
