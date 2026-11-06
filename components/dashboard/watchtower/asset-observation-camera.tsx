'use client'
import {useEffect,useRef,useState} from 'react'
import type * as Leaflet from 'leaflet'
import {Camera,Compass,ExternalLink,Eye,MapPinned,RefreshCw,Satellite,Ship,Plane} from 'lucide-react'
import type {TrackingAsset} from '@/lib/watchtower/global-tracking'
import type {PublicCameraResult} from '@/lib/watchtower/public-cameras'
import {publicCameraUrl} from '@/lib/watchtower/public-cameras'

const ESRI_IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const imageryAttribution='Tiles &copy; Esri and imagery providers'
const readable=(stamp:string)=>Number.isFinite(Date.parse(stamp))?
 new Date(stamp).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC':'Timestamp not verified'

/**
 * A camera-style satellite MAP following the latest observed ADS-B/AIS fix.
 * It is NOT live camera footage from a vehicle or real-time satellite video.
 */
export function AssetObservationCamera({asset}:{asset:TrackingAsset}){
 const node=useRef<HTMLDivElement>(null)
 const map=useRef<Leaflet.Map|null>(null)
 const marker=useRef<Leaflet.Marker|null>(null)
 const [follow,setFollow]=useState(true)
 const [open,setOpen]=useState(false)
 const [cameraStatus,setCameraStatus]=useState<PublicCameraResult|null>(null)
 const [loading,setLoading]=useState(false)
 const [selectedCamera,setSelectedCamera]=useState<string|null>(null)
 const [refresh,setRefresh]=useState(0)
 useEffect(()=>{
  if(!open||!node.current)return
  let cancelled=false
  let instance:Leaflet.Map|null=null
  let timer:ReturnType<typeof setTimeout>|undefined
  void import('leaflet').then(({default:L})=>{
   if(cancelled||!node.current)return
   instance=L.map(node.current,{zoomControl:false,attributionControl:true,
    scrollWheelZoom:false,doubleClickZoom:false,dragging:true,keyboard:false,
    preferCanvas:true,
   }).setView([asset.lat,asset.lon],asset.kind==='aircraft'?9:12)
   L.tileLayer(ESRI_IMAGERY,{attribution:imageryAttribution,maxZoom:19,maxNativeZoom:18,
    updateWhenIdle:true,keepBuffer:1}).addTo(instance)
   const icon=L.divIcon({className:'',
    html:'<span style="display:block;width:16px;height:16px;border:3px solid #EEF4C9;background:#111E13;border-radius:50%;box-shadow:0 0 0 5px #111E1340"></span>',
    iconSize:[16,16],iconAnchor:[8,8]})
   marker.current=L.marker([asset.lat,asset.lon],{icon,keyboard:false}).addTo(instance)
   L.control.zoom({position:'topright'}).addTo(instance)
   map.current=instance
   timer=setTimeout(()=>instance?.invalidateSize(),30)
  }).catch(()=>{/* Basemap unavailable: retain contact and camera evidence. */})
  return()=>{
   cancelled=true
   if(timer)clearTimeout(timer)
   instance?.remove()
   map.current=null;marker.current=null
  }
 // Reinitialize only when panel opens or selected asset changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,asset.id])
 useEffect(()=>{
  if(!map.current||!marker.current)return
  marker.current.setLatLng([asset.lat,asset.lon])
  if(follow)map.current.panTo([asset.lat,asset.lon],{animate:false})
 },[asset.lat,asset.lon,follow,open])
 useEffect(()=>{
  if(!open)return
  let active=true
  const ctrl=new AbortController()
  setCameraStatus(null);setLoading(true);setSelectedCamera(null)
  fetch('/api/watchtower/public-cameras?'+new URLSearchParams({
   lat:String(asset.lat),lon:String(asset.lon),
  }),{cache:'no-store',signal:ctrl.signal})
   .then(async response=>{
    if(!response.ok)throw Error('Public-camera lookup HTTP '+response.status)
    return response.json() as Promise<PublicCameraResult>
   })
   .then(data=>{if(active)setCameraStatus(data)})
   .catch(()=>{if(active&&!ctrl.signal.aborted)setCameraStatus({
    source:'Windy Webcams',state:'unavailable',
    checkedAt:new Date().toISOString(),cameras:[],
    detail:'Camera discovery unavailable. Satellite map remains operational.',
   })})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false;ctrl.abort()}
 // Query once for selection and on explicit refresh, not at every AIS position.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,asset.id,refresh])
 const chosen=cameraStatus?.cameras.find(c=>c.id===selectedCamera)??null
 const embed=chosen?publicCameraUrl(chosen.playerUrl):null
 return <section className="mt-3 overflow-hidden rounded-xl border border-line bg-card" aria-label="Selected vehicle camera and tracking">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}
   className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-cream-50">
   <span className="flex items-center gap-2 text-xs font-semibold text-content">
    <Camera size={16}/> Visual tracking & public cameras</span>
   <span className="text-[10px] font-semibold text-sage-700">{open?'Hide':'Open'}</span>
  </button>
  {open&&<div className="space-y-3 border-t border-line p-3">
   <div className="relative overflow-hidden rounded-lg border border-line bg-ink">
    <div ref={node} className="h-[205px] w-full" aria-label="Satellite imagery map centered on the selected asset"/>
    <div className="pointer-events-none absolute bottom-7 left-2 rounded bg-ink/85 px-2 py-1 text-[9px] font-bold text-cream">
     SATELLITE BASEMAP · NOT LIVE FOOTAGE
    </div>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-1.5 text-[10px] text-content-soft">
     {asset.kind==='aircraft'?<Plane size={14}/>:<Ship size={14}/>}
     Last observed {readable(asset.observedAt)}
    </div>
    <button type="button" aria-pressed={follow} onClick={()=>setFollow(v=>!v)}
     className="g-btn g-btn--outline inline-flex items-center gap-1.5 text-[10px]">
     <MapPinned size={13}/>{follow?'Following':'Follow position'}</button>
   </div>
   <div className="grid grid-cols-2 gap-2">
    <div className="rounded-lg bg-muted p-2 text-[10px] text-content-soft">
     <Compass size={13} className="mb-1"/>Heading
     <strong className="block text-xs text-content">{asset.heading===null?'Unknown':asset.heading.toFixed(0)+'°'}</strong>
    </div>
    <div className="rounded-lg bg-muted p-2 text-[10px] text-content-soft">
     <Eye size={13} className="mb-1"/>Observation
     <strong className="block text-xs text-content">{asset.lat.toFixed(4)}°, {asset.lon.toFixed(4)}°</strong>
    </div>
   </div>
   <div className="rounded-lg border border-line bg-background p-3">
    <div className="flex items-center justify-between gap-2">
     <p className="text-[11px] font-semibold">Nearby fixed public webcams</p>
     <button type="button" aria-label="Refresh public webcam search" onClick={()=>setRefresh(n=>n+1)}
      className="rounded-full border border-line p-1.5 hover:bg-muted" disabled={loading}>
      <RefreshCw size={13} className={loading?'animate-spin':''}/></button>
    </div>
    <p className="mt-1 text-[10px] leading-4 text-content-soft">
     Webcams are on the ground near the last reported coordinates, never onboard the selected vessel or aircraft.
    </p>
    {loading?<p className="mt-3 text-[10px] text-content-soft">Searching permitted public camera feeds…</p>:
     cameraStatus?.cameras.length?<div className="mt-3 space-y-2">
      {cameraStatus.cameras.map(camera=><button type="button" key={camera.id}
       onClick={()=>setSelectedCamera(camera.id)}
       className={'flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-[10px] '+(
        selectedCamera===camera.id?'border-line-strong bg-cream-50':'border-line bg-card hover:bg-muted')}>
       <span className="min-w-0 flex-1 truncate font-semibold">{camera.title}</span>
       <span className="shrink-0 text-content-soft">{camera.distanceKm} km</span>
       <span className="shrink-0 text-sage-700">{camera.liveCapable?'Live-capable':'Timelapse'}</span>
      </button>)}
     </div>:<p className="mt-2 text-[10px] text-content-soft">{cameraStatus?.detail??'Camera source unavailable'}</p>}
    {chosen&&<div className="mt-3 space-y-2">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-[11px]">{chosen.title}</strong>
      <a href={chosen.detailUrl} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-[10px] text-sage-700 underline">
       Source page <ExternalLink size={12}/></a>
     </div>
     {embed?<iframe src={embed} title={'Public webcam player: '+chosen.title}
      loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; fullscreen" className="h-48 w-full rounded-lg border border-line bg-ink"/>:
      <p className="text-xs text-content-soft">Provider player not available for embedding.</p>}
     <p className="text-[10px] text-content-soft">
      {chosen.liveCapable?'Provider advertises a live player; uptime is not independently verified.':
       'Provider offers recorded imagery or timelapse, not a verified live stream.'}
     </p>
    </div>}
   </div>
   <p className="flex items-start gap-2 text-[10px] leading-4 text-content-soft">
    <Satellite size={15} className="shrink-0"/>Tracking uses AIS/ADS-B observations, not live imagery. Maps and positions may be delayed.
   </p>
  </div>}
 </section>
}
