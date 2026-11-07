'use client'

import {useEffect,useRef,useState} from 'react'
import {Layers3,RefreshCw} from 'lucide-react'
import type {GridLayer,GridLayerOptions} from 'leaflet'
import type {MapController} from '@/components/dashboard/map/map-model'
import {QATAR_SPECTRAL_BBOX,SPECTRAL_INDEX_CONFIG,
 SPECTRAL_OVERVIEW_ZOOM,SPECTRAL_DETAIL_ZOOM,SPECTRAL_DETAIL_START_ZOOM,
 NDSI_CONTRAST_RANGES,DEFAULT_NDSI_CONTRAST,
 type NdsiContrast,type SpectralIndex,type SpectralTile} from '@/lib/satellite/qatar-spectral'
import {clipTileToQatar} from '@/lib/satellite/qatar-clip'
import {
 blendSpectralPixels,tileScenePixelBox,intersectsPixelTile,
} from '@/lib/satellite/qatar-raster-composite'

type TilePayload={
 index:SpectralIndex
 url:string
 tiles:Array<SpectralTile&{cloudCover?:number}>
 startDate:string
 endDate:string
 notice:string
 mode:'mosaic'|'stac-composite'
}
const NDVI_COLORS=['#a50026','#f46d43','#ffffbf','#a6d96a','#006837']
const NDMI_COLORS=['#A50026','#F46D43','#F7F7F7','#64B5D7','#163C8C']
const NDSI_COLORS=['#fcfbfd','#dadaeb','#9e9ac8','#756bb1','#54278f']
const TILE_SIZE=256
const SPECTRAL_PANE='growa-spectral-raster'
/** Cache successful, source-backed raster pixels across Leaflet tile disposal.
 * ~180 * 256 * 256 * 4 = 45 MB upper bound; failures are never cached. */
const MAX_CACHED_RASTERS=180
const cachedRasters=new Map<string,Uint8ClampedArray>()
function cachedRaster(url:string):Uint8ClampedArray|undefined{
 const pixels=cachedRasters.get(url)
 if(pixels){
  cachedRasters.delete(url)
  cachedRasters.set(url,pixels)
 }
 return pixels
}
function rememberRaster(url:string,pixels:Uint8ClampedArray):void{
 cachedRasters.delete(url)
 cachedRasters.set(url,pixels)
 while(cachedRasters.size>MAX_CACHED_RASTERS){
  const oldest=cachedRasters.keys().next().value
  if(!oldest)break
  cachedRasters.delete(oldest)
 }
}

function tileUrl(template:string,coords:{x:number;y:number;z:number}){
 return template.replace(/(?:\{|%7B)(z|x|y)(?:\}|%7D)/gi,(_,axis:string)=>
  String(coords[axis as keyof typeof coords]))
}
/** Bounded concurrent image loads with abort handling and retry on transient failures. */
const RASTER_MAX_CONCURRENT=6
let activeRasterLoads=0
const rasterQueue:Array<()=>void>=[]
async function withRasterPermit(signal:AbortSignal):Promise<()=>void>{
 if(signal.aborted)throw Error('Raster request cancelled')
 if(activeRasterLoads>=RASTER_MAX_CONCURRENT){
  await new Promise<void>((resolve,reject)=>{
   const wake=()=>{signal.removeEventListener('abort',cancel);resolve()}
   const cancel=()=>{
    const at=rasterQueue.indexOf(wake)
    if(at>=0)rasterQueue.splice(at,1)
    reject(Error('Raster request cancelled'))
   }
   rasterQueue.push(wake)
   signal.addEventListener('abort',cancel,{once:true})
  })
  if(signal.aborted){
   const next=rasterQueue.shift()
   if(next)next()
   else activeRasterLoads--
   throw Error('Raster request cancelled')
  }
 }else activeRasterLoads++
 return ()=>{const next=rasterQueue.shift();if(next)next();else activeRasterLoads--}
}
function singleRasterLoad(url:string,signal:AbortSignal):Promise<Uint8ClampedArray>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('Raster request cancelled'));return}
  const image=new Image()
  image.crossOrigin='anonymous'
  let complete=false
  const cleanup=()=>{
   clearTimeout(timeout)
   signal.removeEventListener('abort',cancel)
   image.onload=null;image.onerror=null
  }
  const fail=(error:string)=>{
   if(complete)return
   complete=true;cleanup();image.src='';reject(Error(error))
  }
  const cancel=()=>fail('Raster request cancelled')
  const timeout=setTimeout(()=>fail('Satellite tile timeout'),10000)
  signal.addEventListener('abort',cancel,{once:true})
  image.onload=()=>{
   if(complete)return
   complete=true;cleanup()
   try{
    const canvas=document.createElement('canvas')
    canvas.width=TILE_SIZE;canvas.height=TILE_SIZE
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)throw Error('Pixel compositing is unsupported')
    ctx.drawImage(image,0,0,TILE_SIZE,TILE_SIZE)
    resolve(ctx.getImageData(0,0,TILE_SIZE,TILE_SIZE).data)
   }catch(error){reject(error)}
  }
  image.onerror=()=>fail('Satellite image tile unavailable')
  image.src=url
 })
}
async function loadRasterPixelData(url:string,signal:AbortSignal):Promise<Uint8ClampedArray>{
 if(signal.aborted)throw Error('Raster request cancelled')
 const previouslyLoaded=cachedRaster(url)
 if(previouslyLoaded)return previouslyLoaded
 const release=await withRasterPermit(signal)
 try{
  // A preceding queued render may already have fetched this identical tile.
  if(signal.aborted)throw Error('Raster request cancelled')
  const afterQueue=cachedRaster(url)
  if(afterQueue)return afterQueue
  let last:unknown
  for(let attempt=0;attempt<3;attempt++){
   if(signal.aborted)throw Error('Raster request cancelled')
   try{
    const pixels=await singleRasterLoad(url,signal)
    rememberRaster(url,pixels)
    return pixels
   }catch(error){
    last=error
    if(attempt<2&&!signal.aborted)
      await new Promise<void>(resolve=>setTimeout(resolve,(attempt+1)*400))
   }
  }
  throw last instanceof Error?last:Error('Raster tile unavailable')
 }finally{release()}
}
function validTiles(payload:TilePayload):Array<SpectralTile&{cloudCover?:number}>{
 return payload.mode==='stac-composite'&&payload.tiles.length?
  payload.tiles:[{url:payload.url,bbox:[...QATAR_SPECTRAL_BBOX],sceneDate:payload.endDate}]
}

/** Stable native-grid layers for Qatar NDVI / NDMI / NDSI presentation.
 * PgSTAC renders a single mosaic directly. When PgSTAC fails,
 * actual Sentinel-2 scene images are alpha-composited per output
 * canvas tile in WebMercator coordinates; scene boundaries are feathered.
 * A visual composite cannot be interpreted as a one-date index value.
 */
export function QatarSpectralLayers({map}:{map:MapController|null}){
 const [index,setIndex]=useState<SpectralIndex|null>(null)
 const [contrast,setContrast]=useState<NdsiContrast>(DEFAULT_NDSI_CONTRAST)
 const [mobileControlsOpen,setMobileControlsOpen]=useState(false)
 const [opacity,setOpacity]=useState(.7)
 const [payload,setPayload]=useState<TilePayload|null>(null)
 const [busy,setBusy]=useState(false)
 const [rendered,setRendered]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [retry,setRetry]=useState(0)
 const overlay=useRef<GridLayer|null>(null)
 const detailOverlay=useRef<GridLayer|null>(null)
 useEffect(()=>{
  if(!index){
   setPayload(null);setBusy(false);setRendered(false);setError(null)
   return
  }
  const controller=new AbortController()
  setPayload(null);setError(null);setBusy(true);setRendered(false)
  void fetch('/api/satellite/qatar-spectral?index='+index+
   (index==='ndsi'?'&contrast='+contrast:''),{
   signal:controller.signal,cache:'no-store',
  }).then(async response=>{
   const body=await response.json() as Partial<TilePayload>&{error?:string;detail?:string}
   if(!response.ok)throw Error([body.error??'Planetary Computer unavailable',
    body.detail].filter(Boolean).join(' · '))
   if(!body.url||body.index!==index||
    (body.mode!=='mosaic'&&body.mode!=='stac-composite')||
    !body.startDate||!body.endDate)
    throw Error('Satellite imagery metadata is incomplete')
   if(!controller.signal.aborted)setPayload({
    ...body,
    tiles:Array.isArray(body.tiles)?body.tiles:[],
   } as TilePayload)
  }).catch(reason=>{
   if(!controller.signal.aborted){
    setError(reason instanceof Error?reason.message:'Spectral imagery unavailable')
    setBusy(false)
   }
  })
  return ()=>controller.abort()
 },[index,contrast,retry])

 useEffect(()=>{
  detailOverlay.current?.remove()
  overlay.current?.remove()
  detailOverlay.current=null
  overlay.current=null
  if(!map||!index||!payload||payload.index!==index)return
  let disposed=false
  let layer:GridLayer|null=null
  let detailLayer:GridLayer|null=null
  const controller=new AbortController()
  let loaded=0,failures=0,sceneFailures=0
  void import('leaflet').then(module=>{
   if(disposed)return
   const L=module.default
   // A single pane applies the user opacity once to the combined overview
   // and detail images. This avoids double-blending two spectral layers.
   const pane=map.getPane(SPECTRAL_PANE)??map.createPane(SPECTRAL_PANE)
   pane.style.zIndex='350'
   pane.style.pointerEvents='none'
   pane.style.opacity=String(opacity)
   const bounds=L.latLngBounds(
    [QATAR_SPECTRAL_BBOX[1],QATAR_SPECTRAL_BBOX[0]],
    [QATAR_SPECTRAL_BBOX[3],QATAR_SPECTRAL_BBOX[2]],
   )
   const imagery=validTiles(payload)
   // Native source images serve the stable overview and detail grids.
   const Raster=L.GridLayer.extend({
    createTile(coords:L.Coords,done:(error:Error|null,tile:HTMLElement)=>void){
     const canvas=document.createElement('canvas')
     canvas.width=TILE_SIZE
     canvas.height=TILE_SIZE
     const context=canvas.getContext('2d')
     if(!context){
      done(new Error('Canvas rendering is unavailable'),canvas)
      return canvas
     }
     const project=(lon:number,lat:number)=>{
      const world=map.project(L.latLng(lat,lon),coords.z)
      return {x:world.x-coords.x*TILE_SIZE,y:world.y-coords.y*TILE_SIZE}
     }
     const available=imagery.map(scene=>({
      scene,box:tileScenePixelBox(scene.bbox,project),
     })).filter(item=>intersectsPixelTile(item.box,TILE_SIZE))
     if(!available.length){
      done(null,canvas)
      return canvas
     }
     const render=async()=>{
      // Each tile is a single compositing operation. No independent
      // Leaflet layers means no repeated rectangles or cross-shaped seams.
      const loadedScenes=await Promise.allSettled(available.map(async item=>({
       pixels:await loadRasterPixelData(tileUrl(item.scene.url,coords),controller.signal),
       box:item.box,
       cloudCover:item.scene.cloudCover,
      })))
      if(disposed||controller.signal.aborted)return
      const successful=loadedScenes.filter(
       (x):x is PromiseFulfilledResult<{
        pixels:Uint8ClampedArray;box:typeof available[number]['box']
        cloudCover:number|undefined
       }>=>x.status==='fulfilled',
      ).map(x=>x.value)
      if(loadedScenes.some(result=>result.status==='rejected'))sceneFailures++
      if(successful.length===0){
       done(new Error('No Sentinel-2 scene tiles were returned'),canvas)
       return
      }
      try{
       const pixels=payload.mode==='mosaic'?
        successful[0].pixels:
        blendSpectralPixels(successful.map(x=>({
         rgba:x.pixels,box:x.box,cloudCover:x.cloudCover,
        })),TILE_SIZE,52)
       const source=context.createImageData(TILE_SIZE,TILE_SIZE)
       source.data.set(pixels)
       const sourceCanvas=document.createElement('canvas')
       sourceCanvas.width=TILE_SIZE;sourceCanvas.height=TILE_SIZE
       const inner=sourceCanvas.getContext('2d')
       if(!inner)throw Error('Unable to prepare spectral image')
       inner.putImageData(source,0,0)
       context.clearRect(0,0,TILE_SIZE,TILE_SIZE)
       context.save()
       try{
        clipTileToQatar(context,project)
        context.drawImage(sourceCanvas,0,0,TILE_SIZE,TILE_SIZE)
       }finally{context.restore()}
       done(null,canvas)
      }catch(error){
       done(error instanceof Error?error:new Error('Raster compositing failed'),canvas)
      }
     }
     void render().catch(reason=>{
      if(!disposed)done(reason instanceof Error?reason:new Error('Raster failed'),canvas)
     })
     return canvas
    },
   }) as unknown as new(options?:GridLayerOptions)=>GridLayer
   // The overview is always resident and uses the SAME source pixels at
   // every map zoom. At close zooms a fixed native-detail grid renders above
   // it; when high-resolution images are pending, the overview stays visible.
   // No 18-scene source burst every time the user moves the zoom wheel.
   const common={
    bounds,pane:SPECTRAL_PANE,opacity:1,tileSize:TILE_SIZE,
    maxZoom:19,noWrap:true,updateWhenIdle:true,updateWhenZooming:false,
    attribution:'ESA Sentinel-2 L2A · Microsoft Planetary Computer · Natural Earth',
   }
   layer=new Raster({
    ...common,
    minNativeZoom:SPECTRAL_OVERVIEW_ZOOM,
    maxNativeZoom:SPECTRAL_OVERVIEW_ZOOM,
    keepBuffer:8,
   })
   layer.addTo(map)
   layer.setZIndex(300)
   overlay.current=layer
   detailLayer=new Raster({
    ...common,
    minZoom:SPECTRAL_DETAIL_START_ZOOM,
    minNativeZoom:SPECTRAL_DETAIL_ZOOM,
    maxNativeZoom:SPECTRAL_DETAIL_ZOOM,
    keepBuffer:3,
   })
   detailLayer.addTo(map)
   detailLayer.setZIndex(301)
   detailOverlay.current=detailLayer
   for(const raster of [layer,detailLayer]){
    raster.on('tileload',()=>{
     if(!disposed){loaded++;setRendered(true);setBusy(false)}
    })
    raster.on('load',()=>{
     if(disposed)return
     setBusy(false)
     if(failures||sceneFailures)
      setError('Partial imagery: '+failures+' missing tile(s), '+
       sceneFailures+' tile(s) with failed scene requests. Retry imagery to reload.')
     else setError(null)
    })
    raster.on('tileerror',()=>{
     failures++
     if(!disposed){
      setError('Some satellite tiles failed to load. Retry imagery to refresh the coverage.')
      if(loaded===0&&failures>=8)setBusy(false)
     }
    })
   }
  }).catch(()=>{
   if(!disposed){setBusy(false);setError('Satellite compositor could not initialize')}
  })
  return ()=>{
   disposed=true
   controller.abort()
   detailLayer?.remove()
   layer?.remove()
   if(detailOverlay.current===detailLayer)detailOverlay.current=null
   if(overlay.current===layer)overlay.current=null
  }
  // Opacity is independent of tile fetching and raster composition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[map,index,payload])

 useEffect(()=>{
  const pane=map?.getPane(SPECTRAL_PANE)
  if(pane)pane.style.opacity=String(opacity)
 },[map,opacity,payload])

 const toggle=(choice:SpectralIndex|null)=>{
  setIndex(choice===index?null:choice)
  // NDSI is -NDVI, not a calibrated salinity diagnosis. The default
  // display should not make the country's bare sand look severely saline.
  setOpacity(choice==='ndsi'?.65:.7)
  setError(null)
 }
 const colors=index==='ndvi'?NDVI_COLORS:index==='ndmi'?NDMI_COLORS:NDSI_COLORS
 const ndsiStretch=NDSI_CONTRAST_RANGES[contrast]
 const ndsiRange=Array.from({length:5},(_,i)=>
  (ndsiStretch.min+(ndsiStretch.max-ndsiStretch.min)*i/4).toFixed(2))
 const spectralRange=index==='ndvi'?['−0.20','0.08','0.35','0.63','0.90']:index==='ndmi'?['≤−0.35','−0.18','0','0.18','≥0.35']:ndsiRange
 return <div data-live-map-spectral data-mobile-open={mobileControlsOpen} className="absolute start-1/2 top-4 z-[1150] w-[min(33rem,calc(100%-7rem))] -translate-x-1/2 rounded-xl border border-line bg-card/95 p-3 shadow-panel backdrop-blur-md"
  role="group" aria-label="Qatar-wide satellite spectral indices">
  <button type="button" data-spectral-mobile-toggle
   className="hidden w-full min-h-11 items-center justify-between gap-2 text-start"
   aria-expanded={mobileControlsOpen} aria-controls="national-map-spectral-controls"
   onClick={()=>setMobileControlsOpen(v=>!v)}>
   <span className="flex items-center gap-2 text-xs font-semibold text-content">
    <Layers3 size={17} className="text-sage-700"/>
    <span className="truncate">Spectral layers</span>
    {index&&<span className="rounded bg-cream-100 px-1.5 py-0.5 text-[10px] text-sage-700">{index.toUpperCase()}</span>}
   </span>
   <span className="shrink-0 text-[11px] font-semibold text-sage-700">{mobileControlsOpen?'Close':'Open'}</span>
  </button>
  <div id="national-map-spectral-controls" data-spectral-body data-expanded={mobileControlsOpen}>
  <div className="flex items-center justify-between gap-2">
   <span className="flex items-center gap-2 text-[11px] font-semibold text-content">
    <Layers3 size={15} className="text-sage-700"/>
    Qatar · Spectral layers
   </span>
   <span className="text-[9px] font-semibold text-content-soft">
    SENTINEL-2 · MICROSOFT PLANETARY COMPUTER
   </span>
  </div>
  <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Satellite index selection">
   {([null,'ndvi','ndmi','ndsi'] as const).map(choice=><button
    key={choice??'off'} type="button" onClick={()=>toggle(choice)}
    aria-pressed={index===choice}
    className={'min-h-10 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors '+
     (index===choice?'border-ink bg-ink text-white':
      'border-line bg-background text-content hover:bg-cream-100')}>
    {choice===null?'OFF':choice.toUpperCase()}
   </button>)}
  </div>
  {index&&<>
   {index==='ndsi'&&<div className="mt-2">
    <span className="text-[10px] font-semibold text-content-soft">NDSI contrast · same scale throughout Qatar</span>
    <div className="mt-1 grid grid-cols-3 gap-1" role="group" aria-label="NDSI contrast">
     {(['overview','detail','strong'] as const).map(choice=><button
      key={choice} type="button" onClick={()=>setContrast(choice)}
      aria-pressed={contrast===choice}
      className={'rounded-md border px-2 py-1.5 text-[10px] font-semibold '+
       (contrast===choice?'border-ink bg-ink text-white':'border-line bg-background text-content hover:bg-cream-100')}>
      {NDSI_CONTRAST_RANGES[choice].label}
     </button>)}
    </div>
    <p className="mt-1 text-[9px] leading-4 text-content-soft">
     Fixed display stretches only. Detail and high contrast may clip extremes; neither indicates salt concentration.
    </p>
   </div>}
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
   <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[9px] font-semibold tabular-nums text-content-soft">
    {spectralRange.map((value,i)=><span key={i}>{value}</span>)}
   </div>
   <p className="mt-1 text-[9px] leading-4 text-content-soft">
    {index==='ndvi'?'NDVI · Sentinel-2 observations with original color scale −0.20…0.90.':
      index==='ndmi'?'Enhanced NDMI contrast · clipped color scale −0.35…0.35, with original Sentinel-2 index values. NDMI is not soil moisture.':
      'NDSI spectral contrast = (B04−B08)/(B04+B08) = −NDVI. Bare sand can have positive values without being saline. Purple indicates index contrast, NEVER confirmed salinity or soil EC. Use Overview for the full range or Detail / High contrast for clearer relative differences. These fixed scales cannot identify salinity without soil EC.'}
   </p>
   <p role="status" className="mt-2 text-[10px] leading-4 text-content-soft">
    {error?'Satellite service: '+error:
     busy?'Retrieving and composing Sentinel-2 imagery…':
     payload&&rendered?
      (payload.mode==='stac-composite'?
       'Composited from '+payload.tiles.length+' observed scene(s) · '+payload.startDate+' to '+payload.endDate:
       'National mosaic · '+payload.startDate+' to '+payload.endDate):
     'Initializing satellite imagery…'}
   </p>
   <p className="mt-1 text-[9px] leading-4 text-content-soft">
    {payload?.mode==='stac-composite'?
     'Single geographically masked visual composite. Scene colors are feathered; dates may vary, and this is not a quantitative index measurement.':
     'Single Qatar-clipped mosaic. Dates, clouds and no-data coverage may vary.'}
    {' '}{index==='ndsi'?'Sand and bare soil are not classified as saline. Soil EC sampling is required for salinity mapping.':'NDMI is not measured soil moisture.'}
   </p>
   {error&&<button type="button" onClick={()=>setRetry(x=>x+1)}
    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sage-700 underline">
    <RefreshCw size={12}/> Retry imagery
   </button>}
  </>}
  </div>
 </div>
}
