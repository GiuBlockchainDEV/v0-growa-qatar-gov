'use client'
import {useEffect,useRef,useState} from 'react'
import type {TrackingAsset} from '@/lib/watchtower/global-tracking'
import type {FirmsDetection} from '@/lib/watchtower/firms-hotspots'

/** Optional 3D situation viewer. Original Growa integration, not an onboard camera.
 * Cesium ion is a browser token: restrict it to this deployment and your assets.
 * All tracking symbols represent reported fixes, not continuous motion.
 */
declare global {
 interface Window { Cesium?: any }
}
const RELEASE='https://cesium.com/downloads/cesiumjs/releases/1.134/Build/Cesium/'
let loading:Promise<any>|null=null
function loadCesium():Promise<any>{
 if(typeof window==='undefined')return Promise.reject(Error('Browser required'))
 if(window.Cesium)return Promise.resolve(window.Cesium)
 if(loading)return loading
 loading=new Promise((resolve,reject)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href=RELEASE+'Widgets/widgets.css'
  document.head.appendChild(css)
  const script=document.createElement('script');script.src=RELEASE+'Cesium.js';script.async=true
  script.onload=()=>window.Cesium?resolve(window.Cesium):reject(Error('Cesium failed to load'))
  script.onerror=()=>reject(Error('Cesium CDN unavailable'))
  document.head.appendChild(script)
 }).catch(error=>{loading=null;throw error})
 return loading
}
export function WatchtowerGlobe3D({assets,fires,showFires,focus,onSelect}:{
 assets:TrackingAsset[];fires:readonly FirmsDetection[];showFires:boolean
 focus:{lat:number;lon:number;zoom:number;token:number}|null
 onSelect:(id:string)=>void
}){
 const host=useRef<HTMLDivElement>(null)
 const viewer=useRef<any>(null)
 const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading')
 const [error,setError]=useState('')
 const onSelectRef=useRef(onSelect)
 useEffect(()=>{onSelectRef.current=onSelect},[onSelect])
 useEffect(()=>{
  let cancelled=false
  void loadCesium().then(async C=>{
   if(cancelled||!host.current)return
   const token=process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN?.trim()
   if(token)C.Ion.defaultAccessToken=token
   const v=new C.Viewer(host.current,{
    animation:false,timeline:false,baseLayerPicker:false,homeButton:false,
    fullscreenButton:false,geocoder:false,navigationHelpButton:false,
    infoBox:false,selectionIndicator:false,sceneModePicker:false,
    requestRenderMode:true,maximumRenderTimeChange:2,
    baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),
   })
   viewer.current=v
   v.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel:17,credit:'Esri World Imagery',
   }))
   v.camera.setView({destination:C.Cartesian3.fromDegrees(51.5,24,12500000)})
   const click=new C.ScreenSpaceEventHandler(v.scene.canvas)
   click.setInputAction((movement:any)=>{
    const picked=v.scene.pick(movement.position)
    const id=picked?.id?.id
    if(typeof id==='string'&&id.startsWith('asset:'))onSelectRef.current(id.slice(6))
   },C.ScreenSpaceEventType.LEFT_CLICK)
   ;(v as any).__growaClick=click
   if(cancelled){click.destroy();v.destroy();viewer.current=null;return}
   setStatus('ready')
   // Render an ellipsoid on keyless setups. Ion terrain is optional
   // and is added without blocking the first visual frame.
   if(token&&typeof C.createWorldTerrainAsync==='function'){
    void C.createWorldTerrainAsync().then((provider:any)=>{
      if(!cancelled&&!v.isDestroyed())v.terrainProvider=provider
    }).catch(()=>{/* ellipsoid remains usable */})
   }
  }).catch(err=>{if(!cancelled){setStatus('unavailable');setError(err instanceof Error?err.message:'3D unavailable')}})
  return()=>{cancelled=true;const v=viewer.current;if(v){v.__growaClick?.destroy();v.destroy();viewer.current=null}}
 },[])
 useEffect(()=>{
  const v=viewer.current,C=window.Cesium
  if(!v||!C||status!=='ready')return
  v.entities.removeAll()
  const visible=assets.slice(0,1800)
  for(const a of visible){
   const color=a.kind==='aircraft'?C.Color.fromCssColorString('#EEF4C9'):C.Color.fromCssColorString('#A2B78C')
   v.entities.add({
    id:'asset:'+a.id,name:a.label,
    position:C.Cartesian3.fromDegrees(a.lon,a.lat,a.kind==='aircraft'?Math.max(0,(a.altitudeFt??0)*.3048):0),
    point:{pixelSize:a.kind==='aircraft'?7:6,color,outlineColor:C.Color.BLACK,outlineWidth:1,
      heightReference:a.kind==='aircraft'?C.HeightReference.NONE:C.HeightReference.CLAMP_TO_GROUND},
    description:'Observed '+a.observedAt+' / '+a.source+' / not a live video feed',
   })
  }
  if(showFires)for(const fire of fires.slice(0,500)){
   v.entities.add({id:'fire:'+fire.id,
    name:'NASA FIRMS satellite thermal detection',
    position:C.Cartesian3.fromDegrees(fire.lon,fire.lat),
    point:{pixelSize:5,color:C.Color.fromCssColorString('#C08C46'),
      outlineWidth:1,outlineColor:C.Color.BLACK,heightReference:C.HeightReference.CLAMP_TO_GROUND},
    description:'Satellite thermal detection '+fire.observedAt+' / '+fire.source+' / NOT a verified wildfire',
   })
  }
  v.scene.requestRender()
 },[assets,fires,showFires,status])
 useEffect(()=>{
  const v=viewer.current,C=window.Cesium
  if(!v||!C||!focus||status!=='ready')return
  void v.camera.flyTo({
   destination:C.Cartesian3.fromDegrees(focus.lon,focus.lat,
    Math.max(9000,Math.min(15000000,18000000/Math.pow(1.7,Math.max(0,focus.zoom-2))))),
   duration:.85,
  })
 },[focus,status])
 return <div className="absolute inset-0" aria-label="Cesium 3D geographic situation viewer">
  <div ref={host} className="absolute inset-0"/>
  {status!=='ready'&&<div className="absolute inset-0 flex items-center justify-center bg-[#e7ebe8] p-5 text-center text-xs text-[#203326]" role="status">
   {status==='loading'?'Loading 3D globe…':'3D globe unavailable: '+error+'. Switch to 2D to continue.'}
  </div>}
  <div className="pointer-events-none absolute bottom-12 left-3 rounded bg-white/90 px-2 py-1 text-[10px] text-[#203326]">
   3D visualization · observed coordinates only · no live satellite video
  </div>
 </div>
}
