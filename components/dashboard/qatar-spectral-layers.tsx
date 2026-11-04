'use client'

import {useEffect,useRef,useState} from 'react'
import {Layers3,RefreshCw} from 'lucide-react'
import type {GridLayer,GridLayerOptions} from 'leaflet'
import type {MapController} from '@/components/dashboard/map/map-model'
import {QATAR_SPECTRAL_BBOX,SPECTRAL_INDEX_CONFIG,
 type SpectralIndex,type SpectralTile} from '@/lib/satellite/qatar-spectral'
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
const NDMI_COLORS=['#a50026','#f46d43','#f7f7f7','#abd9e9','#313695']
const TILE_SIZE=256

function tileUrl(template:string,coords:{x:number;y:number;z:number}){
 return template.replace(/(?:\{|%7B)(z|x|y)(?:\}|%7D)/gi,(_,axis:string)=>
  String(coords[axis as keyof typeof coords]))
}
function loadRasterPixelData(url:string,signal:AbortSignal):Promise<Uint8ClampedArray>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error('Raster request cancelled'));return}
  const image=new Image()
  image.crossOrigin='anonymous'
  const cancel=()=>{image.src='';reject(new Error('Raster request cancelled'))}
  signal.addEventListener('abort',cancel,{once:true})
  const dispose=()=>signal.removeEventListener('abort',cancel)
  image.onload=()=>{
   dispose()
   try{
    const sourceCanvas=document.createElement('canvas')
    sourceCanvas.width=TILE_SIZE
    sourceCanvas.height=TILE_SIZE
    const sourceContext=sourceCanvas.getContext('2d',{willReadFrequently:true})
    if(!sourceContext)throw new Error('Pixel compositing is unsupported')
    sourceContext.drawImage(image,0,0,TILE_SIZE,TILE_SIZE)
    resolve(sourceContext.getImageData(0,0,TILE_SIZE,TILE_SIZE).data)
   }catch(error){reject(error)}
  }
  image.onerror=()=>{dispose();reject(new Error('Satellite image tile unavailable'))}
  image.src=url
 })
}
function validTiles(payload:TilePayload):Array<SpectralTile&{cloudCover?:number}>{
 return payload.mode==='stac-composite'&&payload.tiles.length?
  payload.tiles:[{url:payload.url,bbox:[...QATAR_SPECTRAL_BBOX],sceneDate:payload.endDate}]
}

/** One masked GridLayer for the Qatar NDVI / NDMI presentation.
 * PgSTAC renders a single mosaic directly. When PgSTAC fails,
 * actual Sentinel-2 scene images are alpha-composited per output
 * canvas tile in WebMercator coordinates; scene boundaries are feathered.
 * A visual composite cannot be interpreted as a one-date index value.
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
 },[index,retry])

 useEffect(()=>{
  overlay.current?.remove()
  overlay.current=null
  if(!map||!index||!payload||payload.index!==index)return
  let disposed=false
  let layer:GridLayer|null=null
  const controller=new AbortController()
  let loaded=0,failures=0
  void import('leaflet').then(module=>{
   if(disposed)return
   const L=module.default
   const bounds=L.latLngBounds(
    [QATAR_SPECTRAL_BBOX[1],QATAR_SPECTRAL_BBOX[0]],
    [QATAR_SPECTRAL_BBOX[3],QATAR_SPECTRAL_BBOX[2]],
   )
   const imagery=validTiles(payload)
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
        cloudCover?:number
       }>=>x.status==='fulfilled',
      ).map(x=>x.value)
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
       // putImageData deliberately ignores canvas clipping in the Canvas2D
       // standard. Draw the image from an offscreen canvas AFTER clipping,
       // otherwise even a valid mosaic leaks outside Qatar's boundary.
       const sourceCanvas=document.createElement('canvas')
       sourceCanvas.width=TILE_SIZE;sourceCanvas.height=TILE_SIZE
       const inner=sourceCanvas.getContext('2d')
       if(!inner)throw Error('Unable to prepare spectral image')
       inner.putImageData(source,0,0)
       context.save()
       try{
        clipTileToQatar(context,project)
        context.drawImage(sourceCanvas,0,0)
       }finally{
        context.restore()
       }
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
   layer=new Raster({
    bounds,opacity,tileSize:TILE_SIZE,maxZoom:19,maxNativeZoom:14,
    attribution:'ESA Sentinel-2 L2A · Microsoft Planetary Computer · Natural Earth',
    updateWhenIdle:true,keepBuffer:1,
   })
   layer.addTo(map)
   const container=layer.getContainer()
   if(container)container.style.opacity=String(opacity)
   layer.setZIndex(300)
   overlay.current=layer
   layer.on('tileload',()=>{
    if(!disposed){loaded++;setRendered(true);setBusy(false)}
   })
   layer.on('tileerror',()=>{
    failures++
    if(!disposed&&loaded===0&&failures>=8){
     setBusy(false)
     setError('Sentinel-2 imagery tiles are not accessible. Retry the satellite layer.')
    }
   })
  }).catch(()=>{
   if(!disposed){setBusy(false);setError('Satellite compositor could not initialize')}
  })
  return ()=>{
   disposed=true
   controller.abort()
   layer?.remove()
   if(overlay.current===layer)overlay.current=null
  }
  // Opacity is independent of tile fetching and raster composition.
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
    {' '}NDMI is not soil moisture.
   </p>
   {error&&<button type="button" onClick={()=>setRetry(x=>x+1)}
    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-sage-700 underline">
    <RefreshCw size={12}/> Retry imagery
   </button>}
  </>}
 </div>
}
