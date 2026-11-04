/**
 * Groundwater & Wells Intelligence. Only exact, attributable geolocated
 * wells are mapped; no position or live water reading is inferred from
 * satellite indices, farm centroids, or nearby IoT devices.
 *
 * OSM contributors, ODbL: https://www.openstreetmap.org/copyright
 */
import {isPointInQatar} from '@/lib/satellite/qatar-clip'

export type WellOrigin='openstreetmap'|'growa-map-point'
export type WellKind='water_well'|'water_borehole'
export type QatarWell={
 id:string
 name:string
 lat:number
 lng:number
 origin:WellOrigin
 kind:WellKind
 osmUrl:string|null
 operator:string|null
 reference:string|null
 drinkingWater:'yes'|'no'|null
 pump:string|null
 depthM:number|null
 liveTelemetry:false
 lastSensorUpdate:null
}
export type WellsSourceStatus='available'|'unavailable'|'stale'
export type QatarWellsPayload={
 wells:QatarWell[]
 sourceStatus:WellsSourceStatus
 source:'OpenStreetMap / Overpass'
 sourceUpdatedAt:string|null
 fetchedAt:string
 total:number
 note:string
 attribution:string
}
export type OsmWellElement={
 type?:unknown
 id?:unknown
 lat?:unknown
 lon?:unknown
 center?:unknown
 tags?:unknown
}
type MapPoint={
 id?:unknown
 label?:unknown
 lat?:unknown
 lng?:unknown
 pointType?:unknown
}
const obj=(v:unknown):Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const clean=(v:unknown,max=100):string|null=>{
 if(typeof v!=='string')return null
 const s=v.replace(/[<>\x00-\x1f\x7f]/g,'').trim().slice(0,max)
 return s||null
}
const number=(v:unknown):number|null=>{
 const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
 return Number.isFinite(n)?n:null
}
const waterTagged=(tags:Record<string,unknown>):boolean=>{
 const man=clean(tags.man_made,30)?.toLowerCase()
 if(man==='water_well')return true
 if(man==='borehole'){
  return /^(water|groundwater|water_well)$/i.test(clean(tags.borehole,30)??'')||
   /^(water|groundwater)$/i.test(clean(tags.substance,30)??'')||
   typeof tags.water_well==='string'
 }
 return typeof tags.water_well==='string'&&man!=='petroleum_well'
}
const drinking=(tags:Record<string,unknown>)=>
 tags.drinking_water==='yes'?'yes' as const:
 tags.drinking_water==='no'?'no' as const:null
const depth=(v:unknown):number|null=>{
 if(typeof v!=='string'&&typeof v!=='number')return null
 const matched=String(v).trim().match(/^(\d{1,4}(?:\.\d{1,2})?)(?:\s*(?:m|meters?|metres?))?$/i)
 if(!matched)return null
 const n=Number(matched[1])
 return Number.isFinite(n)&&n>0&&n<=1500?n:null
}
const outsideQatar=(lat:number,lng:number)=>!isPointInQatar(lng,lat)
/** Converts OSM point and area center features with strict country clipping. */
export function normalizeQatarWells(data:unknown):QatarWell[]{
 const root=obj(data)
 if(!Array.isArray(root.elements))throw Error('Invalid OpenStreetMap well dataset')
 const collected=new Map<string,QatarWell>()
 for(const raw of root.elements.slice(0,4500) as OsmWellElement[]){
  const v=obj(raw)
  const tags=obj(v.tags)
  if(!waterTagged(tags))continue
  const type=v.type
  const id=number(v.id)
  if(!['node','way','relation'].includes(String(type))||id===null||
   !Number.isSafeInteger(id)||id<=0)continue
  const center=obj(v.center)
  const lat=number(v.lat)??number(center.lat)
  const lng=number(v.lon)??number(center.lon)
  if(lat===null||lng===null||lat<24||lat>27||lng<50||lng>52||
   outsideQatar(lat,lng))continue
  const ref=clean(tags.ref,70)
  const name=clean(tags.name,120)??(ref?'Well '+ref:'Mapped well #'+id)
  const kind:WellKind=tags.man_made==='borehole'?'water_borehole':'water_well'
  const key='osm:'+type+':'+id
  collected.set(key,{
   id:key,name,lat,lng,origin:'openstreetmap',kind,
   osmUrl:'https://www.openstreetmap.org/'+type+'/'+id,
   operator:clean(tags.operator,110),reference:ref,
   drinkingWater:drinking(tags),
   pump:clean(tags.pump,40),depthM:depth(tags.depth),
   liveTelemetry:false,lastSensorUpdate:null,
  })
 }
 return [...collected.values()].sort((a,b)=>a.name.localeCompare(b.name))
}

/** Only EXPLICITLY named wells from the user's own map; a generic sensor
 * does not become a connected water well by geographic proximity.
 */
export function normalizeUserMappedWells(data:unknown):QatarWell[]{
 if(!Array.isArray(data))return []
 const seen=new Set<string>()
 const out:QatarWell[]=[]
 for(const entry of data.slice(0,2000) as MapPoint[]){
  const row=obj(entry),label=clean(row.label,120)
  if(!label||!(
   /^(?:water\s+well|well|borehole|pozzo)(?:\s|:|#|\-|$)/i.test(label)||
   /^بئر(?:\s|:|#|$)/.test(label)
  ))continue
  const lat=number(row.lat),lng=number(row.lng)
  const id=clean(row.id,110)
  if(!id||seen.has(id)||lat===null||lng===null||outsideQatar(lat,lng))continue
  seen.add(id)
  out.push({
   id:'growa:'+id,name:label,lat,lng,origin:'growa-map-point',
   kind:'water_well',osmUrl:null,operator:null,reference:null,
   drinkingWater:null,pump:null,depthM:null,
   liveTelemetry:false,lastSensorUpdate:null,
  })
 }
 return out.sort((a,b)=>a.name.localeCompare(b.name))
}

export function wellsSummary(wells:readonly QatarWell[]){
 return {
  mapped:wells.length,
  osm:wells.filter(x=>x.origin==='openstreetmap').length,
  userMapped:wells.filter(x=>x.origin==='growa-map-point').length,
  withDepth:wells.filter(x=>x.depthM!==null).length,
  withPumpTag:wells.filter(x=>x.pump!==null).length,
  connected:0, // No supported sensor-to-well relationship in current schema.
 }
}
