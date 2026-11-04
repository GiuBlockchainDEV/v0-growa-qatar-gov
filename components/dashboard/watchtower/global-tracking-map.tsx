'use client'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { QATAR, freshAsset, type TrackingAsset, type MapAlert, type MapLayers } from '@/lib/watchtower/global-tracking'
import {TRACKED_CHOKEPOINTS,type ChokepointId,type ChokepointReport} from '@/lib/watchtower/data-tracking-net'
import type {AISRoute} from '@/lib/watchtower/data-tracking-history'
import type {DemoVessel} from '@/lib/watchtower/demo-vessels'
import styles from './global-watchtower.module.css'
import { getWorldFillZoom, REGIONAL_WATCHTOWER_VIEW } from '@/lib/watchtower/map-viewport'
import { makeAirGreatCircle } from '@/lib/nfii/logistics-route-geometry'
import type {ProductionRiskZone} from '@/lib/watchtower/production-risk'
import { captureObservedPositions, automaticRouteEvidence, worldCopyPolyline, type TrackPoint } from '@/lib/watchtower/route-geometry'
export type GlobalTrackingMapProps = {
  assets: TrackingAsset[]; demoVessels: readonly DemoVessel[]; historyAssets: TrackingAsset[]; alerts: MapAlert[]; riskZones: ProductionRiskZone[]; chokepoints: ChokepointReport[]; aisRoutes: AISRoute[]; layers: MapLayers; selectedId: string | null
  onSelect: (id: string) => void; onChokepointClick: (id: ChokepointId) => void; now: number
  focus: { lat: number; lon: number; zoom: number; token: number } | null
}
/**
 * ESRI political/administrative basemap for global food-security analysis.
 * Base shows country and regional borders; the transparent Reference layer
 * keeps country and city labels readable above the hazard polygons.
 * The separate agricultural SatelliteMap keeps its imagery unchanged.
 */
export const ESRI_POLITICAL_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
export const ESRI_POLITICAL_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors &amp; GIS User Community'
// Exact Growa design-system colours, matching styles/growa/colors.css.
const MARKER = { aircraft: '#EEF4C9', vessel: '#A2B78C', critical: '#A8392B', attention: '#C9A227', ink: '#111E13', cream: '#EEF4C9' }

const label = (value: string) => { const node = document.createElement('span'); node.textContent = value; return node }
export function GlobalTrackingMap({ assets, demoVessels, historyAssets, alerts, riskZones, chokepoints, aisRoutes, layers, selectedId, onSelect, onChokepointClick, focus, now }: GlobalTrackingMapProps) {
  const host = useRef<HTMLDivElement>(null), mapRef = useRef<L.Map | null>(null), graphics = useRef<L.LayerGroup | null>(null), productionGraphics = useRef<L.LayerGroup | null>(null)
  const history = useRef(new Map<string, TrackPoint[]>()), select = useRef(onSelect), selectChokepoint = useRef(onChokepointClick)
  const [revision, setRevision] = useState(0), [tileError, setTileError] = useState(false)
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  useEffect(() => { select.current = onSelect }, [onSelect])
  useEffect(() => { selectChokepoint.current = onChokepointClick }, [onChokepointClick])
  useEffect(() => {
    if (!host.current) return
    // Cover the entire visible viewport. A fixed zoom 2 has only 1024px of
    // unwrapped world imagery, leaving large gray margins on wide displays.
    const initialFloor = getWorldFillZoom(host.current.clientWidth, host.current.clientHeight)
    let currentFloor = initialFloor
    const map = L.map(host.current, {
      // The screenshot's Gulf/Red Sea sector is the default operating
      // picture. Global basemap and panning remain fully available.
      center: [REGIONAL_WATCHTOWER_VIEW.lat,REGIONAL_WATCHTOWER_VIEW.lon],
      zoom: Math.max(initialFloor,REGIONAL_WATCHTOWER_VIEW.zoom),
      minZoom: initialFloor, maxZoom: 19,
      zoomSnap: 0.1, zoomDelta: 0.5,
      zoomControl: false, attributionControl: true, preferCanvas: true,
      // Do not clip the world to +/-180 degrees: ESRI is tiled globally.
      worldCopyJump: true,
    })
    mapRef.current = map
    // Neutral political map: state boundaries, country context and labels.
    // Independent Esri reference labels sit ABOVE translucent risk regions
    // but BELOW aircraft/vessel markers, and never intercept pointer events.
    // Only viewport tiles load; no offline caching or prefetched world tiles.
    const tiles = L.tileLayer(ESRI_POLITICAL_BASE, {
      maxZoom: 19, maxNativeZoom: 16, noWrap: false,
      updateWhenIdle: true, keepBuffer: 1,
      attribution: ESRI_ATTRIBUTION,
    }).addTo(map)
    const labelsPane = map.createPane('watchtower-political-labels')
    labelsPane.style.zIndex = '425'
    labelsPane.style.pointerEvents = 'none'
    const politicalLabels = L.tileLayer(ESRI_POLITICAL_LABELS, {
      pane: 'watchtower-political-labels',
      maxZoom: 19, maxNativeZoom: 16, noWrap: false,
      updateWhenIdle: true, keepBuffer: 1,
      opacity: 1,
    }).addTo(map)
    tiles.on('tileerror', () => setTileError(true))
    tiles.on('tileload', () => setTileError(false))
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
    productionGraphics.current = L.layerGroup().addTo(map)
    graphics.current = L.layerGroup().addTo(map)
    const changed = () => setRevision(n => n + 1)
    map.on('moveend zoomend', changed)
    map.on('click', event => setPoint({ lat: event.latlng.lat, lon: event.latlng.lng }))
    const observer = new ResizeObserver(() => {
      if (!host.current) return
      const nextFloor = getWorldFillZoom(host.current.clientWidth, host.current.clientHeight)
      const wasGlobalOverview = Math.abs(map.getZoom() - currentFloor) <= 0.11
      if (nextFloor !== currentFloor) {
        currentFloor = nextFloor
        map.setMinZoom(nextFloor)
        if (wasGlobalOverview) map.setZoom(nextFloor, { animate: false })
      }
      map.invalidateSize({ pan: false })
    })
    observer.observe(host.current)
    changed()
    return () => { observer.disconnect(); tiles.off(); politicalLabels.off(); map.off(); map.remove(); mapRef.current = null; graphics.current = null; productionGraphics.current = null }
  }, [])
  // Record all source-observed fixes, not just visible / filtered assets.
  // No interpolated backfill: past route is limited to this browser session.
  useEffect(() => {
    captureObservedPositions(history.current, historyAssets, now)
  }, [historyAssets, now])
  // Render large, translucent administrative screening zones UNDER aircraft
  // routes and alert markers, never replacing the interactive Esri basemap.
  // For GDACS points without an Esri polygon, use a clearly approximate radius.
  useEffect(() => {
    const map=mapRef.current,group=productionGraphics.current
    if(!map||!group)return
    group.clearLayers()
    if(!layers.production)return
    const bounded=riskZones.slice(0,50)
    const colors={high:'#B4533B',elevated:'#D6A22C'} as const
    for(const zone of bounded){
      const color=colors[zone.severity]
      const isSelected=zone.id===selectedId
      const style:L.PathOptions={
        color,fillColor:color,fillOpacity:isSelected?.35:.18,
        opacity:isSelected?1:.8,weight:isSelected?2.5:1.4,
        dashArray:zone.boundaryBasis==='approximate_point_radius'?'5 7':undefined,
      }
      const title=label(
        zone.name+' · '+zone.driver.toUpperCase()+' · '+zone.severity.toUpperCase()+
        ' | '+(zone.boundaryBasis==='esri_admin1_screening'?
          'Administrative region screening, NOT verified event footprint':
          'Approximate event-point screening radius, NOT verified event footprint')+
        '. Click for production and cost exposure.',
      )
      let layer:L.GeoJSON | L.Circle
      if(zone.geometry){
        // GeoJSON geometry is [lon,lat]; geoJSON handles coordinate order.
        const collection={
          type:'Feature' as const,properties:{id:zone.id},
          geometry:zone.geometry,
        }
        layer=L.geoJSON(collection as GeoJSON.Feature,{
          style:()=>style,interactive:true,
        })
      }else if(zone.radiusKm){
        layer=L.circle([zone.center.lat,zone.center.lon],{
          ...style,radius:zone.radiusKm*1000,
        })
      }else continue
      layer.bindTooltip(title,{sticky:true,direction:'auto',className:styles.riskTooltip})
        .on('click',()=>select.current(zone.id))
        .addTo(group)
    }
  },[riskZones,layers.production,selectedId,revision])
  useEffect(() => { if (focus) mapRef.current?.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 0.7 }) }, [focus])
  useEffect(() => {
    const map = mapRef.current, group = graphics.current
    if (!map || !group) return
    group.clearLayers()
    const bounds = map.getBounds().pad(0.15), zoom = map.getZoom(), buckets = new Map<string, TrackingAsset[]>()
    for (const asset of assets) {
      if ((asset.kind === 'aircraft' && !layers.aircraft) || (asset.kind === 'vessel' && !layers.vessels) || !bounds.contains([asset.lat, asset.lon])) continue
      const pixel = map.project([asset.lat, asset.lon], zoom)
      const key = zoom < 6 && asset.id !== selectedId ? asset.kind + ':' + Math.floor(pixel.x / 42) + ':' + Math.floor(pixel.y / 42) : asset.id
      const bucket = buckets.get(key) ?? []; bucket.push(asset); buckets.set(key, bucket)
    }
    for (const bucket of buckets.values()) {
      const asset = bucket[0], aircraft = asset.kind === 'aircraft', color = aircraft ? MARKER.aircraft : MARKER.vessel
      if (bucket.length > 1) {
        const lat = bucket.reduce((sum, a) => sum + a.lat, 0) / bucket.length, lon = bucket.reduce((sum, a) => sum + a.lon, 0) / bucket.length
        const icon = L.divIcon({ className: styles.cluster, iconSize: [34, 34], iconAnchor: [17, 17],
          html: '<span style="border-color:' + color + ';color:' + color + '">' + bucket.length + '</span>' })
        L.marker([lat, lon], { icon, title: bucket.length + ' ' + asset.kind + ' observations', keyboard: true })
          .bindTooltip(label(bucket.length + ' ' + asset.kind + ' observations. Click to zoom.'))
          .on('click', () => map.setView([lat, lon], Math.min(zoom + 2, 9))).addTo(group)
      } else {
        const heading = Number.isFinite(asset.heading) ? asset.heading! : 0
        const path = aircraft ? 'M12 1L14 9L22 14V17L14 14V20L17 22V23L12 21L7 23V22L10 20V14L2 17V14L10 9Z' : 'M12 1L19 8L18 22H6L5 8Z'
        const icon = L.divIcon({ className: styles.asset, iconSize: [24, 24], iconAnchor: [12, 12],
          html: '<svg viewBox="0 0 24 24" width="24" height="24" style="transform:rotate(' + heading + 'deg);opacity:' + (freshAsset(asset, now) ? '1' : '.4') + '"><path d="' + path + '" fill="' + color + '" stroke="' + (asset.id === selectedId ? MARKER.cream : MARKER.ink) + '" stroke-width="1.5"/></svg>' })
        L.marker([asset.lat, asset.lon], { icon, title: asset.label, keyboard: true, zIndexOffset: asset.id === selectedId ? 900 : 100 })
          .bindTooltip(label(asset.label + ' / ' + asset.source + ' / ' +
            (freshAsset(asset, now) ? 'recent fix' : 'LAST KNOWN / ' + asset.observedAt + ' (not live)')))
          .on('click', () => select.current(asset.id)).addTo(group)
      }
    }
    // Separate illustrative layer: NOT TrackingAsset, never in clusters, routes,
    // histories, totals, selection or operational intelligence.
    if(layers.vessels){
      for(const demo of demoVessels){
        if(!bounds.contains([demo.lat,demo.lon]))continue
        const icon=L.divIcon({className:styles.demoVessel,iconSize:[54,34],iconAnchor:[27,17],
          html:'<span class="'+styles.demoVesselBadge+'">DEMO</span>'+
            '<svg viewBox="0 0 24 24" width="24" height="24" style="transform:rotate('+
            demo.heading+'deg)"><path d="M12 1L19 8L18 22H6L5 8Z" fill="#98816D" stroke="#6F5A48" stroke-width="1.5"/></svg>'})
        L.marker([demo.lat,demo.lon],{icon,interactive:false,title:'DEMO · synthetic vessel, not AIS'})
          .addTo(group)
      }
    }
    // Complete airport/port PAIRS from source lookup, automatically visible.
    // Neither origin->fix nor fix->destination is an actual observed track:
    // these are explicitly labelled reference legs, with separate style.
    const routeAssets=assets.filter(asset=>{
      const i=asset.itinerary
      return (asset.kind==='aircraft'?layers.aircraft:layers.vessels)&&
        i?.origin?.lat!=null&&i.origin.lon!=null&&
        i.destination?.lat!=null&&i.destination.lon!=null&&
        bounds.contains([asset.lat,asset.lon])
    })
    if (layers.trails || layers.projections) {
      const ordered=[...routeAssets].sort((a,b)=>Number(a.id===selectedId)-Number(b.id===selectedId)).slice(0,140)
      for(const asset of ordered){
        const i=asset.itinerary!
        const origin=i.origin!,dest=i.destination!
        const position={lat:asset.lat,lon:asset.lon}
        // Flight paths: shortest geodesic via observed position, NOT official airways.
        // Ship paths: use land-avoiding ocean geometry only, never sea straightlines.
        // Never draw the green ORIGIN -> POSITION tail for aircraft.
        // Maritime route references are unaffected.
        const from=asset.kind==='vessel'?i.modelSeaLegs?.completed??[]:[]
        const to=asset.kind==='aircraft'?
          makeAirGreatCircle([position.lat,position.lon],[dest.lat!,dest.lon!])
            .flat().map(([lat,lon])=>({lat,lon})):
          i.modelSeaLegs?.remaining??[]
        const selected=asset.id===selectedId
        const trusted=i.confidence!=='lookup_unverified'
        if(asset.kind==='vessel'&&layers.trails&&from.length>1){
          L.polyline(worldCopyPolyline(from,map.getCenter().lng),{
            color:trusted?'#72967A':'#77848A',weight:selected?4:2.1,
            opacity:selected?0.95:0.62,dashArray:'2 7',
          }).bindTooltip(label(
            'ORIGIN → POSITION reference, NOT an observed completed voyage'+
            '. '+origin.name+' to latest fix. '+i.description,
          )).on('click',()=>select.current(asset.id)).addTo(group)
        }
        if(layers.projections&&to.length>1){
          L.polyline(worldCopyPolyline(to,map.getCenter().lng),{
            color:trusted?'#D6A22C':'#9F8E68',weight:selected?4:2.1,
            opacity:selected?1:0.7,dashArray:'8 8',
          }).bindTooltip(label(
            'POSITION → DESTINATION reference, NOT a confirmed plan. '+
            dest.name+'. '+i.description,
          )).on('click',()=>select.current(asset.id)).addTo(group)
        }
        for(const [endpoint,name,tint] of [
          [origin,'ORIGIN / '+origin.name,'#72967A'],
          [dest,'DESTINATION / '+dest.name,'#D6A22C'],
        ] as const){
          L.circleMarker([endpoint.lat!,endpoint.lon!],{
            radius:selected?7:4,color:tint,
            fillColor:'#FFFFFF',weight:selected?3:2,fillOpacity:selected?.95:.65,
          }).bindTooltip(label(name+' / '+i.source+' / '+i.confidence))
            .on('click',()=>select.current(asset.id)).addTo(group)
        }
      }
    }
    // Historical AIS from source observations, not the few points accumulated
    // since page open. Broken AIS gaps remain BROKEN, never interpolated.
    if(layers.trails&&layers.vessels){
      const visibleShips=new Set(assets.filter(a=>a.kind==='vessel').map(a=>a.id))
      for(const route of aisRoutes){
        if(route.status!=='observed'||!visibleShips.has(route.id))continue
        const highlighted=selectedId===route.id
        for(const points of route.segments.slice(0,15)){
          if(points.length<2)continue
          L.polyline(worldCopyPolyline(points,map.getCenter().lng),{
            color:'#356F53',weight:highlighted?4.5:2.5,
            opacity:highlighted?1:0.82,lineCap:'round',
          }).bindTooltip(label('OBSERVED AIS HISTORY · '+route.mmsi+
            ' · '+points.length+' measured positions · '+
            points[0].time+' to '+points[points.length-1].time+
            '. Gaps are intentionally not connected. Source: data-tracking.net.'))
            .on('click',()=>select.current(route.id)).addTo(group)
        }
      }
    }
    if (layers.risks) for (const alert of alerts) {
      const color = alert.severity === 'high' ? MARKER.critical : MARKER.attention
      L.circleMarker([alert.lat, alert.lon], { radius: alert.id === selectedId ? 11 : 7, color, weight: 2, fillColor: color, fillOpacity: 0.35 })
        .bindTooltip(label(alert.source + ': ' + alert.title), {
          direction: 'auto', opacity: 0.98,
          className: styles.riskTooltip,
        }).on('click', () => select.current(alert.id)).addTo(group)
    }
    if (layers.gateways) for(const point of TRACKED_CHOKEPOINTS){
      const status=chokepoints.find(area=>area.id===point.id)
      const isCovered=status?.state==='partial'||status?.state==='stale'
      const markerColor=isCovered?'#6C8952':'#98A298'
      const title=point.label+' / '+
        (status?.state==='stale'?'delayed AIS feed':
          status?.state==='partial'?'source-backed AIS coverage':
          point.feed?'AIS feed currently unavailable':'no data-tracking.net AIS coverage')+
        ' / '+(status?.vesselCount??'N/A')+' cargo-like AIS vessels, '+
        (status?.crossings24h??'N/A')+' all-vessel crossings/24h. '+
        'Source coverage is not evidence of security or route availability.'
      L.circleMarker([point.lat,point.lon],{
        radius:point.feed?7:5,color:markerColor,weight:2,
        fillColor:markerColor,fillOpacity:point.feed?.32:.10,
        dashArray:point.feed?undefined:'3 4',
      }).bindTooltip(label(title),{className:styles.riskTooltip})
        .on('click',()=>selectChokepoint.current(point.id)).addTo(group)
    }
    L.marker([QATAR.lat, QATAR.lon], { interactive: false, icon: L.divIcon({ className: styles.qatar, html: '<span></span><b>QATAR</b>', iconSize: [80, 24], iconAnchor: [9, 12] }), zIndexOffset: 800 }).addTo(group)
    // Display only real observations and origin/destination reference routes.
    // No artificial 20-minute continuation or short screen-length heading
    // dashes in front of aircraft and vessels. Selecting only highlights.
    if (layers.trails) {
      // Keep ship AIS histories, never render green aircraft trails.
      const visible = assets.filter(asset =>
        asset.kind === 'vessel' && layers.vessels &&
        bounds.contains([asset.lat, asset.lon]),
      )
      const routes = automaticRouteEvidence(visible, history.current, now)
        .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
      for (const route of routes) {
        const focused = route.id === selectedId
        for (const segment of route.observedSegments) {
          const coords = worldCopyPolyline(segment, map.getCenter().lng)
          L.polyline(coords, {
            color: '#6C8952', weight: focused ? 4.5 : 2.7,
            opacity: focused ? 1 : zoom < 5 ? 0.78 : 0.9,
            lineCap: 'round',
          }).bindTooltip(label(
            'OBSERVED / ' + segment.length + ' actual fixes captured in this browser session. Click for details.',
          )).on('click', () => select.current(route.id)).addTo(group)
        }
      }
    }
  }, [assets, demoVessels, historyAssets, alerts, chokepoints, aisRoutes, layers, selectedId, now, revision])
  return <><div ref={host} className={styles.map} role="region" aria-label="Interactive Esri political world map with country borders, regions, aircraft, vessels and food-production risk areas" />
    {point && <output className={styles.coordinateReadout} aria-label="Selected map coordinates">
      {point.lat.toFixed(5)}°, {point.lon.toFixed(5)}°
    </output>}
    {tileError && <div className={styles.tileWarning} role="status">Basemap unavailable. Tracking data and source status remain accessible.</div>}</>
}
