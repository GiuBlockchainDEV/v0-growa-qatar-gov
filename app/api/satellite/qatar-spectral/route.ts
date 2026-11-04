import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {
 MOSAIC_API,QATAR_SPECTRAL_BBOX,qatarMosaicSearch,
 spectralTileParams,isMicrosoftTileUrl,type SpectralIndex,
} from '@/lib/satellite/qatar-spectral'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=45

type MosaicRegistration={searchid?:string}
type TileJson={tiles?:string[]}
type SpectralResponse={
 index:SpectralIndex
 url:string
 mode:'mosaic'
 startDate:string
 endDate:string
 source:string
 cloudCoverThreshold:number
 notice:string
}
type Stage='register'|'registered_mosaic'|'collection_mosaic'
class ProviderError extends Error{
 constructor(readonly stage:Stage,readonly status:number|null){
  super(stage+': '+(status===null?'invalid response or timeout':'HTTP '+status))
 }
}
const cache=new Map<SpectralIndex,{until:number;value:SpectralResponse}>()
const inflight=new Map<SpectralIndex,Promise<SpectralResponse>>()
const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'Cache-Control':'private, no-store'},
})

async function requestJson<T>(url:string,stage:Stage,init?:RequestInit):Promise<T>{
 let response:Response
 try{
  response=await fetch(url,{...init,cache:'no-store',
   signal:AbortSignal.timeout(15000)})
 }catch{throw new ProviderError(stage,null)}
 if(!response.ok)throw new ProviderError(stage,response.status)
 try{return await response.json() as T}
 catch{throw new ProviderError(stage,null)}
}
function queryUrl(base:string,index:SpectralIndex,filter?:ReturnType<typeof qatarMosaicSearch>){
 const url=new URL(base)
 spectralTileParams(index).forEach((value,key)=>url.searchParams.append(key,value))
 if(filter){
  url.searchParams.set('bbox',filter.bbox.join(','))
  url.searchParams.set('datetime',filter.datetime)
  url.searchParams.set('query',JSON.stringify(filter.query))
  url.searchParams.set('sortby',JSON.stringify(filter.sortby))
 }
 return url.toString()
}
async function singleMosaic(index:SpectralIndex):Promise<SpectralResponse>{
 const today=new Date()
 const search=qatarMosaicSearch(today)
 let tile:string|null=null
 let registeredError:unknown=null
 try{
  const registered=await requestJson<MosaicRegistration>(
   MOSAIC_API+'/mosaic/register','register',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(search),
   })
  if(!registered.searchid||!/^[a-z0-9-]{12,100}$/i.test(registered.searchid))
   throw new ProviderError('register',null)
  const tilejson=await requestJson<TileJson>(
   queryUrl(MOSAIC_API+'/mosaic/'+registered.searchid+'/tilejson.json',index),
   'registered_mosaic')
  const candidate=tilejson.tiles?.[0]
  if(!candidate||!isMicrosoftTileUrl(candidate))
   throw new ProviderError('registered_mosaic',null)
  tile=candidate
 }catch(error){
  registeredError=error
  console.warn('[Qatar Spectral] Registered mosaic unavailable',error)
 }
 // If registration is unavailable, a COLLECTION mosaic is still ONE raster
 // (unlike overlapping STAC scenes). Do not return the old scene fallback.
 if(!tile){
  try{
   const fallback=await requestJson<TileJson>(
    queryUrl(MOSAIC_API+'/mosaic/collections/sentinel-2-l2a/tilejson.json',index,search),
    'collection_mosaic')
   if(!fallback.tiles?.[0]||!isMicrosoftTileUrl(fallback.tiles[0]))
    throw new ProviderError('collection_mosaic',null)
   tile=fallback.tiles[0]
  }catch(error){
   const reason=registeredError instanceof Error?registeredError.message:'mosaic registration unavailable'
   const alternate=error instanceof Error?error.message:'collection mosaic unavailable'
   throw new Error(reason+'; '+alternate)
  }
 }
 return {
  index,url:tile,mode:'mosaic',startDate:search.datetime.slice(0,10),
  endDate:today.toISOString().slice(0,10),
  source:'ESA Sentinel-2 L2A / Microsoft Planetary Computer',
  cloudCoverThreshold:35,
  notice:'Single Sentinel-2 mosaic clipped to Qatar Natural Earth 1:10m boundary. Scenes and cloud coverage are approximate; no-data regions remain transparent.',
 }
}
export async function GET(request:Request){
 const index=new URL(request.url).searchParams.get('index')
 if(index!=='ndvi'&&index!=='ndmi')return json({error:'Choose NDVI or NDMI.'},400)
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return json({error:'Sign in to view the spectral map.'},401)
 const existing=cache.get(index)
 if(existing&&existing.until>Date.now())return json(existing.value)
 let pending=inflight.get(index)
 if(!pending){
  pending=singleMosaic(index)
  inflight.set(index,pending)
 }
 try{
  const value=await pending
  cache.set(index,{value,until:Date.now()+3*60*60*1000})
  return json(value)
 }catch(error){
  const detail=error instanceof Error?error.message:'Unknown mosaic failure'
  console.error('[Qatar Spectral] No single contiguous mosaic available',detail)
  return json({
   error:'A seamless Qatar spectral mosaic is currently unavailable. Scene overlays are intentionally disabled to prevent cross-shaped artifacts.',
   detail,retryable:true,
  },503)
 }finally{
  if(inflight.get(index)===pending)inflight.delete(index)
 }
}
