'use client'

import {useEffect,useRef,useState} from 'react'
import {Layers3,RefreshCw} from 'lucide-react'
import type {GridLayer,GridLayerOptions} from 'leaflet'
import type {MapController} from '@/components/dashboard/map/map-model'
import {QATAR_SPECTRAL_BBOX,SPECTRAL_INDEX_CONFIG,type SpectralIndex} from '@/lib/satellite/qatar-spectral'
import {clipTileToQatar} from '@/lib/satellite/qatar-clip'

type TilePayload={
 index:SpectralIndex
 url:string
 startDate:string
 endDate:string
 notice:string
 mode:'mosaic'
}
const NDVI_COLORS=['#a50026','#f46d43','#ffffbf','#a6d96a','#006837']
const NDMI_COLORS=['#a50026','#f46d43','#f7f7f7','#abd9e9','#313695']

function tileUrl(template:string,coords:{x:number;y:number;z:number}){
 // Microsoft TileJSON may percent-encode Leaflet's coordinate placeholders.
 return template.replace(/(?:\{|%7B)(z|x|y)(?:\}|%7D)/gi,(_,axis:string)=>
  String(coords[axis as keyof typeof coords]))
}

/** A single canvas GridLayer; each tile is clipped in true WebMercator pixel
 * coordinates BEFORE its satellite pixels are composited on the map. The
 * national boundary includes islands and handles polygon holes.
 */
export function QatarSpectralLayers({map}:{map:MapController|null}){
 const [index,setIndex]=useState<SpectralIndex|null>(null)
 const [opacity,setOpacity]=useState(.7)
 const [payload,setPayload]=useState<TilePayload|null>(null)
 const [busy,setBusy]=useState(false)
 const [rendered,setRendered]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [retry,setRetry]=useState(0)
 const overlay=useRef<GridLayer|null>(null)

 useEffect(()=>{
  if(!index){
   setPayload(null);setBusy(false);setRendered(false);setError(null)
   return
  }
  const controller=new AbortController()
  setPayload(null);setError(null);setBusy(true);setRendered(false)
  void fetch('/api/satellite/qatar-spectral?index='+index,{
   signal:controller.signal,cache:'no-store',
  }).then(async response=>{
   const body=await response.json() as Partial<TilePayload>&{error?:string;detail?:string}
   if(!response.ok)throw Error([body.error??'Microsoft service unavailable',
    body.detail].filter(Boolean).join(' · '))
   if(!body.url||body.index!==index||body.mode!=='mosaic'||
    !body.startDate||!body.endDate)
    throw Error('A single valid Sentinel-2 mosaic was not returned')
   if(!controller.signal.aborted)setPayload(body as TilePayload)
  }).catch(reason=>{
   if(!controller.signal.aborted){
    setError(reason instanceof Error?reason.message:'Spectral imagery unavailable')
    setBusy(false)
   }
  })
  return ()=>controller.abort()
 },[index,retry])

 useEffect(()=>{
  overlay.current?.remove()
  overlay.current=null
  if(!map||!index||!payload||payload.index!==index)return
  let disposed=false
  let layer:GridLayer|null=null
  void import('leaflet').then(module=>{
   if(disposed)return
   const L=module.default
   const bounds=L.latLngBounds(
    [QATAR_SPECTRAL_BBOX[1],QATAR_SPECTRAL_BBOX[0]],
    [QATAR_SPECTRAL_BBOX[3],QATAR_SPECTRAL_BBOX[2]],
   )
   const Raster=L.GridLayer.extend({
    createTile(coords:L.Coords,done:(error:Error|null,tile:HTMLElement)=>void){
     const canvas=document.createElement('canvas')
     canvas.width=256;canvas.height=256
     const context=canvas.getContext('2d')
     if(!context){
      done(new Error('Canvas rendering not supported'),canvas)
      return canvas
     }
     const image=new Image()
     image.crossOrigin='anonymous'
     image.onload=()=>{
      if(disposed)return
      try{
       context.save()
       clipTileToQatar(context,(lon,lat)=>{
        const world=map.project(L.latLng(lat,lon),coords.z)
        return {x:world.x-coords.x*256,y:world.y-coords.y*256}
       })
       context.drawImage(image,0,0,256,256)
       context.restore()
       done(null,canvas)
      }catch(err){
       context.restore()
       done(err instanceof Error?err:new Error('Clipping failed'),canvas)
      }
     }
     image.onerror=()=>{if(!disposed)done(new Error('Sentinel-2 tile unavailable'),canvas)}
     image.src=tileUrl(payload.url,coords)
     return canvas
    },
   }) as unknown as new(options?:GridLayerOptions)=>GridLayer
   layer=new Raster({
    bounds,opacity,tileSize:256,maxZoom:19,maxNativeZoom:14,
    attribution:'ESA Sentinel-2 L2A · Microsoft Planetary Computer · Natural Earth',
    updateWhenIdle:true,keepBuffer:2,
   }) as GridLayer
   layer.addTo(map)
   const container=layer.getContainer()
   if(container)container.style.opacity=String(opacity)
   layer.setZIndex(300)
   overlay.current=layer
   let failures=0
   layer.on('tileload',()=>{
    if(!disposed){setRendered(true);setBusy(false)}
   })
   layer.on('tileerror',()=>{
    failures+=1
    if(!disposed&&failures>=8){
     setBusy(false)
     setError('The mosaic tiles cannot be rendered. Check Planetary Computer and retry.')
    }
   })
  }).catch(()=>{
   if(!disposed){setBusy(false);setError('Unable to initialize the Qatar mask')}
  })
  return ()=>{
   disposed=true
   layer?.remove()
   if(overlay.current===layer)overlay.current=null
  }
  // Opacity is a separate layer property and must not create new raster tiles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[map,index,payload])

 useEffect(()=>{
  const container=overlay.current?.getContainer()
  if(container)container.style.opacity=String(opacity)
 },[opacity,payload])

 const toggle=(choice:SpectralIndex|null)=>{
  setIndex(choice===index?null:choice)
  setError(null)
 }
 const colors=index==='ndvi'?NDVI_COLORS:NDMI_COLORS
 return <div className="absolute start-1/2 top-4 z-[1150] w-[min(33rem,calc(100%-7rem))] -translate-x-1/2 rounded-xl border border-line bg-card/95 p-3 shadow-panel backdrop-blur-md"
  role="group" aria-label="Qatar-wide satellite spectral indices">
  <div className="flex items-center justify-between gap-2">
   <span className="flex items-center gap-2 text-[11px] font-semibold text-content">
    <Layers3 size={15} className="text-sage-700"/>
    Qatar · Spectral layers
   </span>
   <span className="text-[9px] font-semibold text-content-soft">
    SENTINEL-2 · MICROSOFT PLANETARY COMPUTER
   </span>
  </div>
  <div className="mt-2 grid grid-cols-3 gap-2">
   {([null,'ndvi','ndmi'] as const).map(choice=><button
    key={choice??'off'} type="button" onClick={()=>toggle(choice)}
    aria-pressed={index===choice}
    className={'rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors '+
     (index===choice?'border-ink bg-ink text-white':
      'border-line bg-background text-content hover:bg-cream-100')}>
    {choice===null?'OFF':choice.toUpperCase()}
   </button>)}
  </div>
  {index&&<>
   <div className="mt-2 flex items-center justify-between gap-2">
    <span className="text-[10px] text-content-soft">{SPECTRAL_INDEX_CONFIG[index].description}</span>
    <span className="text-[10px] font-semibold tabular-nums text-content">{Math.round(opacity*100)}%</span>
   </div>
   <input type="range" min="20" max="100" step="5" value={Math.round(opacity*100)}
    onChange={event=>setOpacity(Number(event.target.value)/100)}
    aria-label="Spectral layer opacity" className="mt-1 w-full accent-sage-700"/>
   <div className="mt-2 grid grid-cols-5 gap-1" aria-label={index.toUpperCase()+' index legend'}>
    {colors.map(color=><i key={color} className="h-2 rounded-sm" style={{backgroundColor:color}}/>)}
   </div>
   <div className="mt-1 flex justify-between text-[9px] text-content-soft">
    <span>{index==='ndvi'?'Lower greenness':'Drier vegetation'}</span>
    <span>{index==='ndvi'?'Higher greenness':'Wetter vegetation'}</span>
   </div>
   <p role="status" className="mt-2 text-[10px] leading-4 text-content-soft">
    {error?'Satellite service: '+error:
     busy?'Retrieving and clipping Sentinel-2 imagery…':
     payload&&rendered?'Qatar boundary mask · '+payload.startDate+' to '+payload.endDate:
     'Initializing the national satellite mosaic…'}
   </p>
   <p className="mt-1 text-[9px] leading-4 text-content-soft">
    Single mosaic, geographically clipped to Qatar including islands.
    Cloud, shadow and no-data pixels may remain. NDMI is not soil moisture.
   </p>
   {error&&<button type="button" onClick={()=>setRetry(x=>x+1)}
    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sage-700 underline">
    <RefreshCw size={12}/> Retry spectral imagery
   </button>}
  </>}
 </div>
}
