import type {RouteMapOverlay} from '@/lib/nfii/logistics-route-map'
import type {RouteReview} from './sourcing-autopilot'

/** All coordinates are returned by the corridor provider. No guessed sea lines. */
export type CorridorOption=RouteReview & {
 from:string;to:string;originCode:string;destinationCode:string
 riskBand:'reported_alert'|'no_nearby_reported_alert'|'unavailable'
 riskDrivers:string[];quality:'route_api'|'model_only'
 sourceUrl:string|null;distanceKm:number;timeBasis:string
}
export type CorridorPayload={
 routes:CorridorOption[];mapRoutes:RouteMapOverlay[]
 generatedAt:string
 dataWarnings?:string[]
 pricesDisclaimer?:string;scheduleDisclaimer?:string
}
export type RouteDetail={
 key:string;country:string;route:CorridorOption
 overlay:RouteMapOverlay|null
 risk:RiskAssessment
}
export type RiskAssessment={
 band:'elevated'|'attention'|'screened'|'unknown'
 index:number|null
 label:string
 riskEvidence:string
}
export type RouteSort='exposure'|'eta'|'freight'
export function routeKey(country:string,id:string){return country+':'+id}
export function riskAssessment(route:CorridorOption):RiskAssessment{
 const index=route.exposure.index
 if(index===null||!Number.isFinite(index))
  return {band:'unknown',index:null,label:'Evidence unavailable',
   riskEvidence:'A missing index is not a zero-risk route.'}
 if(route.riskBand==='reported_alert'||index>=70)
  return {band:'elevated',index,label:'Elevated screening exposure',
   riskEvidence:'Reported hazard or a high screening index. Not a probability.'}
 if(index>=40)return {band:'attention',index,label:'Review exposure',
  riskEvidence:'Intermediate screening index, not a probability.'}
 return {band:'screened',index,label:'Lower screened exposure',
  riskEvidence:'Relative index only. No route has been confirmed safe or bookable.'}
}
export function mapRouteEvidence(country:string,payload:CorridorPayload):RouteDetail[]{
 const overlays=new Map(payload.mapRoutes.map(overlay=>[overlay.id,overlay]))
 return payload.routes.map(route=>{
  const overlay=overlays.get(route.id)??null
  return {
   key:routeKey(country,route.id),country,route,
   overlay:overlay?{...overlay,id:routeKey(country,overlay.id)}:null,
   risk:riskAssessment(route),
  }
 })
}
export function orderRouteAlternatives(
 candidates:readonly RouteDetail[],by:RouteSort='exposure',
):RouteDetail[]{
 const value=(row:RouteDetail):number=>{
  if(by==='eta')return row.route.estimatedDays??Infinity
  if(by==='freight')return row.route.costEstimate?.maxQar??Infinity
  return row.risk.index===null?Infinity:
   row.risk.index+(row.route.riskBand==='reported_alert'?15:0)
 }
 return [...candidates].sort((a,b)=>
   Number(a.route.feasibleBeforeDeadline===false)-Number(b.route.feasibleBeforeDeadline===false)||
   value(a)-value(b)||
   (a.route.estimatedDays??Infinity)-(b.route.estimatedDays??Infinity)||
   a.key.localeCompare(b.key))
}
export function routePassages(route:CorridorOption):Array<{
 stage:string;detail:string;certainty:'gateway'|'pending'
}>{
 const hub=route.mode==='sea'?'Origin seaport':
  route.mode==='air'?'Origin airport':'Origin road depot'
 const ports=[
  {stage:'01 · Supplier pickup',detail:'Pickup location, readiness and export clearance to be confirmed',certainty:'pending' as const},
  {stage:'02 · '+hub,detail:route.from+' · reference gateway ('+route.originCode+')',
   certainty:'gateway' as const},
 ]
 if(route.via)ports.push({stage:'03 · Proposed transfer / border',
  detail:route.via+' · route geometry is not proof of service or transit booking',
  certainty:'pending'})
 ports.push({stage:route.via?'04 · Qatar arrival':'03 · Qatar arrival',
  detail:route.to+' · '+route.destinationCode+' · planning destination only',
  certainty:'gateway'})
 ports.push({stage:route.via?'05 · Clearance':'04 · Clearance',
  detail:'Import permits, inspection, customs and food-safety release not verified',
  certainty:'pending'})
 ports.push({stage:route.via?'06 · Warehouse':'05 · Warehouse',
  detail:'Final-mile delivery, receiving capacity and unloading time unconfirmed',
  certainty:'pending'})
 return ports
}
export function routeOptionReport(routes:readonly RouteDetail[]){
 const values=routes.map(x=>x.risk.index).filter((x):x is number=>x!==null)
 return {
  total:routes.length,
  mapped:routes.filter(r=>Boolean(r.overlay?.paths.some(p=>p.length>1))).length,
  unknown:routes.filter(x=>x.risk.band==='unknown').length,
  highestExposure:values.length?Math.max(...values):null,
  lowestExposure:values.length?Math.min(...values):null,
  routableCount:routes.filter(x=>x.route.feasibleBeforeDeadline!==false).length,
 }
}
