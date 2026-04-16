'use client'

import { useI18n } from '@/lib/i18n'
import { useSearchParams } from 'next/navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { ModuleWorkspace } from '@/components/dashboard/module-workspace'

export default function DashboardPage() {
  const { locale } = useI18n()
  const searchParams = useSearchParams()
  const module = searchParams.get('module')
  const targetFarmId = searchParams.get('farmId')
  const zoomParam = searchParams.get('zoom')
  const requestedZoom = zoomParam ? Number(zoomParam) : Number.NaN
  const targetZoom =
    Number.isFinite(requestedZoom) && requestedZoom >= 3 && requestedZoom <= 19
      ? requestedZoom
      : undefined

  const mapModules = new Set(['live-map', 'map', 'national-map', 'inspection-map'])

  if (!module || mapModules.has(module)) {
    return <SatelliteMap locale={locale} targetFarmId={targetFarmId} targetZoom={targetZoom} />
  }

  return <ModuleWorkspace moduleKey={module} />
}
