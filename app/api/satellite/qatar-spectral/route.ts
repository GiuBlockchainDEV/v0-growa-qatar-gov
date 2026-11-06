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

type MosaicRegistration={searchid?:string;links?:Array<{rel?:string;href?:string}>}
type TileJson={tiles?:string[]}
type StacSearch={features?:StacSceneFeature[]}
type SpectralResponse={
 index:SpectralIndex
 mode:'mosaic'|'stac-composite'
 tiles:Array<SpectralTile&{cloudCover?:number}>
 url:string
 startDate:string
 endDate:string
 source:string
 cloudCoverThreshold:number
 notice:string
}
type Stage='register'|'mosaic_tilejson'|'stac_search'|'stac_tilejson'
class ProviderError extends Error{
 constructor(readonly stage:Stage,readonly status:number|null,reason?:string){
  super(stage+': '+(status===null?'network/timeout or invalid JSON':'HTTP '+status)+
   (reason?' ('+reason+')':''))
 }
}
const completed=new Map<SpectralIndex,{until:number;value:SpectralResponse}>()
const inFlight=new Map<SpectralIndex,Promise<SpectralResponse>>()
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'private, no-store'},
})
const optionalPlanetaryHeaders=():Record<string,string>=>{
 const key=process.env.PLANETARY_COMPUTER_API_KEY
 return key?{'Ocp-Apim-Subscription-Key':key}:{}
}
async function apiJson<T>(url:string,stage:Stage,init?:RequestInit,timeoutMs=8000):Promise<T>{
 let res:Response
 try{
  res=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(timeoutMs),
   headers:{...optionalPlanetaryHeaders(),...(init?.headers as Record<string,string>|undefined)}})
 }catch{throw new ProviderError(stage,null)}
 if(!res.ok){
  // Preserve the provider stage and HTTP status. Do not leak provider
  // response bodies, signed asset URLs or API credentials to the browser.
  throw new ProviderError(stage,res.status)
 }
 try{return await res.json() as T}
 catch{throw new ProviderError(stage,res.status,'invalid JSON response')}
}
function appendParams(base:string,index:SpectralIndex,sceneId?:string):string{
 const url=new URL(base)
 spectralTileParams(index).forEach((value,key)=>url.searchParams.append(key,value))
 if(sceneId)url.searchParams.set('item',sceneId)
 return url.toString()
}
function response(
 index:SpectralIndex,mode:SpectralResponse['mode'],
 tiles:SpectralResponse['tiles'],startDate:string,endDate:string,
 notice:string,
):SpectralResponse{
 return {
  index,mode,url:tiles[0].url,tiles,startDate,endDate,
  source:'ESA Sentinel-2 L2A / Microsoft Planetary Computer',
  cloudCoverThreshold:35,notice,
 }
}
async function tryRegisteredMosaic(index:SpectralIndex,now:Date):Promise<SpectralResponse>{
 const search=qatarMosaicSearch(now)
 const registered=await apiJson<MosaicRegistration>(MOSAIC_API+'/mosaic/register','register',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(search),
 },6500)
 if(!registered.searchid||!/^[a-z0-9-]{12,100}$/i.test(registered.searchid))
  throw new ProviderError('register',null,'no valid searchid')
 // Use the actual TileJSON endpoint returned by Microsoft when available,
 // rather than inventing a /mosaic/collections route (which returns 404).
 const returned=registered.links?.find(link=>link.rel==='tilejson')?.href
 let tilejsonUrl=MOSAIC_API+'/mosaic/'+registered.searchid+'/tilejson.json'
 if(returned){
  const parsed=new URL(returned)
  if(parsed.protocol==='https:'&&parsed.hostname==='planetarycomputer.microsoft.com'&&
   parsed.pathname.startsWith('/api/data/v1/mosaic/')&&
   parsed.pathname.endsWith('/tilejson.json'))tilejsonUrl=returned
 }
 const jsonData=await apiJson<TileJson>(appendParams(tilejsonUrl,index),
  'mosaic_tilejson',undefined,9000)
 const url=jsonData.tiles?.[0]
 if(!url||!isMicrosoftTileUrl(url))
  throw new ProviderError('mosaic_tilejson',null,'unrecognized tile template')
 return response(index,'mosaic',[{
  url,bbox:[...QATAR_SPECTRAL_BBOX],sceneDate:now.toISOString().slice(0,10),
 }],search.datetime.slice(0,10),now.toISOString().slice(0,10),
 'Registered PgSTAC mosaic, clipped to Qatar. Cloudy or no-data pixels may remain.')
}

/** Public Planetary Computer STAC Search is independent of mosaic/register.
 * If PgSTAC is overloaded, retrieve actual Sentinel-2 item tile URLs and
 * let ONE Leaflet canvas layer feather/composite them per map tile.
 */
async function stacComposite(index:SpectralIndex,now:Date):Promise<SpectralResponse>{
 const search=qatarMosaicSearch(now)
 const catalogue=await apiJson<StacSearch>(STAC_API+'/search','stac_search',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
   collections:search.collections,bbox:search.bbox,datetime:search.datetime,
   query:search.query,sortby:search.sortby,limit:240,
  }),
 },10500)
 const candidates=selectQatarSentinelScenes(catalogue.features??[],index,18)
 if(!candidates.length)throw new ProviderError('stac_search',null,
  'no usable low-cloud scenes returned')
 const tiles:SpectralResponse['tiles']=[]
 // The previous STAC fallback correctly obtained actual satellite images,
 // but drew each scene as a separate overlay. We ONLY return metadata here;
 // the client now composites pixel data in a single clipped GridLayer.
 for(let at=0;at<candidates.length;at+=6){
  const batch=candidates.slice(at,at+6)
  const results=await Promise.allSettled(batch.map(async scene=>{
   const tilejson=await apiJson<TileJson>(
    appendParams(MOSAIC_API+'/item/tilejson.json',index,scene.id),
    'stac_tilejson',undefined,8000)
   const url=tilejson.tiles?.[0]
   if(!url||!isMicrosoftTileUrl(url))
    throw new ProviderError('stac_tilejson',null,'unrecognized tile template')
   return {url,bbox:scene.bbox,sceneDate:scene.sceneDate,
    cloudCover:scene.cloudCover} as SpectralResponse['tiles'][number]
  }))
  results.forEach(result=>{
   if(result.status==='fulfilled')tiles.push(result.value)
  })
 }
 if(!tiles.length)throw new ProviderError('stac_tilejson',null,
  'no scenes yielded usable rendered tiles')
 tiles.sort((a,b)=>a.sceneDate.localeCompare(b.sceneDate))
 return response(index,'stac-composite',tiles,
  search.datetime.slice(0,10),now.toISOString().slice(0,10),
  tiles.length+' observed scenes composed per tile with feathered overlaps. '+
  'Up to three authentic scenes per MGRS tile are combined for stronger coverage. ' +
  'Dates may differ and no-data gaps remain transparent; this is not a quantitative, single-date index measurement.')
}
async function resolve(index:SpectralIndex):Promise<SpectralResponse>{
 const now=new Date()
 let firstFailure:unknown
 try{return await tryRegisteredMosaic(index,now)}
 catch(error){
  firstFailure=error
  console.warn('[Qatar Spectral] PgSTAC mosaic unavailable',error)
 }
 try{return await stacComposite(index,now)}
 catch(error){
  const first=firstFailure instanceof Error?firstFailure.message:'mosaic unavailable'
  const second=error instanceof Error?error.message:'STAC fallback unavailable'
  throw new Error(first+'; '+second)
 }
}
export async function GET(request:Request){
 const raw=new URL(request.url).searchParams.get('index')
 if(raw!=='ndvi'&&raw!=='ndmi'&&raw!=='ndsi')
  return json({error:'Choose NDVI, NDMI or NDSI.'},400)
 const index:SpectralIndex=raw
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)
  return json({error:'Sign in to view satellite imagery.'},401)
 const ready=completed.get(index)
 if(ready&&ready.until>Date.now())return json(ready.value)
 let pending=inFlight.get(index)
 if(!pending){
  pending=resolve(index)
  inFlight.set(index,pending)
 }
 try{
  const payload=await pending
  // Tile templates may contain provider-issued signed query parameters.
  // Avoid reusing stale source URLs for three hours.
  completed.set(index,{value:payload,until:Date.now()+20*60*1000})
  return json(payload)
 }catch(error){
  const detail=error instanceof Error?error.message:'Unknown satellite service failure'
  console.error('[Qatar Spectral] No satellite source returned usable images:',detail)
  return json({
   error:'Sentinel-2 imagery could not be loaded from Microsoft Planetary Computer.',
   detail,retryable:true,
  },503)
 }finally{
  if(inFlight.get(index)===pending)inFlight.delete(index)
 }
}
