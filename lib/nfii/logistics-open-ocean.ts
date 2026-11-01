/**
 * Offline ocean-network fallback. This generates a NAVIGABLE GEOMETRY
 * on an ocean grid, not a confirmed carrier service or actual voyage ETA.
 * MIT-licensed @arcnautical/maritime-routing.
 */
import {findOceanPath} from '@arcnautical/maritime-routing'
import {getExportHub,QATAR_PORT,haversineKm,type GeoPoint} from './logistics-lanes'
import {splitAtDateline,matchesRequestedSeaPorts,type GeoLine,type GeoPointTuple} from './logistics-route-geometry'

export type OpenOceanRoute={
  km:number;durationDays:number;geometry:GeoLine;
  routeUrl:'https://github.com/arcnautical/maritime-routing';
  calculationSource:'local_ocean_network';
}
export type OceanFallbackResult={route:OpenOceanRoute|null;status:'available'|'failed';message:string}
const pt=(p:GeoPoint):GeoPointTuple=>[p.lat,p.lon]
const LIMIT=900
export function routeDistanceKm(lines:GeoLine):number{
  let km=0
  for(const line of lines)for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i]
    km+=haversineKm({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]})
  }
  return km
}
export function calculateOpenOceanRoute(country:string):OpenOceanRoute|null{
  const hub=getExportHub(country)
  if(!hub)return null
  const start=hub.sea,finish=QATAR_PORT
  try{
    // The bundled land mask and pathfinder avoid overland great-circle edges.
    const nodes=findOceanPath(start.lat,start.lon,finish.lat,finish.lon)
    if(!Array.isArray(nodes)||nodes.length<3)return null
    const step=Math.max(1,Math.ceil((nodes.length-1)/(LIMIT-1)))
    const sampled=nodes.filter((_,i)=>i%step===0)
    if(sampled[sampled.length-1]!==nodes[nodes.length-1])
      sampled.push(nodes[nodes.length-1])
    const line=sampled.map(([lon,lat]):GeoPointTuple=>[lat,lon])
    const geometry=splitAtDateline([line])
    if(!geometry.length||!matchesRequestedSeaPorts(geometry,pt(start),pt(finish)))
      return null
    // Distances sum over original dense nodes to avoid simplification bias.
    let km=0
    for(let i=1;i<nodes.length;i++){
      const [x,y]=nodes[i-1],[lon,lat]=nodes[i]
      km+=haversineKm({lat:y,lon:x},{lat,lon})
    }
    const lowerBound=haversineKm(start,finish)
    if(!Number.isFinite(km)||km<lowerBound*.96||km>45000)
      return null
    // Example speed only, not a sailing schedule. No customs/port dwell.
    const days=km/1.852/14/24
    return {
      km:Math.round(km),durationDays:Math.round(days*10)/10,
      geometry,calculationSource:'local_ocean_network',
      routeUrl:'https://github.com/arcnautical/maritime-routing',
    }
  }catch{return null}
}
export async function fetchOpenOceanFallback(country:string):Promise<OceanFallbackResult>{
  // Only one route generated; no fictional transshipment alternatives.
  const route=calculateOpenOceanRoute(country)
  return route?{route,status:'available',
    message:'Estimated ocean-network route, vessel speed assumed 14 knots; not a carrier service.'}:
    {route:null,status:'failed',message:'Ocean-network route unavailable for this port pair.'}
}
