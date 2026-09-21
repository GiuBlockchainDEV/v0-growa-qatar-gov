import { harvestGetFieldRasterMeta, harvestGetParcel } from '@/lib/harvest/client'
import { extractBoundsFromGeoJson } from '@/lib/harvest/geojson'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { enrichRasterMetaDimensions } from '@/lib/harvest/raster-meta-resolve'
import type { HarvestRasterBoundsExtent, HarvestRasterGeorefDebug } from '@/lib/harvest/types'
import { normalizeRasterLegend, tryNormalizeRasterBounds, type RasterBounds } from '@/lib/harvest/raster-bounds'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

export type HarvestRasterImageSource = 'view' | 'raster'

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
  imageFilename: string
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
): RasterBounds {
  const fromApi =
    tryNormalizeRasterBounds(rawMeta.bounds) ?? tryNormalizeRasterBounds(rawMeta.bbox)
  if (fromApi) return fromApi
  if (fallbackBounds) return fallbackBounds
  throw new Error('HARVEST_RASTER_BOUNDS_UNAVAILABLE')
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

async function fetchDynamicRasterMeta({
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
  const rasterMode = resolveHarvestDataMode(mode, granularity)
  const query = {
    var: metric,
    granularity,
    ...(granularity === 'dekad' && period ? { period } : {}),
  }

  const meta = await harvestGetFieldRasterMeta(rasterMode, parcelId, seasonId, query)
  const rawMeta = meta as Record<string, unknown>
  let imageWidth = typeof meta.width === 'number' ? meta.width : null
  let imageHeight = typeof meta.height === 'number' ? meta.height : null

  if (!imageWidth || !imageHeight) {
    const dimensions = await enrichRasterMetaDimensions({
      rasterMode,
      parcelId,
      seasonId,
      metric,
      granularity,
      period,
    })
    imageWidth = dimensions.width
    imageHeight = dimensions.height
  }

  let bounds = resolveBoundsFromRasterMeta(rawMeta, fieldPolygonBounds)
  if (!meta.bounds && !meta.bbox && !parseTransform(rawMeta) && !fieldPolygonBounds) {
    const parcelBounds = await resolveParcelBounds(parcelId)
    if (parcelBounds) {
      bounds = parcelBounds
    }
  }

  if (imageWidth && imageHeight) {
    rawMeta.width = imageWidth
    rawMeta.height = imageHeight
  }

  return {
    bounds,
    vmin: meta.vmin ?? 0,
    vmax: meta.vmax ?? 100,
    unit: meta.unit || METRIC_UNITS[metric] || '',
    legend: normalizeRasterLegend(meta.legend),
    rasterMode,
    granularity,
    period,
    resolvedSeasonId: seasonId,
    imageSource: 'raster',
    imageFilename: `${metric}.jpeg`,
    boundsExtent: 'full_image',
    rawMeta,
    georefDebug: buildRasterGeorefDebug(rawMeta, bounds),
  }
}

function parseTransform(rawMeta: Record<string, unknown>) {
  const candidates = [rawMeta.transform, rawMeta.geotransform, rawMeta.out_transform, rawMeta.affine]
  return candidates.find((value) => Array.isArray(value) && value.length >= 6) ?? null
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

  const modesToTry: HarvestMode[] =
    granularity === 'dekad' ? ['current'] : mode === 'predict' ? ['predict', 'current'] : ['current']

  let lastError: Error | null = null

  for (const trySeasonId of seasonsToTry) {
    for (const tryMode of modesToTry) {
      if (granularity === 'season') {
        try {
          return await fetchDynamicRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            granularity: 'season',
            period: null,
            fieldPolygonBounds,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest raster unavailable')
        }
      }

      if (granularity === 'dekad' && period) {
        try {
          return await fetchDynamicRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            granularity: 'dekad',
            period,
            fieldPolygonBounds,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest dekad raster unavailable')
        }
      }
    }
  }

  // Dekad-specific raster missing: fall back to season aggregate (maps often exist only at season level).
  if (granularity === 'dekad') {
    for (const trySeasonId of seasonsToTry) {
      for (const tryMode of modesToTry) {
        try {
          const seasonMeta = await fetchDynamicRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            granularity: 'season',
            period: null,
            fieldPolygonBounds,
          })
          return seasonMeta
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest season raster fallback unavailable')
        }
      }
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
}
