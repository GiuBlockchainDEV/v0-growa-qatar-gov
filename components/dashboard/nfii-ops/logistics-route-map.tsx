'use client'

import {useEffect,useRef,useState} from 'react'
import type * as Leaflet from 'leaflet'
import type {RouteMapOverlay} from '@/lib/nfii/logistics-route-map'
import type {GeoPointTuple} from '@/lib/nfii/logistics-route-geometry'
import 'leaflet/dist/leaflet.css'

type Props={
  routes:RouteMapOverlay[]
  selectedId:string|null
  onSelect:(id:string)=>void
  locale:'en'|'ar'
}
const colors={sea:'#2F5D50',air:'#C9A227',road:'#B4644A'}
const format=(v:GeoPointTuple):Leaflet.LatLngTuple=>[v[0],v[1]]
export function LogisticsRouteMap({routes,selectedId,onSelect,locale}:Props){
  const holder=useRef<HTMLDivElement>(null)
  const map=useRef<Leaflet.Map|null>(null)
  const lib=useRef<typeof Leaflet|null>(null)
  const group=useRef<Leaflet.LayerGroup|null>(null)
  const handler=useRef(onSelect)
  const [ready,setReady]=useState(false)
  const [failure,setFailure]=useState(false)
  useEffect(()=>{handler.current=onSelect},[onSelect])

  useEffect(()=>{
    let cancelled=false
    void import('leaflet').then(L=>{
      if(cancelled||!holder.current)return
      lib.current=L
      const instance=L.map(holder.current,{
        zoomControl:true,scrollWheelZoom:false,attributionControl:true,
        minZoom:2,maxZoom:15,worldCopyJump:false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'&copy; OpenStreetMap contributors',maxZoom:15,
        subdomains:'abc',
      }).addTo(instance)
      group.current=L.layerGroup().addTo(instance)
      map.current=instance
      instance.setView([24.8,51.3],4)
      setReady(true)
      window.requestAnimationFrame(()=>instance.invalidateSize())
    }).catch(()=>{if(!cancelled)setFailure(true)})
    return ()=>{
      cancelled=true
      map.current?.remove()
      map.current=null
      group.current=null
      lib.current=null
    }
  },[])

  useEffect(()=>{
    if(!ready||!map.current||!lib.current||!group.current)return
    const L=lib.current
    const layers=group.current
    layers.clearLayers()
    const ordered=[...routes].sort((a,b)=>Number(a.id===selectedId)-Number(b.id===selectedId))
    const positions:Leaflet.LatLngTuple[]=[]
    for(const route of ordered){
      const selected=route.id===selectedId
      for(const path of route.paths){
        if(path.length<2)continue
        const points=path.map(format)
        positions.push(...points)
        const line=L.polyline(points,{
          color:colors[route.mode],
          weight:selected?5:3,
          opacity:selected?1:route.mode==='air'?0.8:0.55,
          dashArray:route.mode==='air'?'8 9':
            route.fidelity==='illustrative'?'7 9':undefined,
        }).addTo(layers)
        line.bindTooltip((route.from+' → '+route.to+
          (route.via?' · '+route.via:'')+
          (route.mode==='air'?' · great-circle reference; NOT a verified flight track':
          route.fidelity==='modeled_geometry'?' · computed ocean-grid estimate':
          route.fidelity==='provider_geometry'?' · source API geometry':' · unverified')))
        line.on('click',()=>handler.current(route.id))
      }
      positions.push(format(route.origin),format(route.destination))
      const show=selected
      if(show){
        L.circleMarker(format(route.origin),{
          radius:7,color:colors[route.mode],weight:2,fillOpacity:0.9,
        }).bindTooltip(route.from).addTo(layers)
        L.circleMarker(format(route.destination),{
          radius:7,color:'#2F5D50',weight:2,fillColor:'#ffffff',fillOpacity:1,
        }).bindTooltip(route.to).addTo(layers)
      }
      if(!route.paths.length&&selected){
        L.circleMarker(format(route.origin),{radius:8,color:colors[route.mode],weight:2,fillOpacity:.25})
          .bindTooltip('Origin hub · route geometry not verified').addTo(layers)
      }
    }
    if(positions.length){
      map.current.fitBounds(L.latLngBounds(positions),{padding:[28,28],maxZoom:7})
    }else{
      map.current.setView([25,51.6],5)
    }
    window.requestAnimationFrame(()=>map.current?.invalidateSize())
  },[routes,selectedId,ready])

  return <div className="relative">
    <div ref={holder} role="img"
      aria-label={locale==='ar'?'خريطة تفاعلية لمسارات استيراد الغذاء إلى قطر':'Interactive map of candidate food import routes to Qatar'}
      className="h-[360px] w-full overflow-hidden rounded-lg border border-line bg-muted/30 md:h-[440px]"/>
    {failure&&<p role="alert" className="absolute inset-x-4 top-4 rounded-md bg-card p-3 text-[12px] text-critical">
      {locale==='ar'?'تعذر تحميل الخريطة':'Map library unavailable; use the corridor table.'}
    </p>}
    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-content-soft">
      <span className="inline-flex items-center gap-2">
        <span className="h-0 w-7 border-t-[3px] border-[#2F5D50]"/>
        {locale==='ar'?'بحري':'Sea'}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0 w-7 border-t-[3px] border-dashed border-[#C9A227]"/>
        {locale==='ar'?'جوي':'Air'}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0 w-7 border-t-[3px] border-[#B4644A]"/>
        {locale==='ar'?'بري':'Road'}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0 w-7 border-t-[3px] border-dashed border-content-soft"/>
        {locale==='ar'?'جوي متقطع: أقصر مسار جغرافي، وليس رحلة مؤكدة':'Dashed air: great-circle reference, NOT a verified flight track'}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0 w-7 border-t-[3px] border-solid border-content-soft"/>
        {locale==='ar'?'بحري متصل: هندسة من مزود أو شبكة محيطية محسوبة':'Solid sea: provider geometry or modeled ocean network'}
      </span>
    </div>
  </div>
}
