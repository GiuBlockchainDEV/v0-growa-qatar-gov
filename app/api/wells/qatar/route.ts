import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {normalizeQatarWells,type QatarWellsPayload,type QatarWell} from '@/lib/wells/qatar-wells'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=30
const QUERY='[out:json][timeout:19];(nwr["man_made"="water_well"](24.4,50.65,26.3,51.8);nwr["man_made"="borehole"]["borehole"~"^(water|groundwater|water_well)$"](24.4,50.65,26.3,51.8););out center;'
const ENDPOINTS=[
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass-api.de/api/interpreter',
 'https://overpass.nchc.org.tw/api/interpreter',
] as const
const KEY='qatar-osm-wells-v1'
const CACHE_MS=12*60*60*1000
const STALE_MS=7*24*60*60*1000
let cache:{wells:QatarWell[];fetchedAt:number}|null=null
let inflight:Promise<QatarWell[]>|null=null
function response(wells:QatarWell[],status:QatarWellsPayload['sourceStatus'],
 fetched:number|null):QatarWellsPayload{
 return {
  wells,sourceStatus:status,source:'OpenStreetMap / Overpass',
  sourceUpdatedAt:fetched?new Date(fetched).toISOString():null,
  fetchedAt:new Date().toISOString(),total:wells.length,
  note:status==='unavailable'?
   'OpenStreetMap well service unavailable; no positions have been invented.':
   status==='stale'?'Previously retrieved public wells. The source cannot currently be refreshed.':
   'Public mapped wells only. This is not a complete government register or live aquifer monitoring.',
  attribution:'© OpenStreetMap contributors · ODbL',
 }
}
async function collect():Promise<QatarWell[]>{
 let last='No provider response'
 for(const base of ENDPOINTS){
  try{
   const controller=AbortSignal.timeout(7000)
   const res=await fetch(base,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',
     Accept:'application/json'},
    body:new URLSearchParams({data:QUERY}).toString(),
    signal:controller,cache:'no-store',
   })
   if(!res.ok){last='HTTP '+res.status;continue}
   const raw=await res.text()
   if(raw.length>3500000){last='Response too large';continue}
   const data=JSON.parse(raw) as unknown
   return normalizeQatarWells(data)
  }catch(err){last=err instanceof Error?err.name:'Network error'}
 }
 throw Error(last)
}
export async function GET(){
 const client=await createClient()
 const {data:{user},error}=await client.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401})
 const headers={'Cache-Control':'private, max-age=120'}
 if(cache&&Date.now()-cache.fetchedAt<CACHE_MS)
  return NextResponse.json(response(cache.wells,'available',cache.fetchedAt),{headers})
 if(!inflight)inflight=collect()
 try{
  const wells=await inflight
  cache={wells,fetchedAt:Date.now()}
  return NextResponse.json(response(wells,'available',cache.fetchedAt),{headers})
 }catch(err){
  console.warn('[Qatar Wells] Overpass unavailable',err)
  if(cache&&Date.now()-cache.fetchedAt<STALE_MS)
   return NextResponse.json(response(cache.wells,'stale',cache.fetchedAt),{headers})
  return NextResponse.json(response([],'unavailable',null),{
   status:503,headers:{'Cache-Control':'private, no-store'}})
 }finally{inflight=null}
}
