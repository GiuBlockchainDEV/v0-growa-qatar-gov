'use client'

/*
 * One screen of the dashboard is visible at a time, but every workspace used
 * to be imported statically into /dashboard: a single 434 KB chunk (120 KB
 * gzipped) with all fourteen modules, the map and the markdown renderer.
 * Each module is now its own chunk, loaded when its screen opens.
 *
 * The map is client-only (Leaflet touches `window` at import time).
 */

import dynamic from 'next/dynamic'
import { LatticeLoader } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

function WorkspaceLoading() {
  const { tr } = useI18n()
  return (
    <div className="flex h-full w-full items-center justify-center bg-background" aria-busy="true">
      <LatticeLoader label={tr('Loading…')} />
    </div>
  )
}

/* Satellite-toned surface while Leaflet and the tiles arrive, so the map area
   does not flash white. */
function MapLoading() {
  return <div className="h-full w-full" style={{ background: '#5B6B4A' }} aria-busy="true" />
}


export const SatelliteMap = dynamic(
  () => import('@/components/dashboard/satellite-map').then((m) => m.SatelliteMap),
  { ssr: false, loading: MapLoading }
)

export const ModuleWorkspace = dynamic(() => import('@/components/dashboard/module-workspace').then((m) => m.ModuleWorkspace), { loading: WorkspaceLoading })
export const RssFeedWorkspace = dynamic(() => import('@/components/dashboard/rss-feed-workspace').then((m) => m.RssFeedWorkspace), { loading: WorkspaceLoading })
export const DataAnalyticsWorkspace = dynamic(() => import('@/components/dashboard/data-analytics-workspace').then((m) => m.DataAnalyticsWorkspace), { loading: WorkspaceLoading })
export const WaterIntelligenceWorkspace = dynamic(() => import('@/components/dashboard/water-intelligence-workspace').then((m) => m.WaterIntelligenceWorkspace), { loading: WorkspaceLoading })
export const EnergyIntelligenceWorkspace = dynamic(() => import('@/components/dashboard/energy-intelligence-workspace').then((m) => m.EnergyIntelligenceWorkspace), { loading: WorkspaceLoading })
export const WeatherWorkspace = dynamic(() => import('@/components/dashboard/weather-workspace').then((m) => m.WeatherWorkspace), { loading: WorkspaceLoading })
export const HarvestWorkspace = dynamic(() => import('@/components/dashboard/harvest-workspace').then((m) => m.HarvestWorkspace), { loading: WorkspaceLoading })
export const WatchtowerWorkspace = dynamic(() => import('@/components/dashboard/watchtower-workspace').then((m) => m.WatchtowerWorkspace), { loading: WorkspaceLoading })
export const AlertsCenterWorkspace = dynamic(() => import('@/components/dashboard/alerts-center-workspace').then((m) => m.AlertsCenterWorkspace), { loading: WorkspaceLoading })
export const AiMissionControlWorkspace = dynamic(() => import('@/components/dashboard/ai-mission-control-workspace').then((m) => m.AiMissionControlWorkspace), { loading: WorkspaceLoading })
export const InvestigationsWorkspace = dynamic(() => import('@/components/dashboard/investigations-workspace').then((m) => m.InvestigationsWorkspace), { loading: WorkspaceLoading })
export const InspectionsWorkspace = dynamic(() => import('@/components/dashboard/inspections-workspace').then((m) => m.InspectionsWorkspace), { loading: WorkspaceLoading })
export const DataHealthWorkspace = dynamic(() => import('@/components/dashboard/data-health-workspace').then((m) => m.DataHealthWorkspace), { loading: WorkspaceLoading })
export const CommodityWorkspace = dynamic(() => import('@/components/dashboard/commodity-workspace').then((m) => m.CommodityWorkspace), { loading: WorkspaceLoading })
