'use client'

import { useEffect, useRef, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut, Target, Layers } from 'lucide-react'

// Qatar center coordinates
const QATAR_CENTER = { lat: 25.3548, lng: 51.1839 }
const DEFAULT_ZOOM = 9

interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  type: 'farm' | 'facility' | 'sensor'
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
}

export function SatelliteMap({ locale = 'en' }: SatelliteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'hybrid'>('satellite')

  useEffect(() => {
    // Dynamic import of Leaflet to avoid SSR issues
    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // Initialize map
      const map = L.map(mapRef.current, {
        center: [QATAR_CENTER.lat, QATAR_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })

      // ESRI World Imagery (Satellite)
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
      )

      // ESRI Hybrid (Satellite + Labels)
      const hybridLayer = L.layerGroup([
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        ),
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        )
      ])

      satelliteLayer.addTo(map)

      // Custom marker icon
      const createMarkerIcon = (type: string) => {
        const colors = {
          farm: '#1FE169',
          facility: '#3B82F6',
          sensor: '#F59E0B'
        }
        const color = colors[type as keyof typeof colors] || colors.farm

        return L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: ${color};
              border: 3px solid rgba(255,255,255,0.9);
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      }

      // Add markers
      FARM_MARKERS.forEach((marker) => {
        L.marker([marker.lat, marker.lng], {
          icon: createMarkerIcon(marker.type)
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; padding: 4px;">
              <strong style="color: #1FE169;">${marker.label}</strong>
              <br/>
              <span style="font-size: 12px; color: #888;">Type: ${marker.type}</span>
            </div>
          `)
      })

      mapInstanceRef.current = map

      // Store layer references for switching
      ;(map as any)._satelliteLayer = satelliteLayer
      ;(map as any)._hybridLayer = hybridLayer

      setIsLoading(false)
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn()
  }

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut()
  }

  const handleRecenter = () => {
    mapInstanceRef.current?.setView([QATAR_CENTER.lat, QATAR_CENTER.lng], DEFAULT_ZOOM)
  }

  const handleToggleLayer = () => {
    const map = mapInstanceRef.current as any
    if (!map) return

    if (activeLayer === 'satellite') {
      map.removeLayer(map._satelliteLayer)
      map._hybridLayer.addTo(map)
      setActiveLayer('hybrid')
    } else {
      map.removeLayer(map._hybridLayer)
      map._satelliteLayer.addTo(map)
      setActiveLayer('satellite')
    }
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border bg-card">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full min-h-[400px]" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm text-muted-foreground">
              {locale === 'ar' ? 'جاري تحميل الخريطة...' : 'Loading satellite imagery...'}
            </span>
          </div>
        </div>
      )}

      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm">
              {locale === 'ar' ? 'خريطة الأقمار الصناعية' : 'Satellite Overview'}
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              {locale === 'ar' ? 'قطر - العمليات الزراعية' : 'Qatar - Agricultural Operations'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-xs pointer-events-auto">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {locale === 'ar' ? 'مزارع' : 'Farms'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {locale === 'ar' ? 'منشآت' : 'Facilities'}
            </span>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute top-20 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-lg bg-card/90 backdrop-blur border border-border hover:bg-secondary transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-lg bg-card/90 backdrop-blur border border-border hover:bg-secondary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={handleRecenter}
          className="p-2 rounded-lg bg-card/90 backdrop-blur border border-border hover:bg-secondary transition-colors"
          title="Recenter on Qatar"
        >
          <Target className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={handleToggleLayer}
          className="p-2 rounded-lg bg-card/90 backdrop-blur border border-border hover:bg-secondary transition-colors"
          title="Toggle Labels"
        >
          <Layers className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Active Layer Badge */}
      <div className="absolute bottom-4 left-4">
        <span className="px-2 py-1 rounded text-xs font-medium bg-card/90 backdrop-blur border border-border text-foreground">
          ESRI {activeLayer === 'satellite' ? 'Satellite' : 'Hybrid'}
        </span>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-4 right-4">
        <span className="text-[10px] text-white/50 bg-black/30 px-1.5 py-0.5 rounded">
          Imagery &copy; ESRI
        </span>
      </div>
    </div>
  )
}
