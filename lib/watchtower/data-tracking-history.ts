/**
 * Historical route retrieval from data-tracking.net.
 * History is provider-observed AIS fixes, never great-circle interpolation.
 */
import {coordinate,epoch,separationKm,type TrackingAsset} from './global-tracking'
export type AISPoint={lat:number;lon:number;time:string}
export type AISRoute={
  id:string
  chokepointId:'hormuz'|'bab_el_mandeb'
  mmsi:string
  segments:AISPoint[][]
  points:number
  firstSeenAt:string|null
  lastSeenAt:string|null
  sourceUrl:string
  status:'observed'|'no_history'|'unavailable'
}
type Obj=Record<string,unknown>
const obj=(x:unknown):Obj=>x&&typeof x==='object'&&!Array.isArray(x)?x as Obj:{}
const maybeArray=(x:unknown):unknown[]|null=>Array.isArray(x)?x:null
function historyRows(data:unknown):unknown[]{
  const root=obj(data),nested=obj(root.data)
  for(const candidate of [
    data,root.positions,root.history,root.track,root.tracks,root.points,
    root.records,root.results,root.data,
    nested.positions,nested.history,nested.track,nested.points,nested.results,
  ]){
    const array=maybeArray(candidate)
    if(array)return array.slice(0,8000)
  }
  return []
}
function point(record:unknown):AISPoint|null{
  const row=obj(record),pos=obj(row.position)
  const geo=obj(row.geometry)
  const coords=geo.type==='Point'&&Array.isArray(geo.coordinates)?geo.coordinates:null
  const place=coordinate(row.lat??row.latitude??row.LATITUDE??pos.lat??pos.latitude??coords?.[1],
    row.lon??row.lng??row.longitude??row.LONGITUDE??pos.lon??pos.longitude??coords?.[0])
  const stamp=epoch(row.timestamp??row.last_seen??row.time??row.ts??
    row.position_time??row.recorded_at??row.observed_at??row.observedAt??
    row.updated_at??pos.timestamp)
  if(!place||stamp===null||stamp>Date.now()+60000||stamp<Date.now()-31*86400000)return null
  return {...place,time:new Date(stamp).toISOString()}
}
export function parseAISHistory(raw:unknown,now=Date.now()):AISPoint[][]{
  const seen=new Set<string>()
  const points=historyRows(raw).flatMap(row=>{
    const p=point(row)
    if(!p||Date.parse(p.time)>now+60000||Date.parse(p.time)<now-31*86400000)return []
    const key=p.time+'|'+p.lat.toFixed(5)+'|'+p.lon.toFixed(5)
    if(seen.has(key))return []
    seen.add(key)
    return [p]
  }).sort((a,b)=>a.time.localeCompare(b.time)).slice(-360)
  const segments:AISPoint[][]=[]
  let segment:AISPoint[]=[]
  for(const p of points){
    const prev=segment[segment.length-1]
    if(prev){
      const dt=Date.parse(p.time)-Date.parse(prev.time)
      const km=separationKm(prev,p)
      // Jamming, large observation gaps, or impossible AIS jumps
      // cannot be displayed as continuous real travelled paths.
      if(dt<=0||dt>4*3600000||km>55*1.852*dt/3600000+3){
        if(segment.length>=2)segments.push(segment)
        segment=[]
      }
    }
    segment.push(p)
  }
  if(segment.length>=2)segments.push(segment)
  return segments
}
const base='https://hormuz.data-tracking.net'
const cached=new Map<string,{until:number;data:AISRoute}>()
const pending=new Map<string,Promise<AISRoute>>()
export async function fetchAISHistory(id:string,mmsi:string):Promise<AISRoute>{
  if(!/^[1-9]\d{8}$/.test(mmsi)||!['hormuz','bab_el_mandeb'].includes(id))
    throw Error('Invalid history request')
  const area=id as AISRoute['chokepointId']
  const key=area+':'+mmsi,hit=cached.get(key)
  if(hit&&hit.until>Date.now())return hit.data
  const inFlight=pending.get(key)
  if(inFlight)return inFlight
  const promise=(async()=>{
    const path=area==='hormuz'?'/api/ship/history':'/api/bab/ship/history'
    const uri=new URL(path,base)
    uri.searchParams.set('mmsi',mmsi)
    uri.searchParams.set('hours','168')
    const sourceUrl=base+(area==='hormuz'?'/live-map':'/bab-el-mandeb')
    let result:AISRoute={
      id:'sea:'+mmsi,mmsi,chokepointId:area,segments:[],points:0,
      firstSeenAt:null,lastSeenAt:null,sourceUrl,status:'unavailable',
    }
    try{
      const response=await fetch(uri.toString(),{
        headers:{Accept:'application/json'},
        signal:AbortSignal.timeout(6500),next:{revalidate:1800},
      })
      if(response.ok&&response.body){
        const contentLength=Number(response.headers.get('content-length')??0)
        if(contentLength<=800000){
          const text=await response.text()
          if(text.length<=800000){
            const segments=parseAISHistory(JSON.parse(text) as unknown)
            const flat=segments.flat()
            result={
              ...result,segments,points:flat.length,
              firstSeenAt:flat[0]?.time??null,lastSeenAt:flat.at(-1)?.time??null,
              status:flat.length?'observed':'no_history',
            }
          }
        }
      }
    }catch{ /* Missing upstream history is not a reason to invent a route. */ }
    cached.set(key,{until:Date.now()+(result.status==='observed'?1800000:300000),data:result})
    while(cached.size>250)cached.delete(cached.keys().next().value!)
    return result
  })()
  pending.set(key,promise)
  try{return await promise}finally{pending.delete(key)}
}
export type HistoryOverlay={generatedAt:string;routes:AISRoute[];checked:number;observed:number}
export async function getAISOverview(assets:readonly TrackingAsset[]):Promise<HistoryOverlay>{
  // Limit bulk traffic to a small best-effort sample on each overview.
  // Single-vessel history can be requested separately when selected.
  const ships=assets.filter(a=>a.kind==='vessel'&&a.chokepointId&&
    ['hormuz','bab_el_mandeb'].includes(a.chokepointId)).slice(0,16)
  const settled=await Promise.allSettled(ships.map(a=>fetchAISHistory(
    a.chokepointId!,a.id.slice(4))))
  const routes=settled.flatMap(v=>v.status==='fulfilled'?[v.value]:[])
  return {generatedAt:new Date().toISOString(),routes,checked:ships.length,
    observed:routes.filter(r=>r.status==='observed').length}
}
