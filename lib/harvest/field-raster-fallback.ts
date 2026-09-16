import { harvestGetParcel } from '@/lib/harvest/client'
import { getDemoParcelGeojson } from '@/lib/harvest/demo-data'
import { extractBoundsFromGeoJson } from '@/lib/harvest/geojson'
import { buildDemoRasterMeta, buildDemoRasterSvg } from '@/lib/harvest/raster'
import type {
  HarvestMetricKey,
  HarvestMode,
  HarvestRasterResponse,
  HarvestTrendGranularity,
} from '@/lib/harvest/types'

export const HARVEST_LIVE_RASTER_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd']

export function isLiveRasterMetric(metric: HarvestMetricKey) {
  return HARVEST_LIVE_RASTER_METRICS.includes(metric)
}

async function resolveParcelBounds(parcelId: string, demoMode: boolean) {
  try {
    const payload = demoMode
      ? getDemoParcelGeojson(parcelId)
      : await harvestGetParcel(parcelId).catch(() => getDemoParcelGeojson(parcelId))

    const bounds = extractBoundsFromGeoJson(payload?.geojson)
    if (bounds) return bounds
  } catch {
    // fall through to default bounds
  }

  return [[25.2, 51.1], [25.5, 51.4]]
}

export async function buildFieldRasterFallback({
  parcelId,
  fieldName,
  metric,
  granularity,
  period,
  demoMode,
}: {
  parcelId: string
  fieldName: string
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
  demoMode: boolean
}): Promise<HarvestRasterResponse> {
  const bounds = await resolveParcelBounds(parcelId, demoMode)
  const meta = buildDemoRasterMeta(metric, [
    [
      { lat: bounds[0][0], lng: bounds[0][1] },
      { lat: bounds[0][0], lng: bounds[1][1] },
      { lat: bounds[1][0], lng: bounds[1][1] },
      { lat: bounds[1][0], lng: bounds[0][1] },
    ],
  ])

  return {
    metric,
    granularity,
    period,
    image_url: buildDemoRasterSvg(metric, fieldName),
    bounds: meta.bounds,
    vmin: meta.vmin,
    vmax: meta.vmax,
    unit: meta.unit,
    legend: meta.legend,
  }
}
