'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Plus, Minus, Crosshair } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useAuth } from '@/hooks/use-auth'

const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17

type MapPointType = 'farm' | 'facility' | 'sensor' | 'custom'

interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: MapPointType
}

interface FarmApiRow {
  id?: string
  name_en?: string
  name_ar?: string
  name?: string
  location?: string | null
}

interface SatelliteMapProps {
  locale?: string
  targetFarmId?: string | null
  targetZoom?: number
}

interface MapController {
  zoomIn: () => void
  zoomOut: () => void
  flyTo: (coords: [number, number], zoom: number, options?: { duration?: number }) => void
  getZoom: () => number
  on: (event: string, handler: (...args: any[]) => void) => void
  off: (event: string, handler: (...args: any[]) => void) => void
  remove: () => void
}

interface CustomPoint {
  id: string
  lat: number
  lng: number
  label: string
  pointType: MapPointType
}

interface PolygonVertex {
  lat: number
  lng: number
}

type PointPolygonsMap = Record<string, PolygonVertex[][]>

const POINT_TYPE_OPTIONS: Array<{ value: MapPointType; label: string }> = [
  { value: 'custom', label: 'Custom' },
  { value: 'farm', label: 'Farm' },
  { value: 'facility', label: 'Facility' },
  { value: 'sensor', label: 'Sensor' },
]

const POINT_TYPE_LABELS: Record<MapPointType, string> = {
  custom: 'Custom',
  farm: 'Farm',
  facility: 'Facility',
  sensor: 'Sensor',
}

function hashToRange(input: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  const normalized = hash / 100000
  return min + normalized * (max - min)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function estimateFarmCoordinates(farmId: string, location?: string | null) {
  const locationKey = (location || '').toLowerCase()
  const cityBias: Record<string, { lat: number; lng: number }> = {
    'al khor': { lat: 25.6839, lng: 51.5058 },
    'al rayyan': { lat: 25.2919, lng: 51.4244 },
    'umm salal': { lat: 25.4167, lng: 51.4065 },
    'al daayen': { lat: 25.4476, lng: 51.5254 },
    'al wakrah': { lat: 25.1682, lng: 51.6034 },
    'madinat ash shamal': { lat: 26.1293, lng: 51.2068 },
  }

  const matchedCity = Object.entries(cityBias).find(([city]) => locationKey.includes(city))
  const base = matchedCity?.[1] || QATAR_CENTER
  const latOffset = hashToRange(`${farmId}-lat`, -0.035, 0.035)
  const lngOffset = hashToRange(`${farmId}-lng`, -0.05, 0.05)

  return {
    lat: base.lat + latOffset,
    lng: base.lng + lngOffset,
  }
}

function normalizePolygonVertices(input: unknown): PolygonVertex[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
      const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng } satisfies PolygonVertex
    })
    .filter((vertex): vertex is PolygonVertex => Boolean(vertex))
}

function isLeafletUiClick(event: any) {
  const target = event?.originalEvent?.target
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.leaflet-marker-icon, .leaflet-popup, .leaflet-popup-content, .leaflet-control, .custom-marker, .leaflet-interactive'
    )
  )
}

export function SatelliteMap({ locale = 'en', targetFarmId = null, targetZoom }: SatelliteMapProps) {
  const { user } = useAuth()
  const { organization } = useOrganization()

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapController | null>(null)
  const leafletRef = useRef<any>(null)
  const markerInstancesRef = useRef<any[]>([])
  const polygonInstancesRef = useRef<any[]>([])
  const draftPolylineRef = useRef<any | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
  const [farmRows, setFarmRows] = useState<FarmApiRow[]>([])
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([])
  const [pointPolygons, setPointPolygons] = useState<PointPolygonsMap>({})
  const [isAddPointMode, setIsAddPointMode] = useState(false)
  const [newPointType, setNewPointType] = useState<MapPointType>('custom')
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const [polygonDrawPointId, setPolygonDrawPointId] = useState<string | null>(null)
  const [draftPolygon, setDraftPolygon] = useState<PolygonVertex[]>([])

  const organizationType = (organization?.organization_type || organization?.type || '')
    .toString()
    .toLowerCase()
  const isFarmCompanyContext = organizationType === 'farm_company'
  const isGrowaAdmin = Boolean(user?.email?.toLowerCase().endsWith('@growa.ai'))

  const customPointsStorageKey = useMemo(
    () => `growa-custom-map-points:${user?.id || 'anonymous'}`,
    [user?.id]
  )
  const pointPolygonsStorageKey = useMemo(
    () => `growa-custom-point-polygons:${user?.id || 'anonymous'}`,
    [user?.id]
  )

  useEffect(() => {
    if (!isGrowaAdmin) {
      setCustomPoints([])
      setIsAddPointMode(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(customPointsStorageKey)
      if (!raw) {
        setCustomPoints([])
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setCustomPoints([])
        return
      }
      const normalized = parsed
        .map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return null
          const row = entry as Record<string, unknown>
          const id = typeof row.id === 'string' ? row.id : ''
          const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
          const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
          const label = typeof row.label === 'string' ? row.label : ''
          const rawPointType = typeof row.pointType === 'string' ? row.pointType : ''
          const pointType: MapPointType = POINT_TYPE_OPTIONS.some(
            (option) => option.value === rawPointType
          )
            ? (rawPointType as MapPointType)
            : 'custom'
          if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return { id, lat, lng, label: label.trim() || 'Custom Point', pointType } satisfies CustomPoint
        })
        .filter((row): row is CustomPoint => Boolean(row))
      setCustomPoints(normalized)
    } catch {
      setCustomPoints([])
    }
  }, [customPointsStorageKey, isGrowaAdmin])

  useEffect(() => {
    if (!isGrowaAdmin) return
    try {
      window.localStorage.setItem(customPointsStorageKey, JSON.stringify(customPoints))
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [customPoints, customPointsStorageKey, isGrowaAdmin])

  useEffect(() => {
    if (!isGrowaAdmin) {
      setPointPolygons({})
      setActivePointId(null)
      setPolygonDrawPointId(null)
      setDraftPolygon([])
      return
    }
    try {
      const raw = window.localStorage.getItem(pointPolygonsStorageKey)
      if (!raw) {
        setPointPolygons({})
        return
      }
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        setPointPolygons({})
        return
      }
      const normalizedEntries = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
        const polygons = (Array.isArray(value) ? value : [])
          .map((polygon) => normalizePolygonVertices(polygon))
          .filter((vertices) => vertices.length >= 3)
        return [key, polygons] as const
      })
      setPointPolygons(Object.fromEntries(normalizedEntries))
    } catch {
      setPointPolygons({})
    }
  }, [isGrowaAdmin, pointPolygonsStorageKey])

  useEffect(() => {
    if (!isGrowaAdmin) return
    try {
      window.localStorage.setItem(pointPolygonsStorageKey, JSON.stringify(pointPolygons))
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, [isGrowaAdmin, pointPolygons, pointPolygonsStorageKey])

  const dynamicFarmMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = []
    for (const farm of farmRows) {
      if (!farm.id) continue
      const coordinates = estimateFarmCoordinates(farm.id, farm.location || null)
      const label =
        (locale === 'ar' && farm.name_ar) || farm.name_en || farm.name || `Farm ${farm.id.slice(0, 8)}`
      markers.push({ id: farm.id, lat: coordinates.lat, lng: coordinates.lng, label, type: 'farm' })
    }
    return markers
  }, [farmRows, locale])

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const custom = customPoints.map((point) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
      type: point.pointType,
    }))
    return [...dynamicFarmMarkers, ...custom]
  }, [customPoints, dynamicFarmMarkers])

  const parsePointTypeInput = useCallback((input: string | null, fallback: MapPointType) => {
    if (input === null) return fallback
    const normalized = input.trim().toLowerCase()
    if (!normalized) return fallback
    const byValue = POINT_TYPE_OPTIONS.find((option) => option.value === normalized)
    if (byValue) return byValue.value
    const byLabel = POINT_TYPE_OPTIONS.find((option) => option.label.toLowerCase() === normalized)
    if (byLabel) return byLabel.value
    return fallback
  }, [])

  const handleEditPoint = useCallback(
    (pointId: string) => {
      const target = customPoints.find((point) => point.id === pointId)
      if (!target) return
      const labelInput = window.prompt(
        locale === 'ar' ? 'عدّل اسم النقطة' : 'Edit point name',
        target.label
      )
      if (labelInput === null) return
      const nextLabel = labelInput.trim() || target.label
      const typeInput = window.prompt(
        locale === 'ar'
          ? 'عدّل نوع النقطة (custom, farm, facility, sensor)'
          : 'Edit point type (custom, farm, facility, sensor)',
        target.pointType
      )
      const nextType = parsePointTypeInput(typeInput, target.pointType)
      setCustomPoints((prev) =>
        prev.map((entry) =>
          entry.id === pointId ? { ...entry, label: nextLabel, pointType: nextType } : entry
        )
      )
    },
    [customPoints, locale, parsePointTypeInput]
  )

  const handleDeletePoint = useCallback(
    (pointId: string) => {
      const target = customPoints.find((point) => point.id === pointId)
      if (!target) return
      const confirmed = window.confirm(
        locale === 'ar'
          ? `هل تريد حذف النقطة "${target.label}" وكل المضلعات المرتبطة بها؟`
          : `Delete point "${target.label}" and all linked polygons?`
      )
      if (!confirmed) return

      setCustomPoints((prev) => prev.filter((entry) => entry.id !== pointId))
      setPointPolygons((prev) => {
        if (!(pointId in prev)) return prev
        const next = { ...prev }
        delete next[pointId]
        return next
      })
      setActivePointId((prev) => (prev === pointId ? null : prev))
      setPolygonDrawPointId((prev) => (prev === pointId ? null : prev))
      setDraftPolygon([])
    },
    [customPoints, locale]
  )

  const startPolygonDraw = useCallback((pointId: string) => {
    setActivePointId(pointId)
    setPolygonDrawPointId(pointId)
    setDraftPolygon([])
    setIsAddPointMode(false)
  }, [])

  const cancelPolygonDraw = useCallback(() => {
    setPolygonDrawPointId(null)
    setDraftPolygon([])
  }, [])

  const saveDraftPolygon = useCallback(() => {
    if (!polygonDrawPointId || draftPolygon.length < 3) return
    setPointPolygons((prev) => ({
      ...prev,
      [polygonDrawPointId]: [...(prev[polygonDrawPointId] || []), draftPolygon],
    }))
    setPolygonDrawPointId(null)
    setDraftPolygon([])
  }, [draftPolygon, polygonDrawPointId])

  const undoDraftVertex = useCallback(() => {
    setDraftPolygon((prev) => prev.slice(0, -1))
  }, [])

  const explicitTargetFarm = useMemo(
    () =>
      targetFarmId
        ? dynamicFarmMarkers.find((marker) => marker.id === targetFarmId) ||
          mapMarkers.find((marker) => marker.id === targetFarmId) ||
          null
        : null,
    [dynamicFarmMarkers, mapMarkers, targetFarmId]
  )

  const resolvedTargetFarm = useMemo(() => {
    if (explicitTargetFarm) return explicitTargetFarm
    if (!isFarmCompanyContext) return null
    return dynamicFarmMarkers[0] || null
  }, [explicitTargetFarm, isFarmCompanyContext, dynamicFarmMarkers])

  const resolvedTargetZoom = resolvedTargetFarm ? targetZoom ?? DEFAULT_FARM_ZOOM : DEFAULT_ZOOM

  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut()
  }, [])

  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current) return
    const recenterLat = resolvedTargetFarm?.lat ?? QATAR_CENTER.lat
    const recenterLng = resolvedTargetFarm?.lng ?? QATAR_CENTER.lng
    const recenterZoom = resolvedTargetFarm ? resolvedTargetZoom : DEFAULT_ZOOM
    mapInstanceRef.current.flyTo([recenterLat, recenterLng], recenterZoom, { duration: 1.5 })
  }, [resolvedTargetFarm, resolvedTargetZoom])

  useEffect(() => {
    let cancelled = false
    async function loadFarms() {
      try {
        const response = await fetch('/api/operations/farms', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) return
        if (!cancelled) setFarmRows(Array.isArray(payload) ? (payload as FarmApiRow[]) : [])
      } catch {
        if (!cancelled) setFarmRows([])
      }
    }
    loadFarms()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let map: MapController | null = null
    const initMap = async () => {
      if (!mapRef.current) return
      if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        setIsLoading(false)
        setMapReady(true)
        return
      }

      const L = (await import('leaflet')).default as any
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L
      map = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map)
      map.on('zoomend', () => setCurrentZoom(map.getZoom()))
      mapInstanceRef.current = map
      setIsLoading(false)
      setMapReady(true)
    }

    initMap()
    return () => {
      markerInstancesRef.current.forEach((marker) => marker.remove?.())
      markerInstancesRef.current = []
      polygonInstancesRef.current.forEach((layer) => layer.remove?.())
      polygonInstancesRef.current = []
      draftPolylineRef.current?.remove?.()
      draftPolylineRef.current = null
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
      leafletRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    const createMarkerIcon = (type: MapMarker['type']) => {
      const colors = {
        farm: '#07f880',
        facility: '#3B82F6',
        sensor: '#F59E0B',
        custom: '#07f880',
      }
      const color = colors[type] || colors.farm
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 3px solid rgba(255,255,255,0.95);
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 16px ${color}50;
            cursor: pointer;
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }

    markerInstancesRef.current.forEach((marker) => marker.remove?.())
    markerInstancesRef.current = mapMarkers.map((marker) => {
      const customPoint = customPoints.find((point) => point.id === marker.id) || null
      const popupContent = customPoint
        ? `
            <div style="font-family: system-ui; padding: 8px; min-width: 190px;">
              <strong style="color: #07f880; font-size: 13px;">${escapeHtml(marker.label)}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${escapeHtml(
                POINT_TYPE_LABELS[marker.type]
              )}</span>
              <br/>
              <button
                data-edit-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  margin-right: 6px;
                  border: 1px solid rgba(7,248,128,0.35);
                  background: rgba(7,248,128,0.12);
                  color: #07f880;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Edit Point
              </button>
              <button
                data-draw-polygon-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  margin-right: 6px;
                  border: 1px solid rgba(59,130,246,0.4);
                  background: rgba(59,130,246,0.15);
                  color: #93c5fd;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Draw Polygon
              </button>
              <button
                data-delete-point-id="${customPoint.id}"
                style="
                  margin-top: 8px;
                  border: 1px solid rgba(239,68,68,0.45);
                  background: rgba(239,68,68,0.14);
                  color: #fca5a5;
                  border-radius: 6px;
                  padding: 4px 8px;
                  font-size: 11px;
                  cursor: pointer;
                "
              >
                Delete Point
              </button>
            </div>
          `
        : `
            <div style="font-family: system-ui; padding: 8px; min-width: 140px;">
              <strong style="color: #07f880; font-size: 13px;">${escapeHtml(marker.label)}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${escapeHtml(
                POINT_TYPE_LABELS[marker.type]
              )}</span>
            </div>
          `

      const markerInstance = L.marker([marker.lat, marker.lng], { icon: createMarkerIcon(marker.type) })
        .addTo(map)
        .bindPopup(popupContent, { className: 'custom-popup' })

      if (customPoint) {
        markerInstance.on('popupopen', (event: any) => {
          setActivePointId(customPoint.id)
          const popupElement = event?.popup?.getElement?.() as HTMLElement | null
          const editButton = popupElement?.querySelector(
            `[data-edit-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null
          const drawButton = popupElement?.querySelector(
            `[data-draw-polygon-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null
          const deleteButton = popupElement?.querySelector(
            `[data-delete-point-id="${customPoint.id}"]`
          ) as HTMLButtonElement | null

          if (editButton) {
            editButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              handleEditPoint(customPoint.id)
            }
          }
          if (drawButton) {
            drawButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              startPolygonDraw(customPoint.id)
            }
          }
          if (deleteButton) {
            deleteButton.onclick = (clickEvent) => {
              clickEvent.preventDefault()
              clickEvent.stopPropagation()
              handleDeletePoint(customPoint.id)
            }
          }
        })
        markerInstance.on('popupclose', () => {
          setActivePointId((prev) => (prev === customPoint.id ? null : prev))
          setPolygonDrawPointId((prev) => (prev === customPoint.id ? null : prev))
          setDraftPolygon((prev) => (prev.length > 0 ? [] : prev))
        })
      }

      return markerInstance
    })
  }, [customPoints, handleDeletePoint, handleEditPoint, mapMarkers, mapReady, startPolygonDraw])

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapInstanceRef.current

    polygonInstancesRef.current.forEach((layer) => layer.remove?.())
    polygonInstancesRef.current = []
    draftPolylineRef.current?.remove?.()
    draftPolylineRef.current = null

    if (activePointId) {
      const activePolygons = pointPolygons[activePointId] || []
      for (const vertices of activePolygons) {
        if (vertices.length < 3) continue
        const layer = L.polygon(vertices.map((v) => [v.lat, v.lng]), {
          color: '#07f880',
          weight: 2,
          opacity: 0.9,
          fillColor: '#07f880',
          fillOpacity: 0.16,
          interactive: false,
        }).addTo(map)
        polygonInstancesRef.current.push(layer)
      }
    }

    if (polygonDrawPointId && draftPolygon.length > 0 && polygonDrawPointId === activePointId) {
      draftPolylineRef.current = L.polyline(
        draftPolygon.map((v) => [v.lat, v.lng]),
        { color: '#3B82F6', weight: 2, dashArray: '6 6', opacity: 0.9, interactive: false }
      ).addTo(map)
    }
  }, [activePointId, draftPolygon, mapReady, pointPolygons, polygonDrawPointId])

  useEffect(() => {
    if (!isGrowaAdmin || !isAddPointMode || polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const pointLabelPrefix = locale === 'ar' ? 'نقطة' : POINT_TYPE_LABELS[newPointType]
      const label = `${pointLabelPrefix} ${customPoints.length + 1}`
      setCustomPoints((prev) => [
        ...prev,
        { id: `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`, lat, lng, label, pointType: newPointType },
      ])
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [customPoints.length, isAddPointMode, isGrowaAdmin, locale, mapReady, newPointType, polygonDrawPointId])

  useEffect(() => {
    if (!isGrowaAdmin || !polygonDrawPointId) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (event: any) => {
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      setDraftPolygon((prev) => [...prev, { lat, lng }])
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [isGrowaAdmin, mapReady, polygonDrawPointId])

  useEffect(() => {
    if (!mapInstanceRef.current || !resolvedTargetFarm) return
    mapInstanceRef.current.flyTo([resolvedTargetFarm.lat, resolvedTargetFarm.lng], resolvedTargetZoom, {
      duration: 1.2,
    })
  }, [resolvedTargetFarm, resolvedTargetZoom])

  return (
    <div className="absolute inset-0 pt-16">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
        {isGrowaAdmin && (
          <>
            <button
              onClick={() => {
                setIsAddPointMode((prev) => !prev)
                setPolygonDrawPointId(null)
                setDraftPolygon([])
              }}
              className={`h-10 px-3 flex items-center justify-center rounded-lg border transition-all shadow-lg text-xs font-medium ${
                isAddPointMode
                  ? 'bg-[#07f880]/20 border-[#07f880]/60 text-[#07f880]'
                  : 'bg-[#0c0c0e]/90 border-white/10 text-white/80 hover:border-[#07f880]/50 hover:text-[#07f880]'
              }`}
              title={isAddPointMode ? 'Click map to add points' : 'Enable add point mode'}
            >
              {isAddPointMode ? 'Add Point: ON' : 'Add Point'}
            </button>
            {isAddPointMode && !polygonDrawPointId && (
              <select
                value={newPointType}
                onChange={(event) => setNewPointType(event.target.value as MapPointType)}
                className="h-10 rounded-lg border border-white/10 bg-[#0c0c0e]/90 px-2 text-xs text-white shadow-lg focus:border-[#07f880]/60 focus:outline-none"
                title="Point type for new points"
              >
                {POINT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0c0c0e]">
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <button
          onClick={handleZoomIn}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom In"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={handleZoomOut}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom Out"
        >
          <Minus className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={handleRecenter}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Recenter on Qatar"
        >
          <Crosshair className="h-5 w-5 text-[#07f880]" />
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-[1000] rounded-lg border border-white/10 bg-[#0c0c0e]/90 px-3 py-1.5 shadow-lg">
        <div>
          <span className="text-xs text-white/60">Zoom: </span>
          <span className="text-xs font-medium text-[#07f880]">{currentZoom}</span>
        </div>
        {resolvedTargetFarm && (
          <div className="text-[11px] text-white/75">
            Focus: <span className="text-[#07f880]">{resolvedTargetFarm.label}</span>
          </div>
        )}
        {isGrowaAdmin && isAddPointMode && !polygonDrawPointId && (
          <div className="text-[11px] text-[#07f880]">
            Click on map to create a {POINT_TYPE_LABELS[newPointType].toLowerCase()} point.
          </div>
        )}
        {isGrowaAdmin && polygonDrawPointId && (
          <div className="mt-1 text-[11px] text-[#93c5fd]">
            Polygon mode: click map to add vertices for selected point.
          </div>
        )}
      </div>

      {isGrowaAdmin && polygonDrawPointId && (
        <div className="absolute left-6 top-24 z-[1000] w-72 rounded-lg border border-white/10 bg-[#0c0c0e]/90 p-3 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Polygon Draft</p>
          <p className="mt-1 text-[11px] text-white/60">
            Vertices: <span className="text-[#93c5fd]">{draftPolygon.length}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={undoDraftVertex}
              disabled={draftPolygon.length === 0}
              className="h-8 flex-1 rounded border border-white/15 bg-white/5 text-[11px] text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={cancelPolygonDraw}
              className="h-8 flex-1 rounded border border-white/15 bg-white/5 text-[11px] text-white/80"
            >
              Cancel
            </button>
            <button
              onClick={saveDraftPolygon}
              disabled={draftPolygon.length < 3}
              className="h-8 flex-1 rounded border border-[#07f880]/35 bg-[#07f880]/15 text-[11px] text-[#07f880] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#07f880]/20 border-t-[#07f880]" />
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png"
                alt="Growa"
                className="absolute inset-0 m-auto h-8 w-8"
              />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {locale === 'ar' ? 'جاري تحميل صور الأقمار الصناعية...' : 'Loading satellite imagery...'}
            </span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(12, 12, 14, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(12, 12, 14, 0.95);
        }
        .custom-popup .leaflet-popup-close-button {
          color: #888;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          color: #07f880;
        }
      `}</style>
    </div>
  )
}
