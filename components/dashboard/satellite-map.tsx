'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Plus, Minus, Crosshair } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useAuth } from '@/hooks/use-auth'

// Qatar center coordinates
const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 10
const DEFAULT_FARM_ZOOM = 17

interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: 'farm' | 'facility' | 'sensor' | 'custom'
}

interface FarmApiRow {
  id?: string
  name_en?: string
  name_ar?: string
  name?: string
  location?: string | null
}

// Sample farm locations in Qatar
const FARM_MARKERS: MapMarker[] = [
  { id: '1', lat: 25.6842, lng: 51.4975, label: 'Al Khor Date Farm', type: 'farm' },
  { id: '2', lat: 25.4107, lng: 51.2215, label: 'Umm Salal Greenhouse', type: 'farm' },
  { id: '3', lat: 25.1725, lng: 51.4190, label: 'Al Shahaniya Livestock', type: 'farm' },
  { id: '4', lat: 24.9940, lng: 51.5505, label: 'Mesaieed Aquaculture', type: 'facility' },
  { id: '5', lat: 25.1700, lng: 51.6101, label: 'Al Wakra Poultry', type: 'farm' },
]

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
  on: (event: string, handler: () => void) => void
  off: (event: string, handler: (...args: any[]) => void) => void
  remove: () => void
}

interface CustomPoint {
  id: string
  lat: number
  lng: number
  label: string
}

function hashToRange(input: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  const normalized = hash / 100000
  return min + normalized * (max - min)
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

export function SatelliteMap({
  locale = 'en',
  targetFarmId = null,
  targetZoom,
}: SatelliteMapProps) {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapController | null>(null)
  const leafletRef = useRef<any>(null)
  const markerInstancesRef = useRef<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
  const [farmRows, setFarmRows] = useState<FarmApiRow[]>([])
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([])
  const [isAddPointMode, setIsAddPointMode] = useState(false)

  const organizationType = (
    organization?.organization_type ||
    organization?.type ||
    ''
  )
    .toString()
    .toLowerCase()
  const isFarmCompanyContext = organizationType === 'farm_company'
  const isGrowaAdmin = Boolean(user?.email?.toLowerCase().endsWith('@growa.ai'))

  const customPointsStorageKey = useMemo(
    () => `growa-custom-map-points:${user?.id || 'anonymous'}`,
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
          if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return {
            id,
            lat,
            lng,
            label: label.trim() || 'Custom Point',
          } satisfies CustomPoint
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

  const dynamicFarmMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = []
    for (const farm of farmRows) {
      if (!farm.id) continue
      const coordinates = estimateFarmCoordinates(farm.id, farm.location || null)
      const label =
        (locale === 'ar' && farm.name_ar) ||
        farm.name_en ||
        farm.name ||
        `Farm ${farm.id.slice(0, 8)}`
      markers.push({
        id: farm.id,
        lat: coordinates.lat,
        lng: coordinates.lng,
        label,
        type: 'farm',
      })
    }
    return markers
  }, [farmRows, locale])

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const baseline = dynamicFarmMarkers.length > 0 ? dynamicFarmMarkers : FARM_MARKERS
    const custom = customPoints.map((point) => ({
      id: point.id,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
      type: 'custom' as const,
    }))
    return [...baseline, ...custom]
  }, [customPoints, dynamicFarmMarkers])

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

  const resolvedTargetZoom = resolvedTargetFarm
    ? targetZoom ?? DEFAULT_FARM_ZOOM
    : DEFAULT_ZOOM

  const handleZoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn()
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut()
    }
  }, [])

  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      const recenterLat = resolvedTargetFarm?.lat ?? QATAR_CENTER.lat
      const recenterLng = resolvedTargetFarm?.lng ?? QATAR_CENTER.lng
      const recenterZoom = resolvedTargetFarm ? resolvedTargetZoom : DEFAULT_ZOOM
      mapInstanceRef.current.flyTo([recenterLat, recenterLng], recenterZoom, {
        duration: 1.5
      })
    }
  }, [resolvedTargetFarm, resolvedTargetZoom])

  useEffect(() => {
    let cancelled = false

    async function loadFarms() {
      try {
        const response = await fetch('/api/operations/farms', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) return
        if (!cancelled) {
          setFarmRows(Array.isArray(payload) ? (payload as FarmApiRow[]) : [])
        }
      } catch {
        if (!cancelled) {
          setFarmRows([])
        }
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
      
      // Check if already initialized by Leaflet (has _leaflet_id on the container)
      if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        setIsLoading(false)
        setMapReady(true)
        return
      }

      const L = (await import('leaflet')).default as any
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L

      // Initialize map
      map = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })

      // ESRI World Imagery (Satellite)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map)

      // Track zoom level
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom())
      })

      mapInstanceRef.current = map
      setIsLoading(false)
      setMapReady(true)
    }

    initMap()

    return () => {
      markerInstancesRef.current.forEach((marker) => marker.remove?.())
      markerInstancesRef.current = []
      // Cleanup on unmount - properly remove map
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
    markerInstancesRef.current = mapMarkers.map((marker) =>
      L.marker([marker.lat, marker.lng], {
        icon: createMarkerIcon(marker.type),
      })
        .addTo(map)
        .bindPopup(
          `
            <div style="font-family: system-ui; padding: 8px; min-width: 140px;">
              <strong style="color: #07f880; font-size: 13px;">${marker.label}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${marker.type}</span>
            </div>
          `,
          {
            className: 'custom-popup',
          }
        )
    )
  }, [mapMarkers, mapReady])

  useEffect(() => {
    if (!isGrowaAdmin || !isAddPointMode) return
    if (!mapReady || !mapInstanceRef.current) return
    const map = mapInstanceRef.current as unknown as {
      on: (event: string, handler: (...args: any[]) => void) => void
      off: (event: string, handler: (...args: any[]) => void) => void
    }

    const handleMapClick = (event: any) => {
      const lat = Number(event?.latlng?.lat)
      const lng = Number(event?.latlng?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const suggested = `${locale === 'ar' ? 'نقطة جديدة' : 'Custom Point'} ${customPoints.length + 1}`
      const labelInput = window.prompt(
        locale === 'ar' ? 'اسم النقطة الجديدة' : 'Name for the new map point',
        suggested
      )
      if (labelInput === null) return
      const label = labelInput.trim() || suggested

      setCustomPoints((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          lat,
          lng,
          label,
        },
      ])
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [customPoints.length, isAddPointMode, isGrowaAdmin, locale, mapReady])

  useEffect(() => {
    if (!mapInstanceRef.current) return
    if (!resolvedTargetFarm) return
    mapInstanceRef.current.flyTo(
      [resolvedTargetFarm.lat, resolvedTargetFarm.lng],
      resolvedTargetZoom,
      { duration: 1.2 }
    )
  }, [resolvedTargetFarm, resolvedTargetZoom])

  return (
    <div className="absolute inset-0 pt-16"> {/* pt-16 to account for header */}
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Map Controls - Bottom Right, ALWAYS Visible */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
        {isGrowaAdmin && (
          <button
            onClick={() => setIsAddPointMode((prev) => !prev)}
            className={`h-10 px-3 flex items-center justify-center rounded-lg border transition-all shadow-lg text-xs font-medium ${
              isAddPointMode
                ? 'bg-[#07f880]/20 border-[#07f880]/60 text-[#07f880]'
                : 'bg-[#0c0c0e]/90 border-white/10 text-white/80 hover:border-[#07f880]/50 hover:text-[#07f880]'
            }`}
            title={isAddPointMode ? 'Click map to add points' : 'Enable add point mode'}
          >
            {isAddPointMode ? 'Add Point: ON' : 'Add Point'}
          </button>
        )}
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom In"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Zoom Out"
        >
          <Minus className="h-5 w-5 text-white" />
        </button>

        {/* Recenter on Qatar */}
        <button
          onClick={handleRecenter}
          className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07f880]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
          title="Recenter on Qatar"
        >
          <Crosshair className="h-5 w-5 text-[#07f880]" />
        </button>
      </div>

      {/* Zoom Level Indicator - Bottom Left, ALWAYS Visible */}
      <div className="absolute bottom-6 left-6 z-[1000] rounded-lg border border-white/10 bg-[#0c0c0e]/90 px-3 py-1.5 shadow-lg">
        <div>
          <span className="text-xs text-white/60">Zoom: </span>
          <span className="text-xs text-[#07f880] font-medium">{currentZoom}</span>
        </div>
        {resolvedTargetFarm && (
          <div className="text-[11px] text-white/75">
            Focus: <span className="text-[#07f880]">{resolvedTargetFarm.label}</span>
          </div>
        )}
        {isGrowaAdmin && isAddPointMode && (
          <div className="text-[11px] text-[#07f880]">
            Click on map to create a point.
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-[#07f880]/20 border-t-[#07f880] animate-spin" />
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
                alt="Growa" 
                className="absolute inset-0 m-auto h-8 w-8"
              />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {locale === 'ar' ? 'جاري تحميل صور الأقمار الصناعية...' : 'Loading satellite imagery...'}
            </span>
          </div>
        </div>
      )}

      {/* Custom Popup Styles */}
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
