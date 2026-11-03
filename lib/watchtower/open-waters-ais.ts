/**
 * Optional regional Open Waters AIS snapshot adapter for the Red Sea,
 * Gulf of Aden, Arabian Sea and northwestern Indian Ocean.
 *
 * Open Waters requires commercial permission for a product deployment.
 * This integration is deliberately OFF until the administrator confirms
 * commercial service and source-specific redistribution rights.
 *
 * Source: https://openwaters.io/api/ais/
 * GeoJSON: https://ais.openwaters.io/v1/vessels?bbox=s,w,n,e
 */
import {coordinate,mergeAssets,type TrackingAsset} from './global-tracking'

type Data=Record<string,unknown>
const obj=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Data:{}
const asNum=(value:unknown):number|null=>{
  const v=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN
  return Number.isFinite(v)?v:null
}
const clean=(value:unknown,max=100)=>typeof value==='string'
  ?value.replace(/[<>]/g,'').trim().slice(0,max):''
/** Every public anonymous query is <100 square degrees; no artificial ship points. */
export const MARITIME_AIS_AREAS=[
  {id:'red_sea_north',name:'Northern Red Sea',bounds:[21,32.5,29.5,39]},
  {id:'red_sea_central',name:'Central Red Sea',bounds:[16.5,37,23,44]},
  {id:'red_sea_south',name:'Southern Red Sea',bounds:[11.5,40,18,46]},
  {id:'aden_west',name:'Western Gulf of Aden',bounds:[10,43,16.5,51]},
  {id:'aden_east',name:'Eastern Gulf of Aden',bounds:[9,50,16.5,59]},
  {id:'arabian_west',name:'Western Arabian Sea',bounds:[14,54,22,64]},
  {id:'arabian_east',name:'Eastern Arabian Sea',bounds:[14,63,22,73]},
  {id:'oman_gulf',name:'Gulf of Oman',bounds:[20,55,27,65]},
  {id:'pakistan_coast',name:'Pakistan coast',bounds:[21,63,28,73]},
  {id:'indian_ocean_west',name:'Northwestern Indian Ocean (west)',bounds:[7,51,14.5,61]},
  {id:'indian_ocean_central',name:'Northwestern Indian Ocean (centre)',bounds:[7,60.5,15,70.5]},
  {id:'indian_ocean_east',name:'Northwestern Indian Ocean (east)',bounds:[7,70,15,79]},
  {id:'indian_ocean_northeast',name:'Northern Indian Ocean',bounds:[14,72,21.5,80]},
  {id:'gulf_west',name:'Western Persian Gulf',bounds:[23.5,47,30,56]},
  {id:'gulf_east',name:'Eastern Persian Gulf',bounds:[23.5,55.5,30,62]},
] as const

export type MaritimeAreaStatus={
  id:string
  name:string
  state:'available'|'unavailable'
  vessels:number
  moving:number
  reason:string|null
}
export type OpenWatersSnapshot={
  source:'Open Waters AIS'
  state:'available'|'partial'|'unavailable'|'unconfigured'
  checkedAt:string
  latestObservedAt:string|null
  vessels:number
  moving:number
  areas:MaritimeAreaStatus[]
  attribution:string[]
  detail:string
  assets:TrackingAsset[]
}
export function parseOpenWatersArea(raw:unknown,now=Date.now()):{
  assets:TrackingAsset[]
  attribution:string[]
  truncated:boolean
}{
  const root=obj(raw)
  if(root.type!=='FeatureCollection'||!Array.isArray(root.features))
    throw Error('Unexpected Open Waters GeoJSON')
  const credits=obj(root.attribution)
  const attribution=Object.values(credits).filter((v):v is string=>
    typeof v==='string'&&v.length>0).map(v=>clean(v,350)).slice(0,30)
  const mapped:TrackingAsset[]=[]
  for(const feature of root.features.slice(0,8000)){
    const record=obj(feature),properties=obj(record.properties),
      geometry=obj(record.geometry)
    if(geometry.type!=='Point'||!Array.isArray(geometry.coordinates))continue
    const point=coordinate(geometry.coordinates[1],geometry.coordinates[0])
    const mmsi=String(properties.mmsi??record.id??'').trim()
    if(!point||!/^[1-9]\d{8}$/.test(mmsi))continue
    if(clean(properties.kind,20)&&clean(properties.kind,20)!=='vessel')continue
    const observed=Date.parse(clean(properties.seen,70))
    if(!Number.isFinite(observed)||observed>now+60000||now-observed>90*60000)continue
    const sog=asNum(properties.sog),course=asNum(properties.cog),
      heading=asNum(properties.heading),shipType=asNum(properties.type)
    const cargo=shipType!==null&&shipType>=70&&shipType<80
    const origin=clean(properties.source,60)
    const name=clean(properties.name,80)||'Vessel '+mmsi
    const imo=String(properties.imo??'').trim()
    mapped.push({
      id:'sea:'+mmsi,kind:'vessel',...point,label:name,
      heading:heading!==null&&heading>=0&&heading<360?heading
        :course!==null&&course>=0&&course<360?course:null,
      speedKnots:sog!==null&&sog>=0&&sog<102.3?sog:null,
      altitudeFt:null,observedAt:new Date(observed).toISOString(),
      source:'Open Waters AIS'+(origin?' / '+origin:''),
      sourceUrl:/^[1-9]\d{6}$/.test(imo)
        ?'https://www.vesselfinder.com/vessels/details/'+imo
        :'https://openwaters.io/ais/',
      type:shipType!==null?'AIS vessel class '+shipType:'Unclassified vessel',
      cargo:cargo?'ais_cargo_class':'unverified',
      destination:clean(properties.destination,90)||null,
      foodCargoVerified:false,observationBasis:'position_report',
    })
  }
  return {assets:mergeAssets(mapped),attribution,truncated:root.truncated===true}
}
function unavailable(detail:string):OpenWatersSnapshot{
  return {source:'Open Waters AIS',state:'unconfigured',checkedAt:new Date().toISOString(),
    latestObservedAt:null,vessels:0,moving:0,assets:[],areas:[],attribution:[],detail}
}
async function readArea(area:typeof MARITIME_AIS_AREAS[number],key:string|null){
  const bounds=area.bounds
  const query=new URLSearchParams({bbox:bounds.join(',')})
  const url='https://ais.openwaters.io/v1/vessels?'+query.toString()
  const response=await fetch(url,{
    headers:{Accept:'application/geo+json',...(key?{Authorization:'Bearer '+key}:{})},
    signal:AbortSignal.timeout(6500),next:{revalidate:120},
  })
  if(!response.ok)throw Error('HTTP '+response.status)
  const size=Number(response.headers.get('content-length')??0)
  if(size>8500000)throw Error('response too large')
  const content=await response.text()
  if(content.length>8500000)throw Error('response too large')
  return parseOpenWatersArea(JSON.parse(content) as unknown)
}
let cached:{expires:number;value:OpenWatersSnapshot}|null=null
let pending:Promise<OpenWatersSnapshot>|null=null
export async function getOpenWatersSnapshot():Promise<OpenWatersSnapshot>{
  // Gating by a deliberate admin choice; anonymous access is for personal use.
  if(process.env.WATCHTOWER_OPENWATERS_COMMERCIAL_APPROVED!=='true')
    return unavailable('Commercial access not authorised. Arrange an Open Waters AIS commercial plan or contributor agreement and set WATCHTOWER_OPENWATERS_COMMERCIAL_APPROVED=true. Preserve attribution and confirm AISHub reuse rights.')
  if(cached&&cached.expires>Date.now())return cached.value
  if(pending)return pending
  pending=(async()=>{
    const checkedAt=new Date().toISOString()
    const key=process.env.WATCHTOWER_OPENWATERS_TOKEN?.trim()||null
    const areas:MaritimeAreaStatus[]=[]
    const credits=new Set<string>()
    const observations:TrackingAsset[]=[]
    // Limit concurrency; each 6500ms timeout and 4 requests at a time.
    for(let start=0;start<MARITIME_AIS_AREAS.length;start+=4){
      const group=MARITIME_AIS_AREAS.slice(start,start+4)
      const results=await Promise.allSettled(group.map(area=>readArea(area,key)))
      for(const [index,result] of results.entries()){
        const area=group[index]
        if(result.status==='rejected'){
          const reason=result.reason instanceof Error?result.reason.message:'provider failed'
          areas.push({id:area.id,name:area.name,state:'unavailable',
            vessels:0,moving:0,reason:reason.slice(0,90)})
        }else{
          observations.push(...result.value.assets)
          result.value.attribution.forEach(credit=>credits.add(credit))
          areas.push({id:area.id,name:area.name,state:'available',
            vessels:result.value.assets.length,
            moving:result.value.assets.filter(v=>(v.speedKnots??0)>=1.5).length,
            reason:result.value.truncated?'Provider response truncated':null})
        }
      }
    }
    const assets=mergeAssets(observations).sort((a,b)=>
      Number((b.speedKnots??0)>=1.5)-Number((a.speedKnots??0)>=1.5)||
      b.observedAt.localeCompare(a.observedAt)).slice(0,2600)
    const valid=areas.filter(a=>a.state==='available').length
    const state:OpenWatersSnapshot['state']=!valid?'unavailable':
      valid===areas.length?'available':'partial'
    const snapshot:OpenWatersSnapshot={
      source:'Open Waters AIS',state,checkedAt,
      latestObservedAt:assets.length?assets.reduce((a,b)=>
        a>b.observedAt?a:b.observedAt,assets[0].observedAt):null,
      vessels:assets.length,
      moving:assets.filter(a=>(a.speedKnots??0)>=1.5).length,
      assets,areas,attribution:[...credits],
      detail:'Source-confirmed AIS positions only. '+valid+'/'+areas.length+
        ' geographic areas responded. An empty or failed area is not evidence of zero ships. '+
        'AISHub and other upstream sources retain their licensing and attribution requirements.',
    }
    cached={value:snapshot,expires:Date.now()+(valid?120000:45000)}
    return snapshot
  })()
  try{return await pending}finally{pending=null}
}
