'use client'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CHOKEPOINTS, QATAR, freshAsset, type TrackingAsset, type MapAlert, type MapLayers } from '@/lib/watchtower/global-tracking'
import styles from './global-watchtower.module.css'
import { getWorldFillZoom } from '@/lib/watchtower/map-viewport'
import { captureObservedPositions, observedRoute, forwardCourseProjection, worldCopyPolyline, type TrackPoint } from '@/lib/watchtower/route-geometry'
export type GlobalTrackingMapProps = {
  assets: TrackingAsset[]; historyAssets: TrackingAsset[]; alerts: MapAlert[]; layers: MapLayers; selectedId: string | null
  onSelect: (id: string) => void; now: number
  focus: { lat: number; lon: number; zoom: number; token: number } | null
}
/** Same Esri World Imagery service used by the platform's main SatelliteMap. */
export const ESRI_WORLD_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTRIBUTION = '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Maxar, Earthstar Geographics &amp; the GIS User Community'
// Exact Growa design-system colours, matching styles/growa/colors.css.
const MARKER = { aircraft: '#EEF4C9', vessel: '#A2B78C', critical: '#A8392B', attention: '#C9A227', ink: '#111E13', cream: '#EEF4C9' }

const label = (value: string) => { const node = document.createElement('span'); node.textContent = value; return node }
export function GlobalTrackingMap({ assets, historyAssets, alerts, layers, selectedId, onSelect, focus, now }: GlobalTrackingMapProps) {
  const host = useRef<HTMLDivElement>(null), mapRef = useRef<L.Map | null>(null), graphics = useRef<L.LayerGroup | null>(null)
  const history = useRef(new Map<string, TrackPoint[]>()), select = useRef(onSelect)
  const [revision, setRevision] = useState(0), [tileError, setTileError] = useState(false)
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  useEffect(() => { select.current = onSelect }, [onSelect])
  useEffect(() => {
    if (!host.current) return
    // Cover the entire visible viewport. A fixed zoom 2 has only 1024px of
    // unwrapped world imagery, leaving large gray margins on wide displays.
    const initialFloor = getWorldFillZoom(host.current.clientWidth, host.current.clientHeight)
    let currentFloor = initialFloor
    const map = L.map(host.current, {
      center: [12, 20], zoom: initialFloor, minZoom: initialFloor, maxZoom: 19,
      zoomSnap: 0.1, zoomDelta: 0.5,
      zoomControl: false, attributionControl: true, preferCanvas: true,
      // Do not clip the world to +/-180 degrees: ESRI is tiled globally.
      worldCopyJump: true,
    })
    mapRef.current = map
    // Esri satellite raster basemap, with Leaflet overlays remaining fully interactive.
    // Tiles are requested only for the visible viewport; no crawler/prefetch.
    const tiles = L.tileLayer(ESRI_WORLD_IMAGERY, {
      maxZoom: 19, maxNativeZoom: 19, noWrap: false,
      updateWhenIdle: true, keepBuffer: 1,
      attribution: ESRI_ATTRIBUTION,
    }).addTo(map)
    tiles.on('tileerror', () => setTileError(true)); tiles.on('tileload', () => setTileError(false))
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
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
    return () => { observer.disconnect(); tiles.off(); map.off(); map.remove(); mapRef.current = null; graphics.current = null }
  }, [])
  // Record all source-observed fixes, not just visible / filtered assets.
  // No interpolated backfill: past route is limited to this browser session.
  useEffect(() => {
    captureObservedPositions(history.current, historyAssets, now)
  }, [historyAssets, now])
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
          .bindTooltip(label(asset.label + ' / ' + asset.source + ' / ' + (freshAsset(asset, now) ? 'recent' : 'stale')))
          .on('click', () => select.current(asset.id)).addTo(group)
      }
    }
    if (layers.risks) for (const alert of alerts) {
      const color = alert.severity === 'high' ? MARKER.critical : MARKER.attention
      L.circleMarker([alert.lat, alert.lon], { radius: alert.id === selectedId ? 11 : 7, color, weight: 2, fillColor: color, fillOpacity: 0.35 })
        .bindTooltip(label(alert.source + ': ' + alert.title)).on('click', () => select.current(alert.id)).addTo(group)
    }
    if (layers.gateways) for (const point of CHOKEPOINTS) L.circleMarker([point.lat, point.lon], { radius: 5, color: MARKER.cream, weight: 2, fillOpacity: 0, dashArray: '2 2' })
      .bindTooltip(label(point.label + ' / geographic reference, not a closure alert')).addTo(group)
    L.marker([QATAR.lat, QATAR.lon], { interactive: false, icon: L.divIcon({ className: styles.qatar, html: '<span></span><b>QATAR</b>', iconSize: [80, 24], iconAnchor: [9, 12] }), zIndexOffset: 800 }).addTo(group)
    // A selected vessel/aircraft has two explicitly distinct segments:
    // SOLID = actually observed in this browsing session.
    // DASHED = limited constant-course projection, not a published route.
    // Draw both without fake waypoints or coastline-crossing voyage claims.
    if (selectedId && (layers.trails || layers.projections)) {
      const chosen = historyAssets.find(a => a.id === selectedId)
      if (chosen && (chosen.kind === 'aircraft' ? layers.aircraft : layers.vessels)) {
        if (layers.trails) {
          const record = observedRoute(history.current.get(selectedId) ?? [],chosen.kind)
          for (const segment of record.segments) {
            if (segment.length < 2) continue
            const coords = worldCopyPolyline(segment, map.getCenter().lng)
            const style = { color: '#6C8952', weight: 4, opacity: 0.95, lineCap: 'round' as const }
            const path = L.polyline(coords,style)
              .bindTooltip(label('OBSERVED / recorded fixes in this browser session ('+segment.length+' positions)'))
            path.addTo(group)
          }
        }
        if (layers.projections) {
          const projection = forwardCourseProjection(chosen,now)
          if (projection) {
            const coords = worldCopyPolyline(projection.path,map.getCenter().lng)
            const future = L.polyline(coords,{
              color:'#C9A227',weight:3,opacity:.98,dashArray:'3 9',lineCap:'round',
            }).bindTooltip(label('ESTIMATED / constant speed and course for '+
              projection.horizonMinutes+' min. NOT a verified itinerary or navigable route.'))
            future.addTo(group)
            const end=coords[coords.length-1]
            L.circleMarker(end,{radius:5,color:'#7A5E0F',weight:2,fillColor:'#C9A227',fillOpacity:.85})
              .bindTooltip(label('Projected '+projection.horizonMinutes+' min endpoint; unverified'))
              .addTo(group)
          }
        }
      }
    }
  }, [assets, historyAssets, alerts, layers, selectedId, now, revision])
  return <><div ref={host} className={styles.map} role="region" aria-label="Interactive Esri World Imagery global map with selectable aircraft, vessels and food-security alerts" />
    {point && <output className={styles.coordinateReadout} aria-label="Selected map coordinates">
      {point.lat.toFixed(5)}°, {point.lon.toFixed(5)}°
    </output>}
    {tileError && <div className={styles.tileWarning} role="status">Basemap unavailable. Tracking data and source status remain accessible.</div>}</>
}
