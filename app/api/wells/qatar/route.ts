import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {normalizeQatarWells,type QatarWell,type QatarWellsPayload} from '@/lib/wells/qatar-wells'
import {QATAR_GIS_BASE,QATAR_GIS_DATASETS,parseQatarGisWells,mergePublicWells} from '@/lib/wells/qatar-gis'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=30
type Status=NonNullable<QatarWellsPayload['providerStatuses']>[number]
type Result={wells:QatarWell[];status:Status}
type Snapshot={wells:QatarWell[];statuses:Status[];at:number}
let cache:Snapshot|null=null
let pending:Promise<Snapshot>|null=null
const bbox='(24.4,50.65,26.3,51.8)'
const query='[out:json][timeout:12];(nwr["man_made"="water_well"]'+bbox+
 ';nwr["man_made"="borehole"]["borehole"~"^(water|groundwater|water_well)$"]'+bbox+');out center;'
const overpass=['https://overpass.private.coffee/api/interpreter',
 'https://overpass-api.de/api/interpreter','https://overpass.nchc.org.tw/api/interpreter']
async function read(url:string,init?:RequestInit,ms=7500):Promise<unknown>{
 const response=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(ms)})
 if(!response.ok)throw Error('HTTP '+response.status)
 const raw=await response.text()
 if(raw.length>4500000)throw Error('Response too large')
 const data:unknown=JSON.parse(raw)
 if(data&&typeof data==='object'&&'error' in data)throw Error('Provider error')
 return data
}
async function fetchGis(dataset:typeof QATAR_GIS_DATASETS[number]):Promise<Result>{
 try{
  const url=new URL(QATAR_GIS_BASE+'/'+dataset.service+'/FeatureServer/0/query')
  Object.entries({where:'1=1',outFields:'*',returnGeometry:'true',
   outSR:'4326',resultRecordCount:'2000',f:'geojson'}).forEach(([key,val])=>url.searchParams.set(key,val))
  const wells=parseQatarGisWells(await read(url.toString(),undefined,8000),dataset)
  return {wells,status:{id:dataset.id,name:dataset.name,state:'available',count:wells.length}}
 }catch(err){
  return {wells:[],status:{id:dataset.id,name:dataset.name,state:'unavailable',
   count:0,detail:err instanceof Error?err.message:'Network failure'}}
 }
}
async function fetchOsm():Promise<Result>{
 let detail='Unavailable'
 for(const url of overpass){
  try{
   const wells=normalizeQatarWells(await read(url,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({data:query}).toString()},5500))
   return {wells,status:{id:'osm',name:'OpenStreetMap / Overpass',
    state:'available',count:wells.length}}
  }catch(err){detail=err instanceof Error?err.message:'Network failure'}
 }
 return {wells:[],status:{id:'osm',name:'OpenStreetMap / Overpass',
  state:'unavailable',count:0,detail}}
}
async function collect():Promise<Snapshot>{
 const [gis,osm]=await Promise.all([Promise.all(QATAR_GIS_DATASETS.map(fetchGis)),fetchOsm()])
 const sources=[...gis,osm],available=sources.filter(x=>x.status.state==='available')
 if(!available.length)throw Object.assign(new Error('All sources unavailable'),{
  statuses:sources.map(s=>s.status),
 })
 return {wells:mergePublicWells(available.map(x=>x.wells)),
  statuses:sources.map(s=>s.status),at:Date.now()}
}
const output=(snapshot:Snapshot|null,status:QatarWellsPayload['sourceStatus'],
 statuses:Status[]):QatarWellsPayload=>({
 wells:snapshot?.wells??[],sourceStatus:status,source:'Public GIS / OpenStreetMap',
 sourceUpdatedAt:snapshot?new Date(snapshot.at).toISOString():null,
 fetchedAt:new Date().toISOString(),total:snapshot?.wells.length??0,
 attribution:'UN-hosted public GIS records; © OpenStreetMap contributors (ODbL)',
 providerStatuses:statuses,
 note:status==='unavailable'?'All public well sources unavailable; zero mapped is not zero wells in Qatar.':
 status==='stale'?'Last previously fetched public records; data source temporarily unavailable.':
 status==='partial'?'Some public sources failed. Dataset is incomplete.':
 'Public geolocated records, not a complete national inventory or live monitoring.',
})
export async function GET(){
 const {data:{user},error}=await (await createClient()).auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401})
 const headers={'Cache-Control':'private, max-age=120'}
 if(cache&&Date.now()-cache.at<12*60*60*1000)
  return NextResponse.json(output(cache,cache.statuses.some(s=>s.state==='unavailable')?'partial':'available',cache.statuses),{headers})
 if(!pending)pending=collect()
 try{
  cache=await pending
  return NextResponse.json(output(cache,cache.statuses.some(s=>s.state==='unavailable')?'partial':'available',cache.statuses),{headers})
 }catch(err){
  console.warn('[Qatar Wells] providers failed',err)
  const statuses=cache?.statuses??(err&&typeof err==='object'&&'statuses' in err&&
   Array.isArray(err.statuses)?err.statuses as Status[]:[])
  if(cache&&Date.now()-cache.at<7*86400000)
   return NextResponse.json(output(cache,'stale',statuses),{headers})
  return NextResponse.json(output(null,'unavailable',statuses),{status:503,headers:{'Cache-Control':'private, no-store'}})
 }finally{pending=null}
}
