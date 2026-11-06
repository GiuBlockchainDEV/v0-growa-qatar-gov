/**
 * Small evidence-led geospatial analyst inspired by God's Eye View's contact
 * triage. No probability, cargo manifest or invented routes are inferred.
 * Only source-reported AIS/ADS-B positions, optional itinerary references and
 * geographic reference points are considered.
 */
import {CHOKEPOINTS,separationKm,type TrackingAsset} from './global-tracking'
export type ContactEvidence={
 freshness:'recent'|'delayed'|'undated'|'future'
 ageMinutes:number|null
 heading:string
 route:'plausible_geography'|'off_reference_corridor'|'insufficient_data'
 routeDistanceKm:number|null
 routeDeviationKm:number|null
 closestGateway:{name:string;distanceKm:number}|null
 notes:string[]
}
const radians=(v:number)=>v*Math.PI/180
const valid=(lat:number,lon:number)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180
function initialBearing(a:{lat:number;lon:number},b:{lat:number;lon:number}):number{
 const dLon=radians(b.lon-a.lon)
 const lat1=radians(a.lat),lat2=radians(b.lat)
 const y=Math.sin(dLon)*Math.cos(lat2)
 const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon)
 return Math.atan2(y,x)
}
/** Geographic cross-track distance to the great-circle reference arc.
 * It is not a legal flight plan or a navigable sea route.
 */
export function referenceArcDeviationKm(
 from:{lat:number;lon:number},to:{lat:number;lon:number},current:{lat:number;lon:number},
):number|null{
 if(![from,to,current].every(p=>valid(p.lat,p.lon)))return null
 const routeLength=separationKm(from,to)
 if(routeLength<1)return null
 const startToCurrent=separationKm(from,current)
 const delta13=startToCurrent/6371.0088
 const delta12=routeLength/6371.0088
 const theta13=initialBearing(from,current),theta12=initialBearing(from,to)
 const sine=Math.sin(delta13)*Math.sin(theta13-theta12)
 const crossTrack=Math.asin(Math.max(-1,Math.min(1,sine)))*6371.0088
 const along=Math.atan2(
  Math.sin(delta13)*Math.cos(theta13-theta12),Math.cos(delta13)
 )
 if(along<0)return Math.round(startToCurrent)
 if(along>delta12)return Math.round(separationKm(current,to))
 return Math.round(Math.abs(crossTrack))
}
export function contactIntelligence(asset:TrackingAsset,now=Date.now()):ContactEvidence{
 const observed=Date.parse(asset.observedAt)
 const diff=Number.isFinite(observed)?(now-observed)/60000:null
 let freshness:ContactEvidence['freshness']='undated'
 if(diff!==null){
  freshness=diff< -1?'future':diff<= (asset.kind==='aircraft'?2:60)?'recent':'delayed'
  if(asset.observationBasis==='webpage_capture')freshness='undated'
 }
 const near=CHOKEPOINTS.map(point=>({
  name:point.label,distanceKm:separationKm(asset,point),
 })).sort((a,b)=>a.distanceKm-b.distanceKm)[0]??null
 const origin=asset.itinerary?.origin,destination=asset.itinerary?.destination
 const from=origin&&origin.lat!==null&&origin.lon!==null?
  {lat:origin.lat,lon:origin.lon}:null
 const to=destination&&destination.lat!==null&&destination.lon!==null?
  {lat:destination.lat,lon:destination.lon}:null
 const d=from&&to?referenceArcDeviationKm(from,to,asset):null
 const originToDestination=from&&to?Math.round(separationKm(from,to)):null
 // Warn only on very large deviations. Short routes get a fixed tolerance.
 // For ships, the great circle can intersect land: do not flag off-corridor.
 const tolerance=originToDestination===null?null:Math.max(160,originToDestination*.22)
 const route:ContactEvidence['route']=d===null?'insufficient_data':
  asset.kind==='vessel'?'insufficient_data':
  d<=tolerance!?'plausible_geography':'off_reference_corridor'
 const notes:string[]=[]
 if(freshness==='undated')notes.push('Source does not establish a verified per-object observation time.')
 if(freshness==='future')notes.push('Provider timestamp is ahead of this clock. Confirm source timing.')
 if(freshness==='delayed')notes.push('Observed position may be stale. Do not extrapolate a live path.')
 if(d!==null){
  notes.push('Deviation is measured from a geographic great-circle reference, not a confirmed journey.')
  if(asset.kind==='vessel')notes.push('Marine routes require navigable ocean geometry; a straight geodesic can cross land.')
 }
 if(route==='off_reference_corridor')notes.push('The supplied callsign-based airport pair is inconsistent with this observation. Check reused or stale callsign data.')
 if(asset.cargo==='operator_inferred'||asset.cargo==='airframe_inferred')notes.push('Cargo classification is inferred; a cargo manifest is not verified.')
 if(asset.observationBasis==='webpage_capture')notes.push('Webpage inspection is not equivalent to a ship-specific AIS transmission.')
 return {
  freshness,ageMinutes:diff===null?null:Math.round(diff),
  heading:asset.heading===null?'Heading unreported':Math.round(asset.heading)+'° reported',
  route,routeDeviationKm:d,routeDistanceKm:originToDestination,
  closestGateway:near&&near.distanceKm<=800?{
   name:near.name,distanceKm:Math.round(near.distanceKm),
  }:null,
  notes,
 }
}
