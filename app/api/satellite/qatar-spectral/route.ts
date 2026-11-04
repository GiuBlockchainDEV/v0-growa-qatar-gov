import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {MOSAIC_API,qatarMosaicSearch,spectralTileParams,isMicrosoftTileUrl,type SpectralIndex} from '@/lib/satellite/qatar-spectral'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=45

type MosaicRegistration={searchid?:string}
type TileJson={tiles?:string[]}
type SpectralResponse={
 index:SpectralIndex;url:string;startDate:string;endDate:string
 source:string;cloudCoverThreshold:number;notice:string
}
const cache=new Map<SpectralIndex,{until:number;value:SpectralResponse}>()
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'private, no-store'},
})

async function apiJson<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{
  ...init,signal:AbortSignal.timeout(18000),cache:'no-store',
 })
 if(!response.ok)throw Error('Microsoft Planetary Computer HTTP '+response.status)
 return await response.json() as T
}

export async function GET(request:Request){
 const raw=new URL(request.url).searchParams.get('index')
 if(raw!=='ndvi'&&raw!=='ndmi')return json({error:'Choose NDVI or NDMI.'},400)
 const index:SpectralIndex=raw
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return json({error:'Sign in to view the spectral map.'},401)
 const cached=cache.get(index)
 if(cached&&cached.until>Date.now())return json(cached.value)
 try{
  const now=new Date()
  const search=qatarMosaicSearch(now)
  const registered=await apiJson<MosaicRegistration>(MOSAIC_API+'/mosaic/register',{
   method:'POST',headers:{'Content-Type':'application/json',
    ...(process.env.PLANETARY_COMPUTER_API_KEY?
     {'Ocp-Apim-Subscription-Key':process.env.PLANETARY_COMPUTER_API_KEY}:{})},
   body:JSON.stringify(search),
  })
  if(!registered.searchid||!/^[a-f0-9-]{12,64}$/i.test(registered.searchid)){
   throw Error('Mosaic search registration returned no identifier')
  }
  const tileJsonUrl=new URL(MOSAIC_API+'/mosaic/'+registered.searchid+'/tilejson.json')
  spectralTileParams(index).forEach((value,key)=>tileJsonUrl.searchParams.append(key,value))
  const tileJson=await apiJson<TileJson>(tileJsonUrl.toString())
  const tileUrl=tileJson.tiles?.[0]
  if(!tileUrl||!isMicrosoftTileUrl(tileUrl))throw Error('No trusted tile template')
  const result:SpectralResponse={
   index,url:tileUrl,
   startDate:search.datetime.slice(0,10),endDate:now.toISOString().slice(0,10),
   source:'Microsoft Planetary Computer / ESA Sentinel-2 L2A',
   cloudCoverThreshold:35,
   notice:'Recent cloud-screened satellite scenes, not a cloud-free or pixel-masked image. No-data and cloudy pixels are not low NDVI/NDMI. Acquisition dates may differ across Qatar.',
  }
  cache.set(index,{value:result,until:Date.now()+6*60*60*1000})
  return json(result)
 }catch(err){
  console.error('[Qatar Spectral] Mosaic or TileJSON unavailable',err)
  return json({error:'The Microsoft Planetary Computer mosaic service is temporarily unavailable.'},503)
 }
}
