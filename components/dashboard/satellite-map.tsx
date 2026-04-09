'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Minus, Crosshair, Layers } from 'lucide-react'

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
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)

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
      mapInstanceRef.current.flyTo([QATAR_CENTER.lat, QATAR_CENTER.lng], DEFAULT_ZOOM, {
        duration: 1.5
      })
    }
  }, [])

  useEffect(() => {
    let map: L.Map | null = null
    
    const initMap = async () => {
      if (!mapRef.current) return
      
      // Check if already initialized by Leaflet (has _leaflet_id on the container)
      if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        console.log('[v0] Map already initialized, skipping')
        return
      }

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

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

      // Custom marker icon
      const createMarkerIcon = (type: string) => {
        const colors = {
          farm: '#07fc82',
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

      // Add markers
      FARM_MARKERS.forEach((marker) => {
        L.marker([marker.lat, marker.lng], {
          icon: createMarkerIcon(marker.type)
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; padding: 8px; min-width: 140px;">
              <strong style="color: #07fc82; font-size: 13px;">${marker.label}</strong>
              <br/>
              <span style="font-size: 10px; color: #888; text-transform: uppercase;">Type: ${marker.type}</span>
            </div>
          `, {
            className: 'custom-popup'
          })
      })

      mapInstanceRef.current = map
      setIsLoading(false)
    }

    initMap()

    return () => {
      // Cleanup on unmount - properly remove map
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="absolute inset-0 pt-16"> {/* pt-16 to account for header */}
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Map Controls - Bottom Right, Always Visible */}
      {!isLoading && (
        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07fc82]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
            title="Zoom In"
          >
            <Plus className="h-5 w-5 text-white" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07fc82]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
            title="Zoom Out"
          >
            <Minus className="h-5 w-5 text-white" />
          </button>

          {/* Recenter on Qatar */}
          <button
            onClick={handleRecenter}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#0c0c0e]/90 border border-white/10 hover:border-[#07fc82]/50 hover:bg-[#0c0c0e] transition-all shadow-lg"
            title="Recenter on Qatar"
          >
            <Crosshair className="h-5 w-5 text-[#07fc82]" />
          </button>
        </div>
      )}

      {/* Zoom Level Indicator - Bottom Left */}
      {!isLoading && (
        <div className="absolute bottom-6 left-6 z-30 px-3 py-1.5 rounded-lg bg-[#0c0c0e]/90 border border-white/10 shadow-lg">
          <span className="text-xs text-white/60">Zoom: </span>
          <span className="text-xs text-[#07fc82] font-medium">{currentZoom}</span>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-[#07fc82]/20 border-t-[#07fc82] animate-spin" />
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
          color: #07fc82;
        }
      `}</style>
    </div>
  )
}
