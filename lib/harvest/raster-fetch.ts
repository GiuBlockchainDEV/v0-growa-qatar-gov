import { harvestGetFieldRaster, harvestGetFieldRasterMeta } from '@/lib/harvest/client'
import { normalizeRasterBounds, normalizeRasterLegend } from '@/lib/harvest/raster-bounds'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

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
}

function buildRasterAttempts(
  mode: HarvestMode,
  granularity: HarvestTrendGranularity,
  period: string | null
) {
  const attempts: Array<{
    rasterMode: HarvestMode
    granularity: HarvestTrendGranularity
    period: string | null
  }> = [
    { rasterMode: mode, granularity, period },
    ...(granularity === 'dekad'
      ? [
          { rasterMode: mode, granularity: 'season' as HarvestTrendGranularity, period: null },
          { rasterMode: 'current', granularity: 'dekad' as HarvestTrendGranularity, period },
          { rasterMode: 'current', granularity: 'season' as HarvestTrendGranularity, period: null },
        ]
      : mode !== 'current'
        ? [{ rasterMode: 'current', granularity, period }]
        : []),
  ]

  return attempts
}

async function fetchHarvestRasterMetaForSeason({
  mode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: string | number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
}): Promise<HarvestRasterMetaResult> {
  const attempts = buildRasterAttempts(mode, granularity, period)
  let lastError: Error | null = null

  for (const attempt of attempts) {
    const query = {
      var: metric,
      granularity: attempt.granularity,
      ...(attempt.granularity === 'dekad' && attempt.period ? { period: attempt.period } : {}),
    }

    try {
      const meta = await harvestGetFieldRasterMeta(
        attempt.rasterMode,
        parcelId,
        seasonId,
        query
      )

      return {
        bounds: normalizeRasterBounds(meta.bounds),
        vmin: meta.vmin ?? 0,
        vmax: meta.vmax ?? 100,
        unit: meta.unit || '',
        legend: normalizeRasterLegend(meta.legend),
        rasterMode: attempt.rasterMode,
        granularity: attempt.granularity,
        period: attempt.period,
        resolvedSeasonId: Number(seasonId),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Harvest raster meta request failed')
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
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

  let lastError: Error | null = null

  for (const trySeasonId of seasonsToTry) {
    try {
      return await fetchHarvestRasterMetaForSeason({
        mode,
        parcelId,
        seasonId: trySeasonId,
        metric,
        granularity,
        period,
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Harvest raster meta request failed')
    }
  }

  throw lastError || new Error('HARVEST_RASTER_META_UNAVAILABLE')
}

export async function fetchHarvestRasterBinary({
  mode,
  parcelId,
  seasonId,
  metric,
  granularity,
  period,
}: {
  mode: HarvestMode
  parcelId: string
  seasonId: string | number
  metric: HarvestMetricKey
  granularity: HarvestTrendGranularity
  period: string | null
}): Promise<{ buffer: ArrayBuffer; rasterMode: HarvestMode; granularity: HarvestTrendGranularity; period: string | null }> {
  const meta = await fetchHarvestRasterMeta({
    mode,
    parcelId,
    seasonId,
    metric,
    granularity,
    period,
  })

  const query = {
    var: metric,
    granularity: meta.granularity,
    ...(meta.granularity === 'dekad' && meta.period ? { period: meta.period } : {}),
  }

  const buffer = await harvestGetFieldRaster(meta.rasterMode, parcelId, seasonId, query)
  if (!buffer.byteLength) {
    throw new Error('HARVEST_REQUEST_FAILED:502:Empty raster response from Harvest API')
  }

  return {
    buffer,
    rasterMode: meta.rasterMode,
    granularity: meta.granularity,
    period: meta.period,
  }
}
