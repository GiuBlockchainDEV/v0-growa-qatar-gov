import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {
 MOSAIC_API,STAC_API,QATAR_SPECTRAL_BBOX,qatarMosaicSearch,
 spectralTileParams,isMicrosoftTileUrl,selectQatarSentinelScenes,
 type SpectralIndex,type SpectralTile,type StacSceneFeature,
} from '@/lib/satellite/qatar-spectral'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=45

type Registration={searchid?:string}
type TileJson={tiles?:string[]}
type StacResponse={features?:StacSceneFeature[]}
type SpectralResponse={
 index:SpectralIndex;url:string;tiles:SpectralTile[]
 mode:'mosaic'|'stac-scenes';startDate:string;endDate:string
 source:string;cloudCoverThreshold:number;notice:string
}
type FetchStage='register'|'mosaic_tilejson'|'stac_search'|'stac_tilejson'
class ProviderError extends Error{
 constructor(readonly stage:FetchStage,readonly status:number|null){
  super(stage+': '+(status===null?'network/timeout':'HTTP '+status))
 }
}
const successCache=new Map<SpectralIndex,{until:number;value:SpectralResponse}>()
const activeRequests=new Map<SpectralIndex,Promise<SpectralResponse>>()
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'private, no-store'},
})
async function apiJson<T>(
 url:string,stage:FetchStage,init?:RequestInit,timeoutMs=12000,
):Promise<T>{
 let response:Response
 try{
  response=await fetch(url,{
   ...init,cache:'no-store',signal:AbortSignal.timeout(timeoutMs),
  })
 }catch{throw new ProviderError(stage,null)}
 if(!response.ok)throw new ProviderError(stage,response.status)
 try{return await response.json() as T}
 catch{throw new ProviderError(stage,response.status)}
}
function urlWithParams(base:string,index:SpectralIndex,item?:string){
 const url=new URL(base)
 spectralTileParams(index).forEach((value,key)=>url.searchParams.append(key,value))
 if(item)url.searchParams.set('item',item)
 return url.toString()
}
function resultFor(index:SpectralIndex,mode:SpectralResponse['mode'],
 tiles:SpectralTile[],startDate:string,endDate:string,notice:string):SpectralResponse{
 return {index,url:tiles[0].url,tiles,mode,startDate,endDate,
  source:'ESA Sentinel-2 L2A / Microsoft Planetary Computer',
  cloudCoverThreshold:35,notice}
}
async function registeredMosaic(index:SpectralIndex,now:Date):Promise<SpectralResponse>{
 const search=qatarMosaicSearch(now)
 const registration=await apiJson<Registration>(MOSAIC_API+'/mosaic/register','register',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(search),
 },15000)
 if(!registration.searchid||!/^[0-9a-f-]{24,64}$/i.test(registration.searchid))
  throw new ProviderError('register',null)
 const template=await apiJson<TileJson>(
  urlWithParams(MOSAIC_API+'/mosaic/'+registration.searchid+'/tilejson.json',index),
  'mosaic_tilejson',
 )
 const url=template.tiles?.[0]
 if(!url||!isMicrosoftTileUrl(url))throw new ProviderError('mosaic_tilejson',null)
 return resultFor(index,'mosaic',[{
  url,bbox:[...QATAR_SPECTRAL_BBOX],
  sceneDate:now.toISOString().slice(0,10),
 }],search.datetime.slice(0,10),now.toISOString().slice(0,10),
 'Cloud-screened scene-level mosaic. Actual acquisition dates may vary and uncovered areas remain transparent.')
}
/** Avoid repeated PgSTAC registration when that service responds with HTTP 500.
 * The publicly documented STAC Search + Item TileJSON APIs render selected
 * Sentinel-2 acquisitions directly, one tile per MGRS region.
 */
async function stacItemFallback(index:SpectralIndex,now:Date):Promise<SpectralResponse>{
 const search=qatarMosaicSearch(now)
 const stac=await apiJson<StacResponse>(STAC_API+'/search','stac_search',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   collections:search.collections,
   bbox:search.bbox,
   datetime:search.datetime,
   query:search.query,
   sortby:search.sortby,
   limit:180,
  }),
 },13000)
 const selected=selectQatarSentinelScenes(stac.features??[],index,12)
 if(!selected.length)throw new ProviderError('stac_search',null)
 const tiles:SpectralTile[]=[]
 // Small batches prevent triggering Microsoft API rate limits.
 for(let i=0;i<selected.length;i+=4){
  const batch=selected.slice(i,i+4)
  const attempted=await Promise.allSettled(batch.map(async scene=>{
   const response=await apiJson<TileJson>(
    urlWithParams(MOSAIC_API+'/item/tilejson.json',index,scene.id),
    'stac_tilejson',undefined,9000,
   )
   const url=response.tiles?.[0]
   if(!url||!isMicrosoftTileUrl(url))throw new ProviderError('stac_tilejson',null)
   return {url,bbox:scene.bbox,sceneDate:scene.sceneDate} as SpectralTile
  }))
  attempted.forEach(x=>{if(x.status==='fulfilled')tiles.push(x.value)})
 }
 if(!tiles.length)throw new ProviderError('stac_tilejson',null)
 // Draw older scenes first, giving newer acquisitions priority where they overlap.
 tiles.sort((a,b)=>a.sceneDate.localeCompare(b.sceneDate))
 return resultFor(index,'stac-scenes',tiles,search.datetime.slice(0,10),
  now.toISOString().slice(0,10),
  tiles.length+' verified Sentinel-2 item tiles selected by STAC. This fallback may show gaps; no unmeasured areas are filled in.')
}
async function resolve(index:SpectralIndex):Promise<SpectralResponse>{
 const now=new Date()
 let primaryFailure:unknown
 try{return await registeredMosaic(index,now)}
 catch(err){primaryFailure=err;console.warn('[Qatar Spectral] Registered mosaic unavailable',err)}
 try{
  const fallback=await stacItemFallback(index,now)
  console.info('[Qatar Spectral] Using STAC item tiles after mosaic failure')
  return fallback
 }catch(fallbackFailure){
  const primary=primaryFailure instanceof ProviderError?primaryFailure.message:'mosaic error'
  const secondary=fallbackFailure instanceof ProviderError?fallbackFailure.message:'STAC error'
  throw new Error('Mosaic '+primary+'; alternative '+secondary)
 }
}

export async function GET(request:Request){
 const raw=new URL(request.url).searchParams.get('index')
 if(raw!=='ndvi'&&raw!=='ndmi')return json({error:'Choose NDVI or NDMI.'},400)
 const index:SpectralIndex=raw
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return json({error:'Sign in to view the spectral map.'},401)
 const cached=successCache.get(index)
 if(cached&&cached.until>Date.now())return json(cached.value)
 let pending=activeRequests.get(index)
 if(!pending){
  pending=resolve(index)
  activeRequests.set(index,pending)
 }
 try{
  const result=await pending
  successCache.set(index,{value:result,until:Date.now()+3*60*60*1000})
  return json(result)
 }catch(err){
  const diagnostic=err instanceof Error?err.message:'Unknown Planetary Computer failure'
  console.error('[Qatar Spectral] Both sources unavailable:',diagnostic)
  return json({
   error:'Microsoft Planetary Computer could not deliver Sentinel-2 tiles.',
   detail:diagnostic,
   retryable:true,
  },503)
 }finally{
  if(activeRequests.get(index)===pending)activeRequests.delete(index)
 }
}
