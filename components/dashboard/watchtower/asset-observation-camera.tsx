'use client'
import {useEffect,useRef,useState} from 'react'
import type * as Leaflet from 'leaflet'
import {Camera,Compass,ExternalLink,Eye,MapPinned,RefreshCw,Satellite,Ship,Plane} from 'lucide-react'
import type {TrackingAsset} from '@/lib/watchtower/global-tracking'
import type {PublicCameraResult} from '@/lib/watchtower/public-cameras'
import {publicCameraUrl} from '@/lib/watchtower/public-cameras'

const ESRI_IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_FALLBACK='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
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
 const [mapAttempt,setMapAttempt]=useState(0)
 const [tileState,setTileState]=useState<'loading'|'satellite'|'reference'|'unavailable'>('loading')
 const [previewFailed,setPreviewFailed]=useState(false)
 useEffect(()=>{
  if(!open||!node.current)return
  let cancelled=false,ready=false
  let instance:Leaflet.Map|null=null
  let tiles:Leaflet.TileLayer|null=null
  let timer:ReturnType<typeof setTimeout>|null=null
  setTileState('loading')
  void import('leaflet').then(({default:L})=>{
   if(cancelled||!node.current)return
   const active=L.map(node.current,{zoomControl:false,attributionControl:true,
    scrollWheelZoom:false,doubleClickZoom:false,dragging:true,keyboard:false,
    preferCanvas:true}).setView([asset.lat,asset.lon],asset.kind==='aircraft'?8:10)
   instance=active;map.current=active
   const icon=L.divIcon({className:'',
    html:'<span style="display:block;width:16px;height:16px;border:3px solid #EEF4C9;background:#111E13;border-radius:50%;box-shadow:0 0 0 5px #111E1340"></span>',
    iconSize:[16,16],iconAnchor:[8,8]})
   marker.current=L.marker([asset.lat,asset.lon],{icon,keyboard:false}).addTo(active)
   L.control.zoom({position:'topright'}).addTo(active)
   const load=(url:string,mode:'satellite'|'reference')=>{
    if(cancelled)return
    if(tiles){tiles.off();active.removeLayer(tiles)}
    let errors=0
    const layer=L.tileLayer(url,{attribution:imageryAttribution,
     maxZoom:19,maxNativeZoom:mode==='satellite'?18:16,keepBuffer:1})
    tiles=layer
    layer.on('tileload',()=>{
     if(!cancelled){ready=true;setTileState(mode)}
    })
    layer.on('tileerror',()=>{
     if(cancelled||++errors<2)return
     if(mode==='satellite')load(ESRI_FALLBACK,'reference')
     else setTileState('unavailable')
    })
    layer.addTo(active)
   }
   load(ESRI_IMAGERY,'satellite')
   active.invalidateSize()
   timer=setTimeout(()=>{if(!cancelled&&!ready)setTileState('unavailable')},8500)
  }).catch(()=>{if(!cancelled)setTileState('unavailable')})
  return()=>{cancelled=true;if(timer)clearTimeout(timer);
   tiles?.off();instance?.remove();map.current=null;marker.current=null}
 // Recreate only when opening, changing vessel or retrying tiles.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,asset.id,mapAttempt])
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
   <div className="relative h-[226px] overflow-hidden rounded-lg border border-line bg-[#e6ebe5]">
    <div ref={node} className={'absolute inset-0 h-full w-full '+(
     tileState==='satellite'||tileState==='reference'?'opacity-100':'opacity-0')}
     aria-label="Tracking map centered on last observed geographic fix"/>
    {(tileState==='loading'||tileState==='unavailable')&&<div
     className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#f6f7f2,#e0e8df)] p-3 text-ink" role="status">
     <svg viewBox="0 0 280 160" className="h-[145px] w-full" aria-label="Observed position compass with no imagery">
      <g fill="none" stroke="currentColor" strokeOpacity=".18">
       <circle cx="140" cy="75" r="28"/><circle cx="140" cy="75" r="55"/><circle cx="140" cy="75" r="72"/>
       <path d="M10 75H270M140 3V148" strokeDasharray="4 4"/>
      </g>
      <g transform={'translate(140 75) rotate('+String(asset.heading??0)+')'}>
       <path d={asset.kind==='aircraft'?'M0 -20L5 -3L17 4V8L5 5L4 17L0 14L-4 17L-5 5L-17 8V4L-5 -3Z':'M0 -18L13 -3L10 15H-10L-13 -3Z'} fill="#111E13"/>
      </g>
      <text x="140" y="157" fontSize="10" textAnchor="middle" fill="currentColor">{asset.lat.toFixed(4)}°, {asset.lon.toFixed(4)}°</text>
     </svg>
     <p className="text-[10px] font-semibold">{tileState==='loading'?'Loading satellite imagery…':'Imagery unavailable · geographic tracker active'}</p>
     {tileState==='unavailable'&&<button type="button"
      onClick={()=>setMapAttempt(n=>n+1)} className="mt-2 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-semibold">Retry map tiles</button>}
    </div>}
    <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-[9px] font-bold text-ink">
     SATELLITE BASEMAP · NOT LIVE FOOTAGE {tileState==='reference'?'· Reference fallback':''}
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
       onClick={()=>{setSelectedCamera(camera.id);setPreviewFailed(false)}}
       className={'flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-[10px] '+(
        selectedCamera===camera.id?'border-line-strong bg-cream-50':'border-line bg-card hover:bg-muted')}>
       <span className="min-w-0 flex-1 truncate font-semibold">{camera.title}</span>
       <span className="shrink-0 text-content-soft">{camera.distanceKm} km</span>
       <span className="shrink-0 text-sage-700">{camera.liveCapable?'Live-capable':'Timelapse'}</span>
      </button>)}
     </div>:<p className="mt-2 text-[10px] text-content-soft">{cameraStatus?.detail??'Camera source unavailable'}</p>}
    <p className="mt-2 text-[9px] text-content-soft">
     Webcams provided by <a href="https://www.windy.com/" target="_blank" rel="noopener noreferrer" className="underline">windy.com</a>.
     {' '}<a href="https://www.windy.com/webcams/add" target="_blank" rel="noopener noreferrer" className="underline">Add a webcam</a>
    </p>
    {chosen&&<div className="mt-3 space-y-2">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-[11px]">{chosen.title}</strong>
      <a href={chosen.detailUrl} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-[10px] text-sage-700 underline">
       Source page <ExternalLink size={12}/></a>
     </div>
     <div className="flex min-h-[130px] items-center justify-center overflow-hidden rounded-lg border border-line bg-muted">
      {chosen.imageUrl&&!previewFailed?<img src={chosen.imageUrl} loading="lazy"
       alt={'Current Windy preview for '+chosen.title} onError={()=>setPreviewFailed(true)}
       className="max-h-[200px] w-full object-contain"/>:
       <p className="p-4 text-center text-xs text-content-soft">No current webcam preview is available. Open the original camera player to check the feed.</p>}
     </div>
     <div className="flex flex-wrap gap-2">
      <a href={embed??chosen.detailUrl} target="_blank" rel="noopener noreferrer"
       className="g-btn g-btn--primary inline-flex items-center gap-1.5 text-[10px]">
       <ExternalLink size={13}/> Open provider player</a>
      <a href={chosen.detailUrl} target="_blank" rel="noopener noreferrer"
       className="g-btn g-btn--outline text-[10px]">Camera source</a>
     </div>
     <p className="text-[10px] leading-4 text-content-soft">
      Browser restrictions can leave embedded third-party players black. Playback opens directly on the provider rather than displaying an empty video panel.
     </p>
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
