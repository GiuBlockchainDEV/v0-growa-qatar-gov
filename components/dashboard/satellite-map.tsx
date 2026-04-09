'use client'

import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Target, Layers, Compass } from 'lucide-react'

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
  fullscreen?: boolean
}

export function SatelliteMap({ locale = 'en', fullscreen = false }: SatelliteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'hybrid'>('satellite')
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)

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
          attribution: '&copy; Esri'
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
              width: 28px;
              height: 28px;
              background: ${color};
              border: 3px solid rgba(255,255,255,0.95);
              border-radius: 50%;
              box-shadow: 0 2px 12px rgba(0,0,0,0.5), 0 0 20px ${color}40;
              cursor: pointer;
            "></div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
      }

      // Add markers
      FARM_MARKERS.forEach((marker) => {
        L.marker([marker.lat, marker.lng], {
          icon: createMarkerIcon(marker.type)
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; padding: 8px; min-width: 150px;">
              <strong style="color: #1FE169; font-size: 14px;">${marker.label}</strong>
              <br/>
              <span style="font-size: 11px; color: #888; text-transform: uppercase;">Type: ${marker.type}</span>
              <br/>
              <span style="font-size: 10px; color: #666;">Lat: ${marker.lat.toFixed(4)}, Lng: ${marker.lng.toFixed(4)}</span>
            </div>
          `, {
            className: 'custom-popup'
          })
      })

      // Track zoom changes
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom())
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
    mapInstanceRef.current?.setView([QATAR_CENTER.lat, QATAR_CENTER.lng], DEFAULT_ZOOM, {
      animate: true,
      duration: 0.5
    })
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

  const containerClass = fullscreen 
    ? 'absolute inset-0' 
    : 'relative w-full h-full rounded-lg overflow-hidden border border-border'

  return (
    <div className={containerClass}>
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
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

      {/* Map Controls - Always Visible, Right Side */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        {/* Zoom Controls */}
        <div className="flex flex-col rounded-lg overflow-hidden border border-border shadow-lg">
          <button
            onClick={handleZoomIn}
            className="p-3 bg-card/95 backdrop-blur-md hover:bg-secondary transition-colors border-b border-border"
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5 text-foreground" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 bg-card/95 backdrop-blur-md hover:bg-secondary transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="p-3 rounded-lg bg-card/95 backdrop-blur-md border border-border hover:bg-secondary hover:border-primary/50 transition-all shadow-lg group"
          title="Recenter on Qatar"
        >
          <Target className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Layer Toggle */}
        <button
          onClick={handleToggleLayer}
          className={`p-3 rounded-lg backdrop-blur-md border transition-all shadow-lg ${
            activeLayer === 'hybrid' 
              ? 'bg-primary/20 border-primary text-primary' 
              : 'bg-card/95 border-border text-foreground hover:bg-secondary'
          }`}
          title="Toggle Labels"
        >
          <Layers className="h-5 w-5" />
        </button>

        {/* Compass */}
        <div className="p-3 rounded-lg bg-card/95 backdrop-blur-md border border-border shadow-lg flex items-center justify-center">
          <Compass className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Map Header - Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
            alt="Growa" 
            className="h-5 w-5"
          />
          <span className="text-sm font-semibold text-foreground">
            {locale === 'ar' ? 'قطر - العمليات الزراعية' : 'Qatar Agricultural Operations'}
          </span>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground font-mono">
            Zoom: {currentZoom}
          </span>
        </div>
      </div>

      {/* Legend - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="flex flex-col gap-2 px-3 py-2 rounded-lg bg-card/90 backdrop-blur-md border border-border shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#1FE169] shadow-[0_0_8px_#1FE16980]" />
            <span className="text-xs text-foreground">{locale === 'ar' ? 'مزارع' : 'Farms'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F680]" />
            <span className="text-xs text-foreground">{locale === 'ar' ? 'منشآت' : 'Facilities'}</span>
          </div>
        </div>
      </div>

      {/* Layer Badge - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-card/80 backdrop-blur-md border border-border text-muted-foreground">
          ESRI World Imagery {activeLayer === 'hybrid' ? '+ Labels' : ''}
        </span>
      </div>

      {/* Coordinates Display */}
      <div className="absolute bottom-14 right-4 z-10">
        <span className="px-2 py-1 rounded text-[10px] font-mono bg-black/50 text-white/70">
          {QATAR_CENTER.lat.toFixed(4)}°N, {QATAR_CENTER.lng.toFixed(4)}°E
        </span>
      </div>

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
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .custom-popup .leaflet-popup-close-button {
          color: #888;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          color: #1FE169;
        }
      `}</style>
    </div>
  )
}
