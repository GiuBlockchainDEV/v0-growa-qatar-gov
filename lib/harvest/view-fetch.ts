import {
  harvestGetFieldRaster,
  harvestGetFieldRasterMeta,
  harvestGetFieldViewFile,
  harvestGetFieldViewJson,
  harvestGetParcel,
} from '@/lib/harvest/client'
import { extractBoundsFromGeoJson } from '@/lib/harvest/geojson'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import {
  fieldBoundsFromClipRings,
  logRasterGeorefDebug,
  resolveRasterGeoref,
} from '@/lib/harvest/raster-georef'
import type { HarvestRasterGeorefDebug } from '@/lib/harvest/types'
import { readRasterImageDimensions } from '@/lib/harvest/raster-image'
import { normalizeRasterBounds, normalizeRasterLegend } from '@/lib/harvest/raster-bounds'
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

function parseLegendJson(raw: unknown) {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!record) {
    return {
      bounds: null,
      vmin: 0,
      vmax: 100,
      unit: '',
      legend: [] as Array<{ color: string; label: string }>,
    }
  }

  const cmap = Array.isArray(record.cmap)
    ? record.cmap
    : Array.isArray(record.legend)
      ? record.legend
      : []

  return {
    bounds: record.bounds,
    vmin: typeof record.vmin === 'number' ? record.vmin : 0,
    vmax: typeof record.vmax === 'number' ? record.vmax : 100,
    unit: typeof record.unit === 'string' ? record.unit : '',
    legend: normalizeRasterLegend(cmap),
  }
}

async function resolveParcelBounds(parcelId: string) {
  try {
    const payload = await harvestGetParcel(parcelId)
    return extractBoundsFromGeoJson(payload?.geojson)
  } catch {
    return null
  }
}

async function fetchViewRasterMeta({
  mode,
  parcelId,
  seasonId,
  metric,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: number
  metric: HarvestMetricKey
}): Promise<HarvestRasterMetaResult> {
  const legend = await harvestGetFieldViewJson(mode, parcelId, seasonId, 'legend.json')
  const parsedLegend = parseLegendJson(legend)
  const parcelBounds = parsedLegend.bounds ? null : await resolveParcelBounds(parcelId)

  const rawMeta = legend && typeof legend === 'object' ? (legend as Record<string, unknown>) : {}
  const georef = resolveRasterGeoref({
    rawMeta,
    imageWidth: typeof rawMeta.width === 'number' ? rawMeta.width : null,
    imageHeight: typeof rawMeta.height === 'number' ? rawMeta.height : null,
  })

  return {
    bounds: georef.bounds,
    vmin: parsedLegend.vmin,
    vmax: parsedLegend.vmax,
    unit: parsedLegend.unit || METRIC_UNITS[metric] || '',
    legend: parsedLegend.legend,
    rasterMode: mode,
    granularity: 'season',
    period: null,
    resolvedSeasonId: seasonId,
    imageSource: 'view',
    imageFilename: `${metric}.jpeg`,
    rawMeta,
    georefDebug: georef.debug,
  }
}

async function fetchDynamicRasterMeta({
  mode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
}): Promise<HarvestRasterMetaResult> {
  const rasterMode = resolveHarvestDataMode(mode, granularity)
  const query = {
    var: metric,
    granularity,
    ...(granularity === 'dekad' && period ? { period } : {}),
  }

  const meta = await harvestGetFieldRasterMeta(rasterMode, parcelId, seasonId, query)
  const rawMeta = meta as Record<string, unknown>
  const georef = resolveRasterGeoref({
    rawMeta,
    imageWidth: typeof meta.width === 'number' ? meta.width : null,
    imageHeight: typeof meta.height === 'number' ? meta.height : null,
  })

  if (!meta.bounds && !meta.bbox && !parseTransform(rawMeta)) {
    const parcelBounds = await resolveParcelBounds(parcelId)
    if (parcelBounds) {
      georef.bounds = normalizeRasterBounds(parcelBounds)
      georef.debug.boundsSource = 'leaflet_bounds'
      georef.debug.computedLeafletBounds = georef.bounds
    }
  }

  return {
    bounds: georef.bounds,
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
    rawMeta,
    georefDebug: georef.debug,
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
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: string | number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
  seasonIds?: number[]
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
          await harvestGetFieldRasterMeta(tryMode, parcelId, trySeasonId, {
            var: metric,
            granularity: 'season',
          })
          return await fetchDynamicRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            granularity: 'season',
            period: null,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest raster unavailable')
        }

        try {
          await harvestGetFieldViewJson(tryMode, parcelId, trySeasonId, 'legend.json')
          await harvestGetFieldViewFile(tryMode, parcelId, trySeasonId, `${metric}.jpeg`)
          return await fetchViewRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest view raster unavailable')
        }
      }

      if (granularity === 'dekad' && period) {
        try {
          await harvestGetFieldRaster(tryMode, parcelId, trySeasonId, {
            var: metric,
            granularity: 'dekad',
            period,
          })
          return await fetchDynamicRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            granularity: 'dekad',
            period,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest dekad raster unavailable')
        }

        try {
          await harvestGetFieldViewFile(tryMode, parcelId, trySeasonId, `${metric}.jpeg`)
          return await fetchViewRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest view raster unavailable')
        }
      }
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
}

export async function finalizeHarvestRasterGeoref({
  meta,
  parcelId,
  metric,
  clipRings,
}: {
  meta: HarvestRasterMetaResult
  parcelId: string
  metric: HarvestMetricKey
  clipRings?: Array<Array<{ lat: number; lng: number }>>
}): Promise<HarvestRasterMetaResult> {
  const fieldPolygonBounds = clipRings ? fieldBoundsFromClipRings(clipRings) : null
  let imageWidth =
    meta.georefDebug?.imageWidth ??
    (typeof meta.rawMeta.width === 'number' ? meta.rawMeta.width : null)
  let imageHeight =
    meta.georefDebug?.imageHeight ??
    (typeof meta.rawMeta.height === 'number' ? meta.rawMeta.height : null)

  const transform = parseTransform(meta.rawMeta)
  const needsImageDimensions = Boolean(transform) && (!imageWidth || !imageHeight)

  if (needsImageDimensions) {
    try {
      const buffer = await fetchHarvestRasterBinary({ meta, parcelId, metric })
      const dimensions = await readRasterImageDimensions(Buffer.from(buffer))
      if (dimensions) {
        imageWidth = dimensions.width
        imageHeight = dimensions.height
      }
    } catch {
      // Dimensions are optional when bounds come directly from metadata.
    }
  }

  const georef = resolveRasterGeoref({
    rawMeta: meta.rawMeta,
    imageWidth,
    imageHeight,
    fieldPolygonBounds,
  })
  logRasterGeorefDebug(georef.debug, parcelId)

  return {
    ...meta,
    bounds: georef.bounds,
    georefDebug: georef.debug,
  }
}

export async function fetchHarvestRasterBinary({
  meta,
  parcelId,
  metric,
}: {
  meta: HarvestRasterMetaResult
  parcelId: string
  metric: HarvestMetricKey
}): Promise<ArrayBuffer> {
  const seasonId = meta.resolvedSeasonId
  if (!seasonId) {
    throw new Error('HARVEST_RASTER_SEASON_UNAVAILABLE')
  }

  if (meta.imageSource === 'view') {
    const buffer = await harvestGetFieldViewFile(
      meta.rasterMode,
      parcelId,
      seasonId,
      meta.imageFilename
    )
    if (!buffer.byteLength) {
      throw new Error('HARVEST_REQUEST_FAILED:502:Empty view image response from Harvest API')
    }
    return buffer
  }

  const query = {
    var: metric,
    granularity: meta.granularity,
    ...(meta.granularity === 'dekad' && meta.period ? { period: meta.period } : {}),
  }

  const buffer = await harvestGetFieldRaster(meta.rasterMode, parcelId, seasonId, query)
  if (!buffer.byteLength) {
    throw new Error('HARVEST_REQUEST_FAILED:502:Empty raster response from Harvest API')
  }
  return buffer
}
