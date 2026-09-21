import { harvestGetFieldRasterMeta, harvestGetParcel } from '@/lib/harvest/client'
import { extractBoundsFromGeoJson } from '@/lib/harvest/geojson'
import type { HarvestRasterBoundsExtent, HarvestRasterGeorefDebug } from '@/lib/harvest/types'
import { normalizeRasterLegend, tryNormalizeRasterBounds, type RasterBounds } from '@/lib/harvest/raster-bounds'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

export type HarvestRasterImageSource = 'raster'

export interface HarvestRasterMetaResult {
  bounds: [[number, number], [number, number]]
  vmin: number
  vmax: number
  unit: string
  legend: Array<{ color: string; label: string }>
  rasterMode: HarvestMode
  granularity: HarvestTrendGranularity
  period: string | null
  resolvedSeasonId?: number
  imageSource: HarvestRasterImageSource
  boundsExtent: HarvestRasterBoundsExtent
  rawMeta: Record<string, unknown>
  georefDebug?: HarvestRasterGeorefDebug
}

const METRIC_UNITS: Partial<Record<HarvestMetricKey, string>> = {
  aeti: 'mm',
  npp: 'gC/m²',
  tbp: 'Ton/Ha',
  bwp: 'Kg/m³',
  rwd: '—',
}

function buildRasterQuery({
  metric,
  granularity,
  period,
}: {
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
}) {
  return {
    var: metric,
    granularity,
    ...(granularity === 'dekad' && period ? { period } : {}),
  }
}

function rasterModesToTry(mode: HarvestMode): HarvestMode[] {
  return mode === 'predict' ? ['predict', 'current'] : ['current']
}

async function resolveParcelBounds(parcelId: string) {
  try {
    const payload = await harvestGetParcel(parcelId)
    return extractBoundsFromGeoJson(payload?.geojson)
  } catch {
    return null
  }
}

function resolveBoundsFromRasterMeta(
  rawMeta: Record<string, unknown>,
  fallbackBounds?: RasterBounds | null
): RasterBounds | null {
  const fromApi =
    tryNormalizeRasterBounds(rawMeta.bounds) ?? tryNormalizeRasterBounds(rawMeta.bbox)
  if (fromApi) return fromApi
  return fallbackBounds ?? null
}

function buildRasterGeorefDebug(
  rawMeta: Record<string, unknown>,
  bounds: RasterBounds
): HarvestRasterGeorefDebug {
  return {
    rasterCrs: typeof rawMeta.crs === 'string' ? rawMeta.crs : typeof rawMeta.srs === 'string' ? rawMeta.srs : null,
    rasterTransform: null,
    rawBounds: rawMeta.bounds ?? null,
    rawBbox: Array.isArray(rawMeta.bbox) ? (rawMeta.bbox as number[]) : null,
    imageWidth: typeof rawMeta.width === 'number' ? rawMeta.width : null,
    imageHeight: typeof rawMeta.height === 'number' ? rawMeta.height : null,
    computedLeafletBounds: bounds,
    fieldPolygonBounds: null,
    boundsSource: 'leaflet_bounds',
    fieldOverlap: null,
    hasRotation: false,
    rotationWarning: null,
  }
}

async function resolveBoundsWithFallback(
  rawMeta: Record<string, unknown>,
  parcelId: string,
  fallbackBounds?: RasterBounds | null
): Promise<RasterBounds> {
  const resolved = resolveBoundsFromRasterMeta(rawMeta, fallbackBounds)
  if (resolved) return resolved

  const parcelBounds = await resolveParcelBounds(parcelId)
  if (parcelBounds) return parcelBounds

  throw new Error('HARVEST_RASTER_BOUNDS_UNAVAILABLE')
}

async function fetchEntityRasterMeta({
  mode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
  fieldPolygonBounds,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
  fieldPolygonBounds?: [[number, number], [number, number]] | null
}): Promise<HarvestRasterMetaResult> {
  const query = buildRasterQuery({ metric, granularity, period })
  let rawMeta: Record<string, unknown> = {}
  let vmin = 0
  let vmax = 100
  let unit = METRIC_UNITS[metric] || ''
  let legend: Array<{ color: string; label: string }> = []

  try {
    const meta = await harvestGetFieldRasterMeta(mode, parcelId, seasonId, query)
    rawMeta = meta as Record<string, unknown>
    vmin = meta.vmin ?? 0
    vmax = meta.vmax ?? 100
    unit = meta.unit || METRIC_UNITS[metric] || ''
    legend = normalizeRasterLegend(meta.legend)
  } catch {
    // entity/raster_meta is optional; entity/raster is the canonical image source
  }

  const bounds = await resolveBoundsWithFallback(rawMeta, parcelId, fieldPolygonBounds)

  return {
    bounds,
    vmin,
    vmax,
    unit,
    legend,
    rasterMode: mode,
    granularity,
    period,
    resolvedSeasonId: seasonId,
    imageSource: 'raster',
    boundsExtent: 'full_image',
    rawMeta,
    georefDebug: buildRasterGeorefDebug(rawMeta, bounds),
  }
}

export async function fetchHarvestRasterMeta({
  mode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
  seasonIds,
  fieldPolygonBounds,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: string | number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
  seasonIds?: number[]
  fieldPolygonBounds?: [[number, number], [number, number]] | null
}): Promise<HarvestRasterMetaResult> {
  const preferredSeasonId = Number(seasonId)
  const seasonsToTry =
    seasonIds && seasonIds.length > 0
      ? seasonIds
      : Number.isFinite(preferredSeasonId)
        ? [preferredSeasonId]
        : []

  const modesToTry = rasterModesToTry(mode)
  let lastError: Error | null = null

  for (const trySeasonId of seasonsToTry) {
    for (const tryMode of modesToTry) {
      try {
        return await fetchEntityRasterMeta({
          mode: tryMode,
          parcelId,
          seasonId: trySeasonId,
          metric,
          granularity,
          period,
          fieldPolygonBounds,
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Harvest raster unavailable')
      }
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
}
