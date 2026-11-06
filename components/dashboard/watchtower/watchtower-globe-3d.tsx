'use client'
import {useEffect,useRef,useState} from 'react'
import type {TrackingAsset} from '@/lib/watchtower/global-tracking'
import type {FirmsDetection} from '@/lib/watchtower/firms-hotspots'
import type {ProductionRiskZone} from '@/lib/watchtower/production-risk'
import type {MapAlert,MapLayers} from '@/lib/watchtower/global-tracking'
import {TRACKED_CHOKEPOINTS,type ChokepointId,type ChokepointReport} from '@/lib/watchtower/data-tracking-net'
import {globeRiskParts,hasApproximateRiskRadius} from '@/lib/watchtower/globe-risk-geometry'
import {MAP_COLORS,SIGNAL_SEVERITY_COLORS} from '@/lib/watchtower/map-layer-colors'

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
export function WatchtowerGlobe3D({assets,fires,showFires,focus,onSelect,selectedId,riskZones,alerts,layers,chokepoints,onChokepointClick}:{
 assets:TrackingAsset[];fires:readonly FirmsDetection[];showFires:boolean
 selectedId?:string|null
 riskZones:readonly ProductionRiskZone[];alerts:readonly MapAlert[];layers:MapLayers
 chokepoints:readonly ChokepointReport[];onChokepointClick:(id:ChokepointId)=>void
 focus:{lat:number;lon:number;zoom:number;token:number}|null
 onSelect:(id:string)=>void
}){
 const host=useRef<HTMLDivElement>(null)
 const viewer=useRef<any>(null)
 const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading')
 const [error,setError]=useState('')
 const onSelectRef=useRef(onSelect)
 const onChokepointRef=useRef(onChokepointClick)
 const layerRef=useRef(layers)
 useEffect(()=>{onSelectRef.current=onSelect},[onSelect])
 useEffect(()=>{onChokepointRef.current=onChokepointClick},[onChokepointClick])
 useEffect(()=>{layerRef.current=layers},[layers])
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
    if(typeof id!=='string')return
    if(id.startsWith('asset:'))onSelectRef.current(id.slice(6))
    else if(id.startsWith('risk-zone:')&&layerRef.current.production){
      const raw=id.slice('risk-zone:'.length)
      const last=raw.lastIndexOf(':')
      if(last>0)onSelectRef.current(raw.slice(0,last))
    }
    else if(id.startsWith('risk-alert:')&&layerRef.current.risks)
      onSelectRef.current(id.slice('risk-alert:'.length))
    else if(id.startsWith('gateway:')&&layerRef.current.gateways){
      const gateway=id.slice('gateway:'.length) as ChokepointId
      if(TRACKED_CHOKEPOINTS.some(point=>point.id===gateway))
        onChokepointRef.current(gateway)
    }
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
   const color=C.Color.fromCssColorString(aircraft?'#C9A227':MAP_COLORS.sage300)
   v.entities.add({
    id:'asset:'+a.id,name:a.label,
    position:C.Cartesian3.fromDegrees(a.lon,a.lat,altitude),
    point:{
      pixelSize:selected?12:aircraft?8:7,
      color,outlineColor:C.Color.fromCssColorString(MAP_COLORS.ink),
      outlineWidth:selected?3:1.5,
      heightReference:aircraft?C.HeightReference.NONE:C.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance:new C.NearFarScalar(15000,1.2,18000000,.65),
      disableDepthTestDistance:120000,
    },
    label:selected?{
      text:a.label+' · '+a.source,
      fillColor:C.Color.WHITE,font:'12px sans-serif',
      style:C.LabelStyle.FILL_AND_OUTLINE,outlineColor:C.Color.BLACK,outlineWidth:3,
      pixelOffset:new C.Cartesian2(0,-22),
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000000),
    }:undefined,
    description:'Observed '+a.observedAt+' / '+a.source+
      (a.observationBasis==='receipt_time'?' / AIS reception time, ship-fix time unknown':'')+
      ' / not a live video feed',
   })
  }
  // Area overlays retain the exact 2D geometry/source semantics.
  // ADM1 outlines are screening regions, NOT observed GDACS impact footprints.
  // An event with no administrative polygon gets a clearly approximate radius.
  if(layers.production)for(const zone of riskZones.slice(0,50)){
    const selected=zone.id===selectedId
    const tint=zone.severity==='high'?'#B4644A':'#C9A227'
    const color=C.Color.fromCssColorString(tint)
    const fill=color.withAlpha(selected?.30:.14)
    const outline=color.withAlpha(selected?1:.83)
    const label=zone.name+' · '+zone.driver.toUpperCase()+
      ' · '+zone.severity.toUpperCase()
    const explanation=zone.scopeNote+' / '+zone.source+
      ' / '+(zone.observedAt??'observation date unavailable')
    const parts=globeRiskParts(zone)
    if(parts.length){
      for(const [partIndex,part] of parts.entries()){
        const makePositions=(ring:readonly [number,number][])=>ring.flatMap(([lon,lat])=>[lon,lat])
        const hierarchy=new C.PolygonHierarchy(
          C.Cartesian3.fromDegreesArray(makePositions(part.outer)),
          part.holes.map(ring=>new C.PolygonHierarchy(
            C.Cartesian3.fromDegreesArray(makePositions(ring)))),
        )
        v.entities.add({
          id:'risk-zone:'+zone.id+':'+partIndex,name:label,
          polygon:{
            hierarchy,material:fill,outline:true,outlineColor:outline,
            height:0,heightReference:C.HeightReference.CLAMP_TO_GROUND,
            classificationType:C.ClassificationType.TERRAIN,
          },
          description:explanation,
        })
      }
    }else if(hasApproximateRiskRadius(zone)){
      const lat=zone.center.lat,lon=zone.center.lon
      const radius=zone.radiusKm!*1000
      const circumference=2*Math.PI*6378137*Math.cos(lat*Math.PI/180)
      const deltaLon=radius/circumference*360
      const deltaLat=radius/111320
      if(Number.isFinite(deltaLon)&&Number.isFinite(deltaLat)){
        const ring:number[]=[]
        for(let i=0;i<64;i++){
          const theta=2*Math.PI*i/64
          const sampleLat=lat+Math.sin(theta)*deltaLat
          const sampleLon=lon+Math.cos(theta)*deltaLon
          if(Math.abs(sampleLat)>90||Math.abs(sampleLon)>180){ring.length=0;break}
          ring.push(sampleLon,sampleLat)
        }
        if(ring.length>=6)v.entities.add({
          id:'risk-zone:'+zone.id+':radius',name:label+' · approximate radius',
          polygon:{
            hierarchy:C.Cartesian3.fromDegreesArray(ring),material:fill,
            outline:true,outlineColor:outline,height:0,
            classificationType:C.ClassificationType.TERRAIN,
          },
          description:'Approximate '+zone.radiusKm+
            ' km event-centred screening radius, NOT an event footprint. '+explanation,
        })
      }
    }
  }
  // Event-level alert markers are distinct from administrative screening
  // regions. Organization-wide food alerts are never depicted as incidents.
  if(layers.risks)for(const alert of alerts.slice(0,250)){
    if(alert.source==='Organization food ledger')continue
    if(!Number.isFinite(alert.lat)||!Number.isFinite(alert.lon)||
       Math.abs(alert.lat)>85||Math.abs(alert.lon)>180)continue
    const selected=alert.id===selectedId
    const tint=alert.severity==='high'?SIGNAL_SEVERITY_COLORS.high:
      SIGNAL_SEVERITY_COLORS.attention
    const color=C.Color.fromCssColorString(tint)
    v.entities.add({
      id:'risk-alert:'+alert.id,name:alert.title,
      position:C.Cartesian3.fromDegrees(alert.lon,alert.lat),
      point:{
        pixelSize:selected?12:8,color:color.withAlpha(.9),
        outlineColor:C.Color.fromCssColorString(MAP_COLORS.cream),
        outlineWidth:selected?3:1.5,
        heightReference:C.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance:120000,
      },
      description:alert.source+' · '+alert.detail+' · '+alert.locationBasis,
    })
  }
  if(layers.gateways)for(const gateway of TRACKED_CHOKEPOINTS){
    const observed=chokepoints.find(entry=>entry.id===gateway.id)
    const covered=observed?.state==='partial'||observed?.state==='stale'
    const color=C.Color.fromCssColorString(
      covered?MAP_COLORS.sage:MAP_COLORS.stone500)
    v.entities.add({
      id:'gateway:'+gateway.id,name:gateway.label,
      position:C.Cartesian3.fromDegrees(gateway.lon,gateway.lat),
      point:{
        pixelSize:gateway.feed?7:5,color:color.withAlpha(.92),
        outlineColor:C.Color.fromCssColorString(MAP_COLORS.cream),
        outlineWidth:1.4,
        heightReference:C.HeightReference.CLAMP_TO_GROUND,
      },
      description:gateway.label+' / '+(observed?.state??'not covered')+
        ' / source coverage does not prove a safe or open shipping route.',
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
 },[assets,fires,showFires,status,selectedId,riskZones,alerts,layers,chokepoints])
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
