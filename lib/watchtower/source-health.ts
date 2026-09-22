import type { DataQualityStatus, SourceStatus } from '@/lib/domain/types'
import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'
import { getWeatherApiKey } from '@/app/api/weather/_shared'
import { resolveHarvestDemoMode } from '@/lib/harvest/resolve'

export function buildSourceStatus(data: WatchtowerRawData): SourceStatus[] {
  const now = data.fetchedAt
  const harvestDemo = resolveHarvestDemoMode()

  return [
    {
      source: 'supabase.operations',
      health: data.farms.length > 0 || data.insights.length > 0 ? 'healthy' : 'degraded',
      lastChecked: now,
      message: `${data.farms.length} farms, ${data.insights.length} insights loaded`,
      sourceMode: 'live',
    },
    {
      source: 'harvest.api',
      health: !data.harvestAvailable ? 'offline' : harvestDemo || data.harvestDemo ? 'degraded' : 'healthy',
      lastChecked: now,
      message: !data.harvestAvailable
        ? 'Harvest API unavailable'
        : data.harvestDemo
          ? 'Demo mode active'
          : `${data.harvestFields.length} fields loaded`,
      sourceMode: data.harvestDemo ? 'demo' : data.harvestAvailable ? 'live' : 'unavailable',
    },
    {
      source: 'weather.api',
      health: data.weatherAvailable ? 'healthy' : getWeatherApiKey() ? 'degraded' : 'offline',
      lastChecked: now,
      message: data.weatherAvailable
        ? `${data.weatherSamples.filter((s) => s.available).length}/${data.weatherSamples.length} zones sampled`
        : 'Weather API not configured or unreachable',
      sourceMode: data.weatherAvailable ? 'live' : 'unavailable',
    },
    {
      source: 'supply.overview',
      health: data.supplyAvailable ? 'healthy' : 'stale',
      lastChecked: now,
      message: data.supplyAvailable ? 'Supply snapshot available' : 'No supply snapshot data',
      sourceMode: data.supplyAvailable ? 'live' : 'unavailable',
    },
    {
      source: 'gemini.ai',
      health: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'healthy' : 'offline',
      lastChecked: now,
      message: 'AI briefing service',
      sourceMode: process.env.GEMINI_API_KEY ? 'live' : 'unavailable',
    },
  ]
}

export function buildDataQualityStatus(data: WatchtowerRawData): DataQualityStatus[] {
  const farmsWithoutGps = data.farms.filter(
    (farm) => farm.gps_latitude == null || farm.gps_longitude == null
  ).length
  const farmCoverage =
    data.farms.length > 0 ? Math.round(((data.farms.length - farmsWithoutGps) / data.farms.length) * 100) : 0

  return [
    {
      source: 'farms.registry',
      status: data.farms.length === 0 ? 'missing' : farmsWithoutGps > 0 ? 'partial' : 'fresh',
      coveragePercent: farmCoverage,
      entityCount: data.farms.length,
      missingEntityCount: farmsWithoutGps,
      lastUpdated: data.fetchedAt,
      sourceMode: 'live',
    },
    {
      source: 'production.insights',
      status: data.insights.length === 0 ? 'missing' : 'fresh',
      entityCount: data.insights.length,
      lastUpdated: data.fetchedAt,
      sourceMode: 'live',
    },
    {
      source: 'harvest.satellite',
      status: !data.harvestAvailable ? 'unavailable' : data.harvestDemo ? 'partial' : 'fresh',
      entityCount: data.harvestFields.length,
      lastUpdated: data.fetchedAt,
      sourceMode: data.harvestDemo ? 'demo' : data.harvestAvailable ? 'live' : 'unavailable',
    },
    {
      source: 'weather.grid',
      status: data.weatherAvailable ? 'fresh' : 'unavailable',
      coveragePercent: data.weatherAvailable
        ? Math.round((data.weatherSamples.filter((s) => s.available).length / data.weatherSamples.length) * 100)
        : 0,
      lastUpdated: data.fetchedAt,
      sourceMode: data.weatherAvailable ? 'live' : 'unavailable',
    },
    {
      source: 'supply.chain',
      status: data.supplyAvailable ? 'fresh' : 'missing',
      lastUpdated: data.fetchedAt,
      sourceMode: data.supplyAvailable ? 'live' : 'unavailable',
    },
  ]
}
