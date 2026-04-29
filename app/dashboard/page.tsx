'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useRouter, useSearchParams } from 'next/navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { ModuleWorkspace } from '@/components/dashboard/module-workspace'
import { RssFeedWorkspace } from '@/components/dashboard/rss-feed-workspace'
import { DataAnalyticsWorkspace } from '@/components/dashboard/data-analytics-workspace'

function SlideFromLeftWorkspace({
  children,
  locale,
  targetFarmId,
  targetPointId,
  targetFocusToken,
  targetZoom,
}: {
  children: React.ReactNode
  locale: string
  targetFarmId: string | null
  targetPointId: string | null
  targetFocusToken: string | null
  targetZoom?: number
}) {
  const router = useRouter()
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
          targetFarmId={targetFarmId}
          targetPointId={targetPointId}
          targetFocusToken={targetFocusToken}
          targetZoom={targetZoom}
        />
      </div>

      <button
        type="button"
        aria-label="Return to live map"
        className="absolute bottom-0 right-0 top-16 z-[1700] w-1/4 bg-transparent"
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
  const targetFarmId = searchParams.get('farmId')
  const targetPointId = searchParams.get('pointId')
  const targetFocusToken = searchParams.get('focus')
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
        targetFarmId={targetFarmId}
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
      />
    )
  }

  if (module === 'rss-feed') {
    return (
      <SlideFromLeftWorkspace
        key="rss-feed-panel"
        locale={locale}
        targetFarmId={targetFarmId}
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
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
        targetFarmId={targetFarmId}
        targetPointId={targetPointId}
        targetFocusToken={targetFocusToken}
        targetZoom={targetZoom}
      >
        <DataAnalyticsWorkspace />
      </SlideFromLeftWorkspace>
    )
  }

  return <ModuleWorkspace moduleKey={module} />
}
