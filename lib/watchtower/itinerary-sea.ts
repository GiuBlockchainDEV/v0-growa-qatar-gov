/**
 * Ocean-network REFERENCE geometry for known port endpoints of AIS vessels.
 * This is a land-avoiding modeled path, never a confirmed vessel track or
 * captain-approved route. Failure returns no geometry, not a straight
 * line across land.
 */
import {findOceanPath} from '@arcnautical/maritime-routing'
import {separationKm} from './global-tracking'
import type {RouteEndpoint,RouteItinerary} from './itinerary-sources'
type Point={lat:number;lon:number}
function location(p:RouteEndpoint|null):Point|null {
  return p&&p.lat!==null&&p.lon!==null?{lat:p.lat,lon:p.lon}:null
}
function oceanLeg(a:Point,b:Point):Point[]|null{
  try {
    const nodes=findOceanPath(a.lat,a.lon,b.lat,b.lon)
    if(!Array.isArray(nodes)||nodes.length<2||nodes.length>40000)return null
    const step=Math.max(1,Math.ceil((nodes.length-1)/109))
    const sampled=nodes.filter((_,i)=>i%step===0)
    if(sampled.at(-1)!==nodes.at(-1))sampled.push(nodes[nodes.length-1])
    const points=sampled.map(([lon,lat])=>({lat,lon}))
    if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
      Math.abs(p.lat)>85||Math.abs(p.lon)>180))return null
    if(separationKm(points[0],a)>350||separationKm(points.at(-1)!,b)>350)return null
    return points
  }catch{return null}
}
export function withModeledSeaLegs(itinerary:RouteItinerary, current:Point):RouteItinerary{
  const origin=location(itinerary.origin),destination=location(itinerary.destination)
  if(!origin||!destination)return itinerary
  const completed=oceanLeg(origin,current),remaining=oceanLeg(current,destination)
  if(!completed||!remaining)return itinerary
  return {...itinerary,modelSeaLegs:{completed,remaining}}
}
