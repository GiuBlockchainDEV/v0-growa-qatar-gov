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

/** Original vector silhouettes with aircraft and vessel structure; no external
 * model license, hotlinked image or additional GPU mesh dependency.
 * Cesium billboards keep their heading and remain legible at wide map scales.
 */
const aircraftSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs>
 <linearGradient id="f" x1="0" x2="1" y1="0" y2="0"><stop stop-color="#8B9CA7"/><stop offset=".48" stop-color="#F1F4F5"/><stop offset="1" stop-color="#84939D"/></linearGradient>
 <linearGradient id="w" x1="0" x2="1"><stop stop-color="#6E808A"/><stop offset=".52" stop-color="#E1E8EC"/><stop offset="1" stop-color="#7A8C97"/></linearGradient>
 <filter id="s"><feDropShadow dx="1" dy="4" stdDeviation="2" flood-color="#0A1C25" flood-opacity=".65"/></filter>
</defs>
<g filter="url(#s)" stroke="#374E5D" stroke-width="1.2" stroke-linejoin="round">
 <path fill="url(#w)" d="M58 12L52 50 6 72 6 83 52 74 57 101 40 113 40 120 64 113 88 120 88 113 71 101 76 74 122 83 122 72 76 50 70 12Z"/>
 <path fill="url(#f)" d="M60 10Q64 -3 68 10L73 54 70 105 67 116 61 116 58 105 55 54Z"/>
 <path fill="#183747" d="M60 19 Q64 14 68 19L69 30 59 30Z"/>
 <path fill="#567182" d="M28 70L48 61 48 70 27 76ZM100 70L80 61 80 70 101 76Z"/>
 <path fill="#6A7C86" d="M40 82L49 80 51 92 43 94ZM88 82L79 80 77 92 85 94Z"/>
 <path fill="#CBD4D8" d="M56 60L48 65 48 85 57 83ZM72 60L80 65 80 85 71 83Z"/>
</g>
<path d="M64 36V101" stroke="#FFFFFF" stroke-opacity=".52" stroke-width="1.5"/>
<circle cx="64" cy="7" r="2" fill="#EFF7E0"/>
</svg>`
const vesselSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><linearGradient id="h" x1="0" x2="1"><stop stop-color="#263744"/><stop offset=".5" stop-color="#647884"/><stop offset="1" stop-color="#263744"/></linearGradient>
<filter id="s"><feDropShadow dx="2" dy="4" stdDeviation="2.5" flood-color="#09232D" flood-opacity=".65"/></filter></defs>
<g filter="url(#s)">
<path d="M64 4Q91 7 98 32L99 104Q94 122 64 125Q34 122 29 104L30 32Q37 7 64 4Z" fill="#263744" stroke="#0D2730" stroke-width="3"/>
<path d="M64 10Q83 13 91 33L91 103Q83 117 64 119Q45 117 37 103L37 33Q45 13 64 10Z" fill="url(#h)" stroke="#93A3A8" stroke-width="1"/>
<path d="M48 16L80 16 84 34 44 34Z" fill="#D7DFDD" stroke="#566D73" stroke-width="1.5"/>
<rect x="51" y="20" width="26" height="7" rx="2" fill="#274D63"/>
<path d="M44 40H84V100H44Z" fill="#89989B"/>
<g stroke="#31434A" stroke-width="1">
 <rect x="47" y="42" width="15" height="14" rx="1" fill="#B18B54"/><rect x="65" y="42" width="15" height="14" rx="1" fill="#B9C4B8"/>
 <rect x="47" y="58" width="15" height="14" rx="1" fill="#7C9992"/><rect x="65" y="58" width="15" height="14" rx="1" fill="#D0AA6B"/>
 <rect x="47" y="74" width="15" height="14" rx="1" fill="#D9D7CB"/><rect x="65" y="74" width="15" height="14" rx="1" fill="#879BA4"/>
 <rect x="47" y="90" width="15" height="9" rx="1" fill="#B0B8A4"/><rect x="65" y="90" width="15" height="9" rx="1" fill="#B58F69"/>
</g>
<path d="M39 36H89M39 106H89" stroke="#C9D4D3" stroke-width="2"/>
</g></svg>`
const silhouette=(svg:string)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)
const AIRCRAFT_ICON=silhouette(aircraftSvg)
const VESSEL_ICON=silhouette(vesselSvg)

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
export function WatchtowerGlobe3D({assets,fires,showFires,focus,onSelect,selectedId}:{
 assets:TrackingAsset[];fires:readonly FirmsDetection[];showFires:boolean
 selectedId?:string|null
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
  // Separate budgets prevent aircraft from exhausting the vessel display
  // allocation. Every marker is still an actual source-reported coordinate.
  const air=assets.filter(a=>a.kind==='aircraft').slice(0,2300)
  const sea=assets.filter(a=>a.kind==='vessel').slice(0,1400)
  for(const a of [...air,...sea]){
   const aircraft=a.kind==='aircraft'
   const selected=a.id===selectedId
   const altitude=aircraft?Math.max(0,(a.altitudeFt??0)*.3048):0
   const rotation=a.heading===null?0:-a.heading*Math.PI/180
   v.entities.add({
    id:'asset:'+a.id,name:a.label,
    position:C.Cartesian3.fromDegrees(a.lon,a.lat,altitude),
    billboard:{
      image:aircraft?AIRCRAFT_ICON:VESSEL_ICON,
      width:selected?76:aircraft?51:47,height:selected?76:aircraft?51:47,
      rotation,alignedAxis:C.Cartesian3.ZERO,
      verticalOrigin:C.VerticalOrigin.CENTER,
      heightReference:aircraft?C.HeightReference.NONE:C.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance:new C.NearFarScalar(15000,1,18000000,.46),
      disableDepthTestDistance:120000,
    },
    label:selected?{
      text:a.label+' · '+a.source,
      fillColor:C.Color.WHITE,font:'12px sans-serif',
      style:C.LabelStyle.FILL_AND_OUTLINE,outlineColor:C.Color.BLACK,outlineWidth:3,
      pixelOffset:new C.Cartesian2(0,-49),
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000000),
    }:undefined,
    description:'Observed '+a.observedAt+' / '+a.source+
      (a.observationBasis==='receipt_time'?' / AIS reception time, ship-fix time unknown':'')+
      ' / not a live video feed',
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
 },[assets,fires,showFires,status,selectedId])
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
