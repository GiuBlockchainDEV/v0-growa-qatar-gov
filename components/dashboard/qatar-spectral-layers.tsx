'use client'
import {useEffect,useRef,useState} from 'react'
import {Layers3,RefreshCw} from 'lucide-react'
import type {TileLayer} from 'leaflet'
import type {MapController} from '@/components/dashboard/map/map-model'
import {QATAR_SPECTRAL_BBOX,SPECTRAL_INDEX_CONFIG,type SpectralIndex,type SpectralTile} from '@/lib/satellite/qatar-spectral'

type TilePayload={
 index:SpectralIndex;url:string;startDate:string;endDate:string;notice:string
 mode?:'mosaic'|'stac-scenes';tiles?:SpectralTile[]
}
const NDVI_COLORS=['#a50026','#f46d43','#ffffbf','#a6d96a','#006837']
const NDMI_COLORS=['#a50026','#f46d43','#f7f7f7','#abd9e9','#313695']

/** Live-map-only Leaflet imagery, scoped to the Qatar nationwide STAC search.
 * One rendered spectral index at a time to avoid mixing incompatible legends.
 */
export function QatarSpectralLayers({map}:{map:MapController|null}){
 const [index,setIndex]=useState<SpectralIndex|null>(null)
 const [opacity,setOpacity]=useState(.7)
 const [payload,setPayload]=useState<TilePayload|null>(null)
 const [busy,setBusy]=useState(false)
 const [rendered,setRendered]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [retry,setRetry]=useState(0)
 const overlays=useRef<TileLayer[]>([])

 useEffect(()=>{
  if(!index){setPayload(null);setBusy(false);setRendered(false);setError(null);return}
  const controller=new AbortController()
  setPayload(null);setError(null);setBusy(true);setRendered(false)
  void fetch('/api/satellite/qatar-spectral?index='+index,{
   signal:controller.signal,cache:'no-store',
  }).then(async response=>{
   const body=await response.json() as Partial<TilePayload>&{error?:string;detail?:string}
   if(!response.ok)throw Error([body.error??'Microsoft service unavailable',body.detail].filter(Boolean).join(' · '))
   if(!body.url||body.index!==index||!body.startDate||!body.endDate)
    throw Error('Sentinel-2 tiles have no valid metadata')
   if(!controller.signal.aborted)setPayload(body as TilePayload)
  }).catch(err=>{
   if(!controller.signal.aborted){
    setError(err instanceof Error?err.message:'Spectral service unavailable')
    setBusy(false)
   }
  })
  return ()=>controller.abort()
 },[index,retry])

 useEffect(()=>{
  overlays.current.forEach(layer=>layer.remove())
  overlays.current=[]
  if(!map||!index||!payload||payload.index!==index)return
  let cancelled=false
  const layers:TileLayer[]=[]
  let loaded=0,failures=0
  void import('leaflet').then(module=>{
   if(cancelled)return
   const L=module.default
   const tiles=payload.tiles?.length?payload.tiles:[{
    url:payload.url,bbox:[...QATAR_SPECTRAL_BBOX] as [number,number,number,number],
    sceneDate:payload.endDate,
   }]
   for(const item of tiles){
    if(cancelled)break
    const bounds=L.latLngBounds(
     [item.bbox[1],item.bbox[0]],
     [item.bbox[3],item.bbox[2]],
    )
    const layer=L.tileLayer(item.url,{
     bounds,opacity,maxZoom:19,maxNativeZoom:14,
     attribution:'ESA Sentinel-2 L2A · Microsoft Planetary Computer',
     crossOrigin:true,
    }).addTo(map)
    layer.setZIndex(300+layers.length)
    layers.push(layer)
    layer.on('tileload',()=>{
     if(!cancelled){
      loaded+=1
      setRendered(true)
      setBusy(false)
     }
    })
    layer.on('tileerror',()=>{
     failures+=1
     // Some edge tiles may legitimately have no pixels. Do not call a
     // partially rendered national STAC mosaic a total failure.
     if(!cancelled&&loaded===0&&failures>=12){
      setBusy(false)
      setError('Satellite tiles failed to render. Try Retry or select OFF.')
     }
    })
   }
   overlays.current=layers
  }).catch(()=>{
   if(!cancelled){setError('Unable to initialize the satellite raster');setBusy(false)}
  })
  return ()=>{
   cancelled=true
   layers.forEach(layer=>layer.remove())
   overlays.current=overlays.current.filter(layer=>!layers.includes(layer))
  }
  // Keep opacity independent of STAC search or raster creation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[map,index,payload])

 useEffect(()=>{overlays.current.forEach(layer=>layer.setOpacity(opacity))},[opacity,payload])

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
     busy?'Retrieving Sentinel-2 imagery…':
     payload&&rendered?
      (payload.mode==='stac-scenes'?
       'STAC fallback · '+(payload.tiles?.length??1)+' satellite scene(s) · '+payload.startDate+' to '+payload.endDate:
       'Mosaic · '+payload.startDate+' to '+payload.endDate):
      'Initializing nationwide imagery…'}
   </p>
   <p className="mt-1 text-[9px] leading-4 text-content-soft">
    {payload?.mode==='stac-scenes'?'Regional Sentinel-2 scene coverage':'Qatar-wide mosaic'} ·
    scene cloud cover below 35%. Areas not covered by valid scenes stay transparent.
    Clouds, shadows and no-data pixels may remain. NDMI is not soil moisture.
   </p>
   {error&&<button type="button" onClick={()=>setRetry(x=>x+1)}
    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sage-700 underline">
    <RefreshCw size={12}/> Retry spectral imagery
   </button>}
  </>}
 </div>
}
