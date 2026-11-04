/**
 * VISUAL DEMONSTRATION ONLY. These are static, invented markers for showing a
 * map layout when public one-hour AIS coverage is sparse.
 * They NEVER enter TrackingAsset, the AIS API, KPI totals, alerts or routes.
 * They have no MMSI, AIS timestamp, cargo identity or observed trajectory.
 */
import type {TrackingAsset} from './global-tracking'

export type DemoVesselZone='red_sea'|'gulf_of_aden'|'arabian_sea'
export type DemoVessel={
  id:string
  region:DemoVesselZone
  regionLabel:string
  lat:number
  lon:number
  heading:number
  label:string
}
type Zone={
  id:DemoVesselZone
  name:string
  bounds:readonly [number,number,number,number]
  positions:readonly (readonly [number,number,number])[]
}
/** Illustrative water coordinates only; no route, source or position timestamp. */
// Synthetic density on illustrative open-water corridors, not asserted ship traffic.
// Deterministic positions, no generated AIS coordinates, IDs or timestamps.
const ARABIAN_SCENARIO_POSITIONS=Array.from({length:21},(_,i)=>{
  // Fixed pseudo-random distribution: visually irregular but stable on refresh.
  // Longitude bands keep illustrative positions in the Arabian Sea, not inland.
  const fractional=(n:number)=>n-Math.floor(n)
  const r1=fractional(Math.sin((i+1)*127.1)*43758.5453)
  const r2=fractional(Math.sin((i+1)*311.7)*18392.1941)
  const r3=fractional(Math.sin((i+1)*71.9)*9261.381)
  const lon=55.8+r1*16.9
  const lat=14.2+r2*5.6
  const heading=Math.round(r3*359)
  return [Number(lat.toFixed(3)),Number(lon.toFixed(3)),heading] as const
})
const zones:readonly Zone[]=[
  {id:'red_sea',name:'Red Sea',bounds:[13.2,32,29.3,44.8],
    positions:[[27.1,34.5,171],[22.6,37.4,152],[19.2,39.4,335],[15.5,41.6,158]]},
  {id:'gulf_of_aden',name:'Gulf of Aden',bounds:[10,43.2,15.2,54.1],
    positions:[[12.8,45.7,85],[12.4,47.7,257],[12.1,49.5,95],[12.6,51.5,270]]},
  {id:'arabian_sea',name:'Arabian Sea',bounds:[14,54.2,23.2,74],
    positions:ARABIAN_SCENARIO_POSITIONS},
]
export const DEMO_VESSEL_MARKERS:readonly DemoVessel[]=zones.flatMap(zone=>
  zone.positions.map(([lat,lon,heading],index)=>({
    id:'demo:'+zone.id+':'+(index+1),
    region:zone.id,regionLabel:zone.name,lat,lon,heading,
    label:'DEMO '+String(index+1).padStart(2,'0'),
  })))

/** Fill only the missing VISUAL slots, never inflate real-traffic counts. */
export function sparseAreaDemoVessels(realVisible:readonly TrackingAsset[]):DemoVessel[]{
  return zones.flatMap(zone=>{
    const [south,west,north,east]=zone.bounds
    const count=realVisible.filter(a=>
      a.kind==='vessel'&&a.lat>=south&&a.lat<=north&&
      a.lon>=west&&a.lon<=east).length
    return DEMO_VESSEL_MARKERS.filter(a=>a.region===zone.id)
      .slice(0,Math.max(0,zone.positions.length-count))
  })
}
