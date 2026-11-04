'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Droplets,MapPin,Plus,RefreshCw,Search,WifiOff,X} from 'lucide-react'
import type {CircleMarker,LayerGroup} from 'leaflet'
import type {MapController} from '@/components/dashboard/map/map-model'
import {isPointInQatar} from '@/lib/satellite/qatar-clip'
import {
 normalizeUserMappedWells,wellsSummary,
 type QatarWell,type QatarWellsPayload,
} from '@/lib/wells/qatar-wells'

/**
 * Public OSM geolocations and explicitly named user map points only.
 * No inferred aquifer level, flow, EC, or live well telemetry.
 */
export function QatarWellsLayers({map}:{map:MapController|null}){
 const [open,setOpen]=useState(false)
 const [showPublic,setShowPublic]=useState(true)
 const [showSaved,setShowSaved]=useState(true)
 const [publicData,setPublicData]=useState<QatarWellsPayload|null>(null)
 const [saved,setSaved]=useState<QatarWell[]>([])
 const [fetchError,setFetchError]=useState<string|null>(null)
 const [loading,setLoading]=useState(false)
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [filter,setFilter]=useState('')
 const [reload,setReload]=useState(0)
 const [adding,setAdding]=useState(false)
 const [wellName,setWellName]=useState('')
 const [latitude,setLatitude]=useState('')
 const [longitude,setLongitude]=useState('')
 const [saving,setSaving]=useState(false)
 const [saveError,setSaveError]=useState<string|null>(null)
 const groupRef=useRef<LayerGroup|null>(null)
 const marksRef=useRef<Map<string,CircleMarker>>(new Map())

 useEffect(()=>{
  if(!open)return
  let active=true
  const controller=new AbortController()
  setLoading(true);setFetchError(null)
  const read=async()=>{
   const [wells,local]=await Promise.allSettled([
    fetch('/api/wells/qatar',{signal:controller.signal,cache:'no-store'}),
    fetch('/api/operations/custom-map-points',{signal:controller.signal,cache:'no-store'}),
   ])
   if(!active)return
   if(wells.status==='fulfilled'){
    try{
     const body=await wells.value.json() as QatarWellsPayload
     if(active){
      setPublicData(body)
      if(!wells.value.ok)setFetchError(body.note||'Public well registry unavailable')
     }
    }catch{if(active)setFetchError('Unable to parse mapped wells')}
   }else if(active)setFetchError('Public well data could not be loaded')
   if(local.status==='fulfilled'&&local.value.ok){
    try{
     const body=await local.value.json() as unknown
     if(active)setSaved(normalizeUserMappedWells(body))
    }catch{if(active)setSaved([])}
   }else if(active)setSaved([])
   if(active)setLoading(false)
  }
  void read()
  return ()=>{active=false;controller.abort()}
 },[open,reload])
 const visible=useMemo(()=>{
  const publicWells=showPublic?(publicData?.wells??[]):[]
  const savedWells=showSaved?saved:[]
  return [...publicWells,...savedWells]
 },[publicData,saved,showPublic,showSaved])
 const stats=useMemo(()=>wellsSummary(visible),[visible])
 const publicUnavailable=publicData?.sourceStatus==='unavailable'||(!publicData&&!loading)
 const saveWell=async()=>{
  const lat=Number(latitude),lng=Number(longitude),label=wellName.trim()
  if(!label||!latitude.trim()||!longitude.trim()||
   !Number.isFinite(lat)||!Number.isFinite(lng)||!isPointInQatar(lng,lat)){
   setSaveError('Provide a name and valid GPS coordinates inside Qatar.')
   return
  }
  setSaving(true);setSaveError(null)
  try{
   const response=await fetch('/api/operations/custom-map-points',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:crypto.randomUUID(),label:'Well '+label,
     lat,lng,pointType:'custom'}),
   })
   if(!response.ok){
    const body=await response.json() as {error?:string}
    throw Error(body.error??'Unable to save well')
   }
   setAdding(false);setWellName('');setLatitude('');setLongitude('')
   setReload(v=>v+1)
  }catch(error){setSaveError(error instanceof Error?error.message:'Unable to save well')}
  finally{setSaving(false)}
 }
 const selected=visible.find(w=>w.id===selectedId)??null
 const matching=useMemo(()=>{
  const query=filter.trim().toLowerCase()
  const ordered=query?visible.filter(w=>w.name.toLowerCase().includes(query)||
   w.reference?.toLowerCase().includes(query)):visible
  return ordered.slice(0,40)
 },[visible,filter])

 useEffect(()=>{
  groupRef.current?.remove()
  groupRef.current=null
  marksRef.current.clear()
  if(!open||!map||!visible.length)return
  let stopped=false
  let layer:LayerGroup|null=null
  void import('leaflet').then(({default:L})=>{
   if(stopped)return
   layer=L.layerGroup().addTo(map)
   groupRef.current=layer
   for(const well of visible){
    const monitored=well.liveTelemetry
    const marker=L.circleMarker([well.lat,well.lng],{
     radius:well.origin==='growa-map-point'?8:well.origin==='un-gis'?6:5,
     color:monitored?'#4f834f':well.origin==='growa-map-point'?'#b08a39':'#edf6e2',
     fillColor:monitored?'#78a25a':well.origin==='growa-map-point'?'#dbb969':well.origin==='un-gis'?'#4c7068':'#608357',
     fillOpacity:.9,weight:2,
    }).addTo(layer)
    marker.on('click',()=>setSelectedId(well.id))
    marker.bindTooltip(well.name,{direction:'top'})
    marksRef.current.set(well.id,marker)
   }
  }).catch(()=>{if(!stopped)setFetchError('Cannot render well markers')})
  return ()=>{
   stopped=true
   layer?.remove()
   if(groupRef.current===layer)groupRef.current=null
   marksRef.current.clear()
  }
 },[open,map,visible])
 const focus=(well:QatarWell)=>{
  setSelectedId(well.id)
  map?.setView([well.lat,well.lng],Math.max(map.getZoom(),13),{animate:true})
  marksRef.current.get(well.id)?.openTooltip()
 }
 return <>
  <div className="absolute bottom-28 start-4 z-[1200] flex flex-col items-start gap-2">
   {!open&&<button type="button" onClick={()=>setOpen(true)}
    className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-3 text-[12px] font-semibold text-content shadow-panel hover:bg-cream-100"
    aria-label="Show Qatar wells and groundwater intelligence">
    <Droplets size={17} className="text-sage-700"/> Wells & Groundwater
   </button>}
   {open&&<section className="w-[min(23rem,calc(100vw-2rem))] max-h-[min(70vh,39rem)] overflow-auto rounded-2xl border border-line bg-card/95 p-4 text-content shadow-panel backdrop-blur-md"
    aria-label="Qatar groundwater well locations">
    <div className="flex items-start justify-between gap-2">
     <div>
      <p className="text-[10px] font-bold tracking-[.12em] text-sage-700">GROWA · GROUNDWATER INTELLIGENCE</p>
      <h3 className="mt-1 text-[18px] font-bold">Wells across Qatar</h3>
      <p className="mt-1 text-[11px] text-content-soft">
       Mapped public locations and your registered wells. Not a complete national census.
      </p>
     </div>
     <button type="button" className="rounded-full p-2 hover:bg-muted"
      onClick={()=>{setOpen(false);setSelectedId(null)}}
      aria-label="Close Wells layer"><X size={16}/></button>
    </div>
    <div className="mt-4 grid grid-cols-4 gap-1">
     {[
      {label:'MAPPED',value:publicUnavailable&&stats.userMapped===0?'N/A':String(stats.mapped)},
      {label:'GIS',value:publicUnavailable?'N/A':String(stats.gis)},
      {label:'OSM',value:publicUnavailable?'N/A':String(stats.osm)},
      {label:'SAVED',value:String(stats.userMapped)},
     ].map(item=><div key={item.label} className="rounded-xl bg-stone-50 p-2">
      <p className="text-[9px] font-bold tracking-wide text-content-soft">{item.label}</p>
      <p className="mt-1 text-[20px] font-bold tabular-nums">{item.value}</p>
     </div>)}
    </div>
    <div className="mt-4 flex items-center justify-between gap-2">
     <label className="flex items-center gap-2 text-[11px] font-semibold">
      <input type="checkbox" checked={showPublic}
       onChange={e=>setShowPublic(e.target.checked)} className="accent-sage-700"/>
      Public mapped
     </label>
     <label className="flex items-center gap-2 text-[11px] font-semibold">
      <input type="checkbox" checked={showSaved}
       onChange={e=>setShowSaved(e.target.checked)} className="accent-sage-700"/>
      My mapped wells
     </label>
     <button type="button" className="rounded-lg border border-line p-2"
      aria-label="Refresh well locations" onClick={()=>setReload(x=>x+1)}>
      <RefreshCw size={14} className={loading?'animate-spin':''}/>
     </button>
    </div>
    <p role="status" className="mt-3 text-[10px] text-content-soft">
     {loading?'Loading public GIS and OSM records…':
      publicData?.sourceStatus==='available'?'GIS and OSM sources available':
      publicData?.sourceStatus==='partial'?'Partial source coverage; some providers failed':
      publicData?.sourceStatus==='stale'?'Cached public records; providers currently unavailable':
      'Public source coverage unavailable · total unknown'}
    </p>
    {fetchError&&<p className="mt-1 text-[10px] text-critical">{fetchError}</p>}
    {publicData?.providerStatuses&&<details className="mt-2 rounded-lg border border-line p-2">
     <summary className="cursor-pointer text-[10px] font-semibold">Data providers · coverage</summary>
     <div className="mt-2 space-y-1">{publicData.providerStatuses.map(source=>
      <div key={source.id} className="flex justify-between gap-2 text-[10px]">
       <span>{source.name}</span>
       <strong>{source.state==='available'?source.count+' records':'Unavailable'}</strong>
      </div>)}</div>
    </details>}
    <button type="button" onClick={()=>setAdding(x=>!x)}
     className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ink p-2.5 text-[11px] font-semibold text-white">
     <Plus size={14}/> Register a well by GPS
    </button>
    {adding&&<div className="mt-2 space-y-2 rounded-xl border border-line p-3">
     <input className="w-full rounded-md border border-line p-2 text-[11px]" placeholder="Well name / reference"
      value={wellName} onChange={e=>setWellName(e.target.value)}/>
     <div className="grid grid-cols-2 gap-2">
      <input type="number" step="any" className="min-w-0 rounded-md border border-line p-2 text-[11px]"
       placeholder="Latitude" value={latitude} onChange={e=>setLatitude(e.target.value)}/>
      <input type="number" step="any" className="min-w-0 rounded-md border border-line p-2 text-[11px]"
       placeholder="Longitude" value={longitude} onChange={e=>setLongitude(e.target.value)}/>
     </div>
     {saveError&&<p className="text-[10px] text-critical">{saveError}</p>}
     <button type="button" disabled={saving} onClick={()=>void saveWell()}
      className="rounded-lg bg-sage-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">
      {saving?'Saving…':'Save GPS well'}
     </button>
     <p className="text-[10px] text-content-soft">Only the supplied GPS position is stored, without inferred telemetry.</p>
    </div>}
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-background p-2">
     <Search size={14} className="text-content-soft"/>
     <input type="search" value={filter} onChange={e=>setFilter(e.target.value)}
      placeholder="Search well names or references"
      aria-label="Search well names"
      className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"/>
    </div>
    {selected&&<div className="mt-3 rounded-xl border border-sage-600 bg-cream-50 p-3">
     <p className="text-[9px] font-bold text-sage-700">WELL LOCATION DETAILS</p>
     <h4 className="mt-1 text-[14px] font-bold">{selected.name}</h4>
     <p className="mt-1 text-[11px] text-content-soft">
      {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · {selected.kind.replace('_',' ')}
     </p>
     <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
      <div>Depth: <strong>{selected.depthM===null?'Not reported':selected.depthM+' m'}</strong></div>
      <div>Pump: <strong>{selected.pump??'Not reported'}</strong></div>
      <div>Water level: <strong>Not connected</strong></div>
      <div>Flow rate: <strong>Not connected</strong></div>
      <div>EC / pH: <strong>Not connected</strong></div>
      <div>Live telemetry: <strong>Unavailable</strong></div>
     </div>
     <p className="mt-2 text-[10px] text-content-soft">
      Source: {selected.sourceName??(selected.origin==='openstreetmap'?'OpenStreetMap contributor':'Your saved map point')}
      {selected.reference?' · '+selected.reference:''}
     </p>
     {(selected.sourceUrl||selected.osmUrl)&&<a href={selected.sourceUrl??selected.osmUrl??'#'} target="_blank" rel="noopener noreferrer"
      className="mt-2 inline-block text-[11px] font-bold text-sage-700 underline">
      View original mapped feature
     </a>}
    </div>}
    <div className="mt-3 space-y-1">
     {matching.map(w=><button key={w.id} type="button" onClick={()=>focus(w)}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-line p-2 text-start hover:bg-cream-50">
      <span className="flex min-w-0 items-center gap-2">
       <MapPin size={13} className="shrink-0 text-sage-700"/>
       <span className="min-w-0 truncate text-[11px] font-semibold">{w.name}</span>
      </span>
      <span className="shrink-0 text-[9px] text-content-soft">{w.origin==='openstreetmap'?'OSM':w.origin==='un-gis'?'GIS':'SAVED'}</span>
     </button>)}
     {!loading&&matching.length===0&&<div className="rounded-xl border border-dashed border-line p-4 text-center text-[11px] text-content-soft">
      <WifiOff className="mx-auto mb-2" size={18}/>
      {publicUnavailable?'Public sources are down. You can register a verified GPS well above.':'No documented wells match this filter.'}
     </div>}
    </div>
    {visible.length>40&&<p className="mt-2 text-[10px] text-content-soft">
     Showing 40 of {visible.length} locations. Search to narrow the list; all locations remain on the map.
    </p>}
    <p className="mt-3 border-t border-line pt-3 text-[10px] leading-5 text-content-soft">
     © OpenStreetMap contributors (ODbL). Locations are contributed records, not verified well permits.
     No live water level, abstraction, water quality or pumping status is inferred.
    </p>
   </section>}
  </div>
 </>
}
