'use client'
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CHOKEPOINTS, QATAR, freshAsset, type TrackingAsset, type MapAlert, type MapLayers } from '@/lib/watchtower/global-tracking'
import styles from './global-watchtower.module.css'
export type GlobalTrackingMapProps = {
  assets: TrackingAsset[]; alerts: MapAlert[]; layers: MapLayers; selectedId: string | null
  onSelect: (id: string) => void; now: number
  focus: { lat: number; lon: number; zoom: number; token: number } | null
}
/** Same Esri World Imagery service used by the platform's main SatelliteMap. */
export const ESRI_WORLD_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTRIBUTION = '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Maxar, Earthstar Geographics &amp; the GIS User Community'
// Exact Growa design-system colours, matching styles/growa/colors.css.
const MARKER = { aircraft: '#EEF4C9', vessel: '#A2B78C', critical: '#A8392B', attention: '#C9A227', ink: '#111E13', cream: '#EEF4C9' }

type Observation = { lat: number; lon: number; time: string }
const label = (value: string) => { const node = document.createElement('span'); node.textContent = value; return node }
export function GlobalTrackingMap({ assets, alerts, layers, selectedId, onSelect, focus, now }: GlobalTrackingMapProps) {
  const host = useRef<HTMLDivElement>(null), mapRef = useRef<L.Map | null>(null), graphics = useRef<L.LayerGroup | null>(null)
  const history = useRef(new Map<string, Observation[]>()), select = useRef(onSelect)
  const [revision, setRevision] = useState(0), [tileError, setTileError] = useState(false)
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  useEffect(() => { select.current = onSelect }, [onSelect])
  useEffect(() => {
    if (!host.current) return
    const map = L.map(host.current, { center: [22, 35], zoom: 2, minZoom: 2, maxZoom: 19,
      zoomControl: false, attributionControl: true, preferCanvas: true,
      maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 0.8 })
    mapRef.current = map
    // Esri satellite raster basemap, with Leaflet overlays remaining fully interactive.
    // Tiles are requested only for the visible viewport; no crawler/prefetch.
    const tiles = L.tileLayer(ESRI_WORLD_IMAGERY, {
      maxZoom: 19, maxNativeZoom: 19, noWrap: true,
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
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(host.current); changed()
    return () => { observer.disconnect(); tiles.off(); map.off(); map.remove(); mapRef.current = null; graphics.current = null }
  }, [])
  useEffect(() => {
    const store = history.current
    for (const asset of assets) {
      const samples = store.get(asset.id) ?? []
      if (!samples.length || samples[samples.length - 1].time < asset.observedAt) samples.push({ lat: asset.lat, lon: asset.lon, time: asset.observedAt })
      store.set(asset.id, samples.filter(p => now - Date.parse(p.time) <= 900000).slice(-15))
    }
    for (const [id, samples] of store) if (!samples.length || now - Date.parse(samples[samples.length - 1].time) > 900000) store.delete(id)
    while (store.size > 4000) store.delete(store.keys().next().value!)
  }, [assets, now])
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
    if (layers.trails && selectedId) {
      const samples = history.current.get(selectedId) ?? [], segments: L.LatLngExpression[][] = [[]]
      samples.forEach((p, i) => {
        if (i > 0 && (Math.abs(p.lon - samples[i - 1].lon) > 180 || Date.parse(p.time) - Date.parse(samples[i - 1].time) > 300000)) segments.push([])
        segments[segments.length - 1].push([p.lat, p.lon])
      })
      for (const segment of segments) if (segment.length > 1) L.polyline(segment, { color: MARKER.cream, weight: 3, opacity: 0.95, dashArray: '4 4' }).addTo(group)
    }
  }, [assets, alerts, layers, selectedId, now, revision])
  return <><div ref={host} className={styles.map} role="region" aria-label="Interactive Esri World Imagery global map with selectable aircraft, vessels and food-security alerts" />
    {point && <output className={styles.coordinateReadout} aria-label="Selected map coordinates">
      {point.lat.toFixed(5)}°, {point.lon.toFixed(5)}°
    </output>}
    {tileError && <div className={styles.tileWarning} role="status">Basemap unavailable. Tracking data and source status remain accessible.</div>}</>
}
