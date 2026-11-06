import {visibleUnderwayVessel} from './visible-vessels'
import type {TrackingAsset} from './global-tracking'

/** Geographic monitoring boxes, not proven maritime transits. */
export const TRAFFIC_SECTORS=[
 {id:'suez',name:'Suez',lat:30.45,lon:32.35,zoom:7,bounds:[29.35,31.9,31.65,33.8]},
 {id:'red_sea',name:'Red Sea',lat:21,lon:38.6,zoom:5,bounds:[13.6,32,29.35,44.7]},
 {id:'bab_el_mandeb',name:'Bab el-Mandeb',lat:12.58,lon:43.33,zoom:7,bounds:[11.45,42,13.9,44.9]},
 {id:'gulf_of_aden',name:'Gulf of Aden',lat:12.3,lon:47.5,zoom:5,bounds:[10.5,44.9,15.6,52.5]},
 {id:'arabian_sea',name:'Arabian Sea',lat:18.3,lon:61.4,zoom:5,bounds:[11.5,52.5,25.5,69.5]},
 {id:'hormuz',name:'Hormuz',lat:26.56,lon:56.25,zoom:7,bounds:[25.1,55,27.8,58.4]},
] as const
export type TrafficSectorId=typeof TRAFFIC_SECTORS[number]['id']
export type TrafficSectorActivity={
 id:TrafficSectorId;name:string;lat:number;lon:number;zoom:number
 vessels:number;aircraft:number;newestVessel:string|null
 basis:'observed_fixes'
}
export function trafficSectorActivity(assets:readonly TrackingAsset[],now=Date.now()):TrafficSectorActivity[]{
 const underway=assets.filter(a=>visibleUnderwayVessel(a,now))
 const air=assets.filter(a=>{
  if(a.kind!=='aircraft'||a.observationBasis==='webpage_capture')return false
  const age=now-Date.parse(a.observedAt)
  return Number.isFinite(age)&&age>=-60000&&age<=10*60000
 })
 return TRAFFIC_SECTORS.map(sector=>{
  const [south,west,north,east]=sector.bounds
  const inside=(p:{lat:number;lon:number})=>p.lat>=south&&p.lat<=north&&p.lon>=west&&p.lon<=east
  const ships=underway.filter(inside),planes=air.filter(inside)
  return {id:sector.id,name:sector.name,lat:sector.lat,lon:sector.lon,zoom:sector.zoom,
   vessels:ships.length,aircraft:planes.length,
   newestVessel:ships.reduce<string|null>((latest,asset)=>
    !latest||asset.observedAt>latest?asset.observedAt:latest,null),
   basis:'observed_fixes'}
 })
}
