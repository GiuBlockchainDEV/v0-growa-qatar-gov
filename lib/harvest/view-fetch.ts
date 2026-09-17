import {
  harvestGetFieldRaster,
  harvestGetFieldRasterMeta,
  harvestGetFieldViewFile,
  harvestGetFieldViewJson,
  harvestGetParcel,
} from '@/lib/harvest/client'
import { extractBoundsFromGeoJson } from '@/lib/harvest/geojson'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { fieldBoundsFromClipRings } from '@/lib/harvest/raster-georef'
import {
  enrichRasterMetaDimensions,
  resolveRasterGeorefFromMeta,
} from '@/lib/harvest/raster-meta-resolve'
import type { HarvestRasterGeorefDebug } from '@/lib/harvest/types'
import { normalizeRasterLegend } from '@/lib/harvest/raster-bounds'
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

async function resolveViewImageFile({
  mode,
  parcelId,
  seasonId,
  metric,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: number
  metric: HarvestMetricKey
}): Promise<{ filename: string; buffer: ArrayBuffer }> {
  const candidates = [`${metric}.jpeg`, `${metric}.jpg`, `${metric}.png`]

  for (const filename of candidates) {
    try {
      const buffer = await harvestGetFieldViewFile(mode, parcelId, seasonId, filename)
      if (buffer.byteLength > 0) {
        return { filename, buffer }
      }
    } catch {
      // try next extension
    }
  }

  throw new Error('HARVEST_VIEW_IMAGE_UNAVAILABLE')
}

async function fetchViewRasterMeta({
  mode,
  parcelId,
  seasonId,
  metric,
  fieldPolygonBounds,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: number
  metric: HarvestMetricKey
  fieldPolygonBounds?: [[number, number], [number, number]] | null
}): Promise<HarvestRasterMetaResult> {
  let legend: unknown = null
  try {
    legend = await harvestGetFieldViewJson(mode, parcelId, seasonId, 'legend.json')
  } catch {
    // legend.json is optional; season maps can exist without it
  }

  const parsedLegend = parseLegendJson(legend)
  const rawMeta = legend && typeof legend === 'object' ? (legend as Record<string, unknown>) : {}
  if (parsedLegend.bounds) {
    rawMeta.bounds = parsedLegend.bounds
  }

  const viewImage = await resolveViewImageFile({ mode, parcelId, seasonId, metric })

  let imageWidth = typeof rawMeta.width === 'number' ? rawMeta.width : null
  let imageHeight = typeof rawMeta.height === 'number' ? rawMeta.height : null
  if (!imageWidth || !imageHeight) {
    const dimensions = await enrichRasterMetaDimensions({
      rasterMode: mode,
      parcelId,
      seasonId,
      metric,
      granularity: 'season',
      period: null,
      imageBuffer: viewImage.buffer,
    })
    imageWidth = dimensions.width
    imageHeight = dimensions.height
  }

  const georef = resolveRasterGeorefFromMeta({
    rawMeta,
    imageWidth,
    imageHeight,
    fieldPolygonBounds,
  })

  if (!parsedLegend.bounds && !parseTransform(rawMeta) && !fieldPolygonBounds) {
    const parcelBounds = await resolveParcelBounds(parcelId)
    if (parcelBounds) {
      georef.bounds = parcelBounds
      georef.debug.boundsSource = 'leaflet_bounds'
      georef.debug.computedLeafletBounds = parcelBounds
    }
  }

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
    imageFilename: viewImage.filename,
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

  const georef = resolveRasterGeorefFromMeta({
    rawMeta,
    imageWidth,
    imageHeight,
    fieldPolygonBounds,
  })

  if (!meta.bounds && !meta.bbox && !parseTransform(rawMeta) && !fieldPolygonBounds) {
    const parcelBounds = await resolveParcelBounds(parcelId)
    if (parcelBounds) {
      georef.bounds = parcelBounds
      georef.debug.boundsSource = 'leaflet_bounds'
      georef.debug.computedLeafletBounds = parcelBounds
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

        try {
          return await fetchViewRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            fieldPolygonBounds,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest view raster unavailable')
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

        try {
          return await fetchViewRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            fieldPolygonBounds,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest view raster unavailable')
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

        try {
          return await fetchViewRasterMeta({
            mode: tryMode,
            parcelId,
            seasonId: trySeasonId,
            metric,
            fieldPolygonBounds,
          })
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Harvest season view fallback unavailable')
        }
      }
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
}

export function applyHarvestRasterGeoref({
  meta,
  parcelId,
  clipRings,
}: {
  meta: HarvestRasterMetaResult
  parcelId: string
  clipRings?: Array<Array<{ lat: number; lng: number }>>
}): HarvestRasterMetaResult {
  const fieldPolygonBounds = clipRings ? fieldBoundsFromClipRings(clipRings) : null
  const georef = resolveRasterGeorefFromMeta({
    rawMeta: meta.rawMeta,
    imageWidth: typeof meta.rawMeta.width === 'number' ? meta.rawMeta.width : null,
    imageHeight: typeof meta.rawMeta.height === 'number' ? meta.rawMeta.height : null,
    fieldPolygonBounds,
  })

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
