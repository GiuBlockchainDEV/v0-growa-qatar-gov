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
import { generateQatarWeatherGrid } from '@/lib/weather/qatar-grid'

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
  const [panelVisible, setPanelVisible] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPanelVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className={`absolute inset-0 transform transition-transform duration-300 ease-out ${
          panelVisible ? 'translate-x-[37.5%]' : 'translate-x-0'
        }`}
      >
        <SatelliteMap
          locale={locale}
          targetPointId={targetPointId}
          targetFocusToken={targetFocusToken}
          targetZoom={targetZoom}
          targetCropFilter={targetCropFilter}
          isLateralMode
          onMapClick={
            moduleKey === 'weather'
              ? ({ lat, lng }) => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('module', 'weather')
                  params.set('weatherLat', lat.toFixed(6))
                  params.set('weatherLng', lng.toFixed(6))
                  params.delete('weatherGridId')
                  params.set('zoom', String(targetZoom ?? 10))
                  params.set('focus', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
                  router.push(`/dashboard?${params.toString()}`)
                }
              : undefined
          }
          weatherGridPoints={weatherGridPoints}
          selectedWeatherGridPointId={selectedWeatherGridPointId}
          onWeatherGridPointClick={
            moduleKey === 'weather'
              ? (point) => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('module', 'weather')
                  params.set('weatherGridId', point.id)
                  params.set('weatherLat', point.lat.toFixed(6))
                  params.set('weatherLng', point.lng.toFixed(6))
                  params.set('zoom', String(targetZoom ?? 10))
                  params.set('focus', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
                  router.push(`/dashboard?${params.toString()}`)
                }
              : undefined
          }
        />
      </div>

      <button
        type="button"
        aria-label="Return to live map"
        className="absolute inset-y-16 left-[75%] z-[1700] w-[10%] bg-transparent"
        onClick={() => router.push('/dashboard?module=live-map&zoom=10')}
      />

      <div
        className={`absolute bottom-0 left-0 top-16 z-[1800] w-3/4 transform transition-transform duration-300 ease-out ${
          panelVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto border-r border-white/10 bg-[#070a10]/95 backdrop-blur-md shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { locale } = useI18n()
  const searchParams = useSearchParams()
  const module = searchParams.get('module')
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

  if (!module || mapModules.has(module)) {
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

  if (module === 'rss-feed') {
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

  if (module === 'data-analytics') {
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

  if (module === 'water-intelligence') {
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

  if (module === 'energy-intelligence') {
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

  if (module === 'weather') {
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

  return <ModuleWorkspace moduleKey={module} />
}
