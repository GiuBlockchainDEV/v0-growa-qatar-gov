'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useRouter, useSearchParams } from 'next/navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { ModuleWorkspace } from '@/components/dashboard/module-workspace'
import { RssFeedWorkspace } from '@/components/dashboard/rss-feed-workspace'
import { DataAnalyticsWorkspace } from '@/components/dashboard/data-analytics-workspace'
import { WaterIntelligenceWorkspace } from '@/components/dashboard/water-intelligence-workspace'
import { EnergyIntelligenceWorkspace } from '@/components/dashboard/energy-intelligence-workspace'
import { WeatherWorkspace } from '@/components/dashboard/weather-workspace'
import { HarvestWorkspace } from '@/components/dashboard/harvest-workspace'
import { HarvestDashboardProvider, useHarvestDashboardOptional } from '@/contexts/harvest-dashboard-context'
import { buildWeatherDashboardParams } from '@/lib/dashboard/weather-url'
import {
  generateQatarWeatherGrid,
  generateQatarWeatherGridLines,
  getQatarBoundaryCoordinates,
} from '@/lib/weather/qatar-grid'
import type { HarvestRasterOverlay } from '@/lib/harvest/types'
import { extractBoundsFromGeoJson, type LatLngVertex } from '@/lib/harvest/geojson'

function SlideFromLeftWorkspace({
  children,
  locale,
  moduleKey,
  targetPointId,
  targetFocusToken,
  targetZoom,
  targetCropFilter,
}: {
  children: React.ReactNode
  locale: string
  moduleKey: string
  targetPointId: string | null
  targetFocusToken: string | null
  targetZoom?: number
  targetCropFilter: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const weatherGridPoints = useMemo(
    () =>
      moduleKey === 'weather'
        ? generateQatarWeatherGrid().map((cell) => ({
            id: cell.id,
            lat: cell.latitude,
            lng: cell.longitude,
            north: cell.north,
            south: cell.south,
            east: cell.east,
            west: cell.west,
          }))
        : [],
    [moduleKey]
  )
  const selectedWeatherGridPointId = useMemo(() => {
    if (moduleKey !== 'weather') return null
    const explicitId = searchParams.get('weatherGridId')
    if (explicitId) return explicitId
    const lat = Number(searchParams.get('weatherLat'))
    const lng = Number(searchParams.get('weatherLng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || weatherGridPoints.length === 0) return null
    return weatherGridPoints.reduce((closest, point) => {
      const closestDistance = Math.hypot(closest.lat - lat, closest.lng - lng)
      const pointDistance = Math.hypot(point.lat - lat, point.lng - lng)
      return pointDistance < closestDistance ? point : closest
    }, weatherGridPoints[0]).id
  }, [moduleKey, searchParams, weatherGridPoints])
  const weatherGridLines = useMemo(
    () => (moduleKey === 'weather' ? generateQatarWeatherGridLines() : []),
    [moduleKey]
  )
  const weatherBoundary = useMemo(
    () =>
      moduleKey === 'weather' || moduleKey === 'harvest' || moduleKey === 'production-harvest'
        ? getQatarBoundaryCoordinates()
        : [],
    [moduleKey]
  )
  const harvestMode = searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
  const selectedHarvestParcelId = searchParams.get('parcelId')
  const harvestCreateActive = searchParams.get('harvestCreate') === '1'
  const harvestDrawMethodFromUrl = searchParams.get('harvestDraw') === 'circle' ? 'circle' : 'vertex'
  const [harvestDrawMethod, setHarvestDrawMethod] = useState<'vertex' | 'circle'>(harvestDrawMethodFromUrl)
  const harvestDashboard = useHarvestDashboardOptional()
  const [harvestTileUrl, setHarvestTileUrl] = useState<string | null>(null)
  const [harvestRasterOverlay, setHarvestRasterOverlay] = useState<HarvestRasterOverlay | null>(null)
  const [harvestFocusBounds, setHarvestFocusBounds] = useState<[[number, number], [number, number]] | null>(
    null
  )
  const [harvestFieldRings, setHarvestFieldRings] = useState<LatLngVertex[][]>([])
  const [harvestFieldDraftVertices, setHarvestFieldDraftVertices] = useState<LatLngVertex[]>([])
  const startsWithLateralPanel =
    moduleKey === 'weather' || moduleKey === 'harvest' || moduleKey === 'production-harvest'
  const [panelVisible, setPanelVisible] = useState(startsWithLateralPanel)

  const isHarvestModule = moduleKey === 'harvest' || moduleKey === 'production-harvest'

  useEffect(() => {
    setHarvestDrawMethod(harvestDrawMethodFromUrl)
  }, [harvestDrawMethodFromUrl])

  useEffect(() => {
    const handleDrawMethodChange = (event: Event) => {
      const method = (event as CustomEvent<{ method: 'vertex' | 'circle' }>).detail?.method
      if (method === 'circle' || method === 'vertex') {
        setHarvestDrawMethod(method)
      }
    }
    window.addEventListener('harvest:field-draw-method-change', handleDrawMethodChange)
    return () => window.removeEventListener('harvest:field-draw-method-change', handleDrawMethodChange)
  }, [])

  useEffect(() => {
    if (!harvestCreateActive) {
      setHarvestFieldRings([])
      setHarvestFieldDraftVertices([])
      return
    }
    setHarvestRasterOverlay(null)
    setHarvestFocusBounds(null)
  }, [harvestCreateActive])

  useEffect(() => {
    if (!isHarvestModule) return
    window.dispatchEvent(
      new CustomEvent('harvest:field-draw-update', {
        detail: {
          rings: harvestFieldRings,
          draft: harvestFieldDraftVertices,
        },
      })
    )
  }, [harvestFieldDraftVertices, harvestFieldRings, isHarvestModule])

  useEffect(() => {
    const handleClearDraw = () => {
      setHarvestFieldRings([])
      setHarvestFieldDraftVertices([])
    }
    const handleClearDraft = () => {
      setHarvestFieldDraftVertices([])
    }
    const handleFinishPolygon = () => {
      setHarvestFieldDraftVertices((draft) => {
        if (draft.length < 3) return draft
        setHarvestFieldRings((current) => [...current, draft])
        return []
      })
    }
    window.addEventListener('harvest:field-draw-clear', handleClearDraw)
    window.addEventListener('harvest:field-draw-clear-draft', handleClearDraft)
    window.addEventListener('harvest:field-draw-finish-polygon', handleFinishPolygon)
    return () => {
      window.removeEventListener('harvest:field-draw-clear', handleClearDraw)
      window.removeEventListener('harvest:field-draw-clear-draft', handleClearDraft)
      window.removeEventListener('harvest:field-draw-finish-polygon', handleFinishPolygon)
    }
  }, [])

  useEffect(() => {
    const handleRasterOverlay = (event: Event) => {
      const detail = (event as CustomEvent<HarvestRasterOverlay | null>).detail ?? null
      setHarvestRasterOverlay(detail)
    }
    window.addEventListener('harvest:raster-overlay', handleRasterOverlay)
    return () => {
      window.removeEventListener('harvest:raster-overlay', handleRasterOverlay)
      setHarvestRasterOverlay(null)
    }
  }, [])

  useEffect(() => {
    if (!isHarvestModule) {
      setHarvestTileUrl(null)
      return
    }

    let cancelled = false

    const loadHarvestTile = async () => {
      try {
        const tileResponse = await fetch('/api/harvest/map/tile-url', { cache: 'no-store' })
        if (cancelled) return

        if (tileResponse.ok) {
          const tilePayload = await tileResponse.json()
          setHarvestTileUrl(typeof tilePayload?.url === 'string' ? tilePayload.url : null)
        } else {
          setHarvestTileUrl(null)
        }
      } catch {
        if (!cancelled) setHarvestTileUrl(null)
      }
    }

    void loadHarvestTile()

    return () => {
      cancelled = true
    }
  }, [isHarvestModule])

  const harvestFields = harvestDashboard?.mapFields ?? []

  useEffect(() => {
    if (!isHarvestModule || !selectedHarvestParcelId) {
      setHarvestFocusBounds(null)
      return
    }

    const selectedField = harvestFields.find((field) => field.parcel_id === selectedHarvestParcelId)
    if (selectedField) {
      const vertices = selectedField.rings.flat()
      if (vertices.length >= 3) {
        const lats = vertices.map((vertex) => vertex.lat)
        const lngs = vertices.map((vertex) => vertex.lng)
        setHarvestFocusBounds([
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ])
        return
      }

      const { lat, lng } = selectedField.centroid
      setHarvestFocusBounds([[lat - 0.008, lng - 0.01], [lat + 0.008, lng + 0.01]])
      return
    }

    let cancelled = false

    const loadParcelBounds = async () => {
      try {
        const response = await fetch(`/api/harvest/parcel/${selectedHarvestParcelId}`, { cache: 'no-store' })
        if (!response.ok || cancelled) return
        const payload = await response.json()
        const bounds = extractBoundsFromGeoJson(payload?.geojson)
        if (bounds && !cancelled) {
          setHarvestFocusBounds(bounds)
        }
      } catch {
        if (!cancelled) setHarvestFocusBounds(null)
      }
    }

    void loadParcelBounds()

    return () => {
      cancelled = true
    }
  }, [harvestFields, isHarvestModule, selectedHarvestParcelId])

  useEffect(() => {
    if (startsWithLateralPanel) return
    const frame = window.requestAnimationFrame(() => setPanelVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [startsWithLateralPanel])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className={`absolute inset-0 z-0 transition-[left] duration-300 ease-out ${
          panelVisible ? 'left-3/4' : 'left-0'
        }`}
      >
        <SatelliteMap
          locale={locale}
          targetPointId={targetPointId}
          targetFocusToken={targetFocusToken}
          targetZoom={targetZoom}
          targetCropFilter={targetCropFilter}
          isLateralMode
          lateralPanelOpen={panelVisible}
          onMapClick={undefined}
          weatherGridPoints={weatherGridPoints}
          selectedWeatherGridPointId={selectedWeatherGridPointId}
          weatherGridLines={isHarvestModule ? [] : weatherGridLines}
          weatherBoundary={weatherBoundary}
          harvestFields={isHarvestModule ? harvestFields : []}
          selectedHarvestParcelId={
            isHarvestModule && !harvestCreateActive ? selectedHarvestParcelId : null
          }
          mapTileUrl={isHarvestModule ? harvestTileUrl : null}
          harvestRasterOverlay={
            isHarvestModule && !harvestCreateActive && harvestRasterOverlay
              ? {
                  imageUrl: harvestRasterOverlay.imageUrl,
                  bounds: harvestRasterOverlay.bounds,
                  opacity: harvestRasterOverlay.opacity,
                }
              : null
          }
          harvestFocusBounds={isHarvestModule && !harvestCreateActive ? harvestFocusBounds : null}
          harvestFieldDrawActive={isHarvestModule && harvestCreateActive}
          harvestFieldDrawMethod={harvestDrawMethod}
          harvestFieldRings={harvestFieldRings}
          harvestFieldVertices={harvestFieldDraftVertices}
          onHarvestFieldRingsChange={setHarvestFieldRings}
          onHarvestFieldVerticesChange={setHarvestFieldDraftVertices}
          onHarvestFieldClick={
            isHarvestModule && harvestDashboard && !harvestCreateActive
              ? (field) => harvestDashboard.selectField(field)
              : undefined
          }
          onWeatherGridPointClick={
            moduleKey === 'weather'
              ? (point) => {
                  const lat = Number(point.lat)
                  const lng = Number(point.lng)
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
                  const params = buildWeatherDashboardParams(searchParams, {
                    lat,
                    lng,
                    gridId: point.id,
                    zoom: targetZoom ?? 10,
                    requestedAt: searchParams.get('weatherRequestedAt'),
                  })
                  window.dispatchEvent(
                    new CustomEvent('weather:grid-select', {
                      detail: {
                        gridId: point.id,
                        lat,
                        lng,
                        requestedAt: searchParams.get('weatherRequestedAt'),
                      },
                    })
                  )
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false })
                }
              : undefined
          }
        />
      </div>

      {moduleKey !== 'weather' && moduleKey !== 'harvest' && moduleKey !== 'production-harvest' && (
        <button
          type="button"
          aria-label="Return to live map"
          className="absolute inset-y-16 left-[75%] z-[1700] w-[10%] bg-transparent"
          onClick={() => router.push('/dashboard?module=live-map&zoom=10')}
        />
      )}

      <div
        className={`pointer-events-auto absolute bottom-0 left-0 top-16 z-[1800] w-3/4 transform transition-transform duration-300 ease-out ${
          panelVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative z-[1] flex h-full min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#070a10]/95 backdrop-blur-md shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { locale } = useI18n()
  const searchParams = useSearchParams()
  const moduleKey = searchParams.get('module')
  const targetPointId = searchParams.get('pointId')
  const targetFocusToken = searchParams.get('focus')
  const targetCropFilter = searchParams.get('crop')
  const zoomParam = searchParams.get('zoom')
  const requestedZoom = zoomParam ? Number(zoomParam) : Number.NaN
  const targetZoom =
    Number.isFinite(requestedZoom) && requestedZoom >= 3 && requestedZoom <= 19
      ? requestedZoom
      : undefined

  const mapModules = new Set(['live-map', 'map', 'national-map', 'inspection-map'])

  if (!moduleKey || mapModules.has(moduleKey)) {
    return (
      <SatelliteMap
        locale={locale}
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      />
    )
  }

  if (moduleKey === 'rss-feed') {
    return (
      <SlideFromLeftWorkspace
        key="rss-feed-panel"
        locale={locale}
        moduleKey="rss-feed"
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      >
        <RssFeedWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  if (moduleKey === 'data-analytics') {
    return (
      <SlideFromLeftWorkspace
        key="data-analytics-panel"
        locale={locale}
        moduleKey="data-analytics"
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      >
        <DataAnalyticsWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  if (moduleKey === 'water-intelligence') {
    return (
      <SlideFromLeftWorkspace
        key="water-intelligence-panel"
        locale={locale}
        moduleKey="water-intelligence"
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      >
        <WaterIntelligenceWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  if (moduleKey === 'energy-intelligence') {
    return (
      <SlideFromLeftWorkspace
        key="energy-intelligence-panel"
        locale={locale}
        moduleKey="energy-intelligence"
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      >
        <EnergyIntelligenceWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  if (moduleKey === 'weather') {
    return (
      <SlideFromLeftWorkspace
        key="weather-panel"
        locale={locale}
        moduleKey="weather"
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
        targetCropFilter={targetCropFilter}
      >
        <WeatherWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  if (moduleKey === 'harvest' || moduleKey === 'production-harvest') {
    return (
      <HarvestDashboardProvider>
        <SlideFromLeftWorkspace
          key="harvest-panel"
          locale={locale}
          moduleKey="harvest"
          targetPointId={targetPointId}
          targetFocusToken={targetFocusToken}
          targetZoom={targetZoom}
          targetCropFilter={targetCropFilter}
        >
          <HarvestWorkspace />
        </SlideFromLeftWorkspace>
      </HarvestDashboardProvider>
    )
  }

  return <ModuleWorkspace moduleKey={moduleKey} />
}
