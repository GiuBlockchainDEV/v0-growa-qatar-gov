/**
 * Public, UN-hosted ArcGIS feature services with mapped Qatar water wells.
 * These are contributor GIS records, NOT confirmed permits, ownership or
 * operational pumping readings. Preserve individual dataset attribution.
 *
 * Catalog: https://pro-ags2.dfs.un.org/arcgis/rest/services/hosted
 */
import {isPointInQatar} from '@/lib/satellite/qatar-clip'
import type {QatarWell} from './qatar-wells'

export const QATAR_GIS_DATASETS=[
 {id:'shallow-monitoring',name:'Shallow groundwater monitoring wells',
  service:'Qatar_Shallow_Monitoring_Wells'},
 {id:'shallow-wells',name:'Shallow water wells',
  service:'qatar_shallow_wells_data'},
 {id:'kahramaa-wells',name:'Kahramaa wells (GIS records)',
  service:'Kahramaa_Wells'},
 {id:'kahramaa-data',name:'Kahramaa wells dataset',
  service:'qatar_kahramaa_wells_data'},
] as const
export type GisDataset=typeof QATAR_GIS_DATASETS[number]
export const QATAR_GIS_BASE='https://pro-ags2.dfs.un.org/arcgis/rest/services/hosted'

const dict=(x:unknown):Record<string,unknown>=>
 typeof x==='object'&&x!==null&&!Array.isArray(x)?x as Record<string,unknown>:{}
const rawText=(v:unknown):string|null=>{
 if(typeof v==='number'&&Number.isFinite(v))return String(v)
 if(typeof v!=='string')return null
 const clean=v.replace(/[<>\x00-\x1f\x7f]/g,'').trim().slice(0,100)
 return clean||null
}
const pick=(data:Record<string,unknown>,names:readonly string[]):string|null=>{
 const lower=new Map(Object.entries(data).map(([k,v])=>[k.toLowerCase(),v]))
 for(const key of names){const value=rawText(lower.get(key.toLowerCase()))
  if(value)return value}
 return null
}
function depthM(data:Record<string,unknown>):number|null{
 const raw=pick(data,['well_depth','depth_m','depth','well_depth_m'])
 if(!raw)return null
 const match=raw.match(/^(\d+(?:\.\d+)?)(?:\s*(m|metres?|meters?))?$/i)
 if(!match)return null
 const n=Number(match[1])
 return Number.isFinite(n)&&n>0&&n<=1500?n:null
}
export function parseQatarGisWells(
 raw:unknown,dataset:GisDataset,max=2000,
):QatarWell[]{
 const root=dict(raw)
 if(dict(root.error).code||root.error)throw Error('GIS service returned an error')
 if(root.type!=='FeatureCollection'||!Array.isArray(root.features))
  throw Error('Unexpected ArcGIS GeoJSON')
 const items:QatarWell[]=[]
 const originUrl=QATAR_GIS_BASE+'/'+dataset.service+'/FeatureServer/0'
 const names=new Set<string>()
 for(const feature of root.features.slice(0,Math.min(max,2000))){
  const f=dict(feature),geometry=dict(f.geometry)
  if(geometry.type!=='Point'||!Array.isArray(geometry.coordinates))continue
  const [lng,lat]=geometry.coordinates
  if(typeof lng!=='number'||typeof lat!=='number'||
   !Number.isFinite(lng)||!Number.isFinite(lat)||
   lat<24||lat>27||lng<50||lng>52||!isPointInQatar(lng,lat))continue
  const props=dict(f.properties)
  const recordId=rawText(f.id)??pick(props,[
   'objectid','object_id','fid','gid','well_id','wellid','well_no','id',
  ])
  if(!recordId)continue
  const id='gis:'+dataset.id+':'+recordId
  if(names.has(id))continue
  names.add(id)
  const label=pick(props,[
   'name_en','name_engl','well_name','wellname','name','name_ar',
   'well_number','well_no','well_id','ref','code',
  ])??dataset.name+' #'+recordId
  const ref=pick(props,['well_no','well_id','well_number','ref','code'])
  items.push({
   id,name:label,lat,lng,origin:'un-gis',
   kind:dataset.id.includes('monitoring')?'water_borehole':'water_well',
   osmUrl:null,sourceName:dataset.name,sourceUrl:originUrl,
   operator:pick(props,['operator','owner_name','organization']),
   reference:ref,drinkingWater:null,
   pump:pick(props,['pump_type','pumptype','pump']),depthM:depthM(props),
   liveTelemetry:false,lastSensorUpdate:null,
  })
 }
 return items
}
/** Co-located source records are not counted as separate mapped locations.
 * Dedup only sub-meter identical coordinates, never nearby independent wells.
 */
export function mergePublicWells(
 groups:readonly (readonly QatarWell[])[],
):QatarWell[]{
 const seen=new Set<string>()
 const merged:QatarWell[]=[]
 for(const group of groups)for(const w of group){
  const key=w.lat.toFixed(5)+':'+w.lng.toFixed(5)
  if(seen.has(key))continue
  seen.add(key);merged.push(w)
 }
 return merged.sort((a,b)=>a.name.localeCompare(b.name))
}
