/**
 * Optional Google Routes API sourced ROAD geography. Google's DRIVE route
 * is a passenger-car path, NOT evidence of trucking, border or customs access.
 * This may only replace the invented geometry; commercial truck transit time
 * must continue to include handling and crossing assumptions.
 */
import {getExportHub,QATAR_ROAD} from './logistics-lanes'
export type RoadEvidence={
  distanceKm:number;driveHours:number;sourceUrl:string
  method:'google_routes_driving_not_trucking'
}
type Json=Record<string,unknown>
const obj=(v:unknown):Json=>v&&typeof v==='object'&&!Array.isArray(v)?v as Json:{}
export function parseRoadApiRoute(value:unknown):RoadEvidence|null{
  const paths=obj(value).routes
  if(!Array.isArray(paths)||!paths.length)return null
  const route=obj(paths[0]),m=route.distanceMeters,seconds=route.duration
  if(typeof m!=='number'||!Number.isFinite(m)||m<1000||m>6000000||
    typeof seconds!=='string'||!/^[0-9]+(?:\.[0-9]+)?s$/.test(seconds))return null
  const h=Number(seconds.slice(0,-1))/3600
  if(!Number.isFinite(h)||h<=0||h>600)return null
  return {distanceKm:Math.round(m/1000),driveHours:Math.round(h*10)/10,
    sourceUrl:'https://developers.google.com/maps/documentation/routes/compute_route_directions',
    method:'google_routes_driving_not_trucking'}
}
export async function fetchRoadEvidence(country:string):
  Promise<{data:RoadEvidence|null;status:'available'|'unavailable'|'unconfigured'|'not_applicable'}>{
  const key=process.env.GOOGLE_ROUTES_API_KEY
  if(!key)return {data:null,status:'unconfigured'}
  const hub=getExportHub(country)
  if(!hub?.roadEligible)return {data:null,status:'not_applicable'}
  try{
    const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
      method:'POST',headers:{
        'Content-Type':'application/json','X-Goog-Api-Key':key,
        'X-Goog-FieldMask':'routes.distanceMeters,routes.duration',
      },
      body:JSON.stringify({
        origin:{location:{latLng:{latitude:hub.sea.lat,longitude:hub.sea.lon}}},
        destination:{location:{latLng:{latitude:QATAR_ROAD.lat,longitude:QATAR_ROAD.lon}}},
        travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',
      }),
      signal:AbortSignal.timeout(6500),
      next:{revalidate:21600},
    })
    if(!response.ok)return {data:null,status:'unavailable'}
    const evidence=parseRoadApiRoute(await response.json() as unknown)
    return {data:evidence,status:evidence?'available':'unavailable'}
  }catch{return {data:null,status:'unavailable'}}
}
