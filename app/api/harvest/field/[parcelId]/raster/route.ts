import { NextResponse } from 'next/server'
import { requireHarvestAccess } from '@/lib/harvest/auth'
import { findHarvestCollectingTask } from '@/lib/harvest/collecting'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import {
  buildFieldRasterFallback,
  isLiveRasterMetric,
} from '@/lib/harvest/field-raster-fallback'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { normalizeRasterLegend, tryNormalizeRasterBounds } from '@/lib/harvest/raster-bounds'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import { listHarvestSeasonIds, resolveHarvestSeasonId } from '@/lib/harvest/season-resolve'
import { loadHarvestClipRings } from '@/lib/harvest/clip-rings'
import { fieldBoundsFromClipRings } from '@/lib/harvest/raster-georef'
import { fetchHarvestRasterMeta } from '@/lib/harvest/view-fetch'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

function buildImageUrl({
  parcelId,
  meta,
  metric,
  mode,
  resolvedSeasonId,
}: {
  parcelId: string
  meta: Awaited<ReturnType<typeof fetchHarvestRasterMeta>>
  metric: HarvestMetricKey
  mode: HarvestMode
  resolvedSeasonId: number
}) {
  if (meta.imageSource === 'view') {
    const viewParams = new URLSearchParams({
      mode: meta.rasterMode,
      season_id: String(resolvedSeasonId),
    })
    return `/api/harvest/field/${parcelId}/view/${meta.imageFilename}?${viewParams.toString()}`
  }

  const imageParams = new URLSearchParams({
    mode,
    raster_mode: meta.rasterMode,
    metric,
    granularity: meta.granularity,
    season_id: String(resolvedSeasonId),
  })
  if (meta.granularity === 'dekad' && meta.period) {
    imageParams.set('period', meta.period)
  }
  return `/api/harvest/field/${parcelId}/raster/image?${imageParams.toString()}`
}

export async function GET(request: Request, context: RouteContext) {
  const access = await requireHarvestAccess()
  if (!access.ok) return access.response

  const { parcelId } = await context.params
  if (!parcelId) {
    return NextResponse.json({ error: 'parcelId is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') || 'current') as HarvestMode
  const metric = (searchParams.get('metric') || 'npp') as HarvestMetricKey
  const granularity = (searchParams.get('granularity') || 'season') as HarvestTrendGranularity
  const period = searchParams.get('period')
  const seasonIdParam = searchParams.get('season_id')

  if (!METRIC_KEYS.includes(metric)) {
    return NextResponse.json({ error: 'metric is invalid' }, { status: 400 })
  }

  if (access.demoMode) {
    const clipRings = await loadHarvestClipRings(parcelId, true)
    const fieldPolygonBounds = fieldBoundsFromClipRings(clipRings)
    const demoRaster = getDemoFieldRaster(parcelId, mode, metric, granularity, period)
    if (demoRaster) {
      const imageParams = new URLSearchParams({
        mode,
        metric,
        granularity,
        season_id: seasonIdParam,
      })
      if (granularity === 'dekad' && period) imageParams.set('period', period)
      return harvestJsonResponse(
        {
          ...demoRaster,
          image_url: `/api/harvest/field/${parcelId}/raster/image?${imageParams.toString()}`,
          bounds: tryNormalizeRasterBounds(demoRaster.bounds) ?? fieldPolygonBounds ?? [[25.2, 51.1], [25.5, 51.4]],
          legend: normalizeRasterLegend(demoRaster.legend),
          clip_rings: clipRings,
          georef_debug: {
            rasterCrs: 'EPSG:4326',
            rasterTransform: null,
            rawBounds: demoRaster.bounds,
            rawBbox: null,
            imageWidth: null,
            imageHeight: null,
            computedLeafletBounds:
              tryNormalizeRasterBounds(demoRaster.bounds) ?? fieldPolygonBounds ?? [[25.2, 51.1], [25.5, 51.4]],
            fieldPolygonBounds,
            boundsSource: 'leaflet_bounds',
            fieldOverlap: fieldPolygonBounds ? 1 : null,
            hasRotation: false,
            rotationWarning: null,
          },
        },
        true
      )
    }
    const fallback = await buildFieldRasterFallback({
      parcelId,
      fieldName: 'Field',
      metric,
      granularity,
      period,
      demoMode: true,
    })
    return harvestJsonResponse(fallback, true)
  }

  if (!isLiveRasterMetric(metric)) {
    return NextResponse.json(
      {
        error: `Raster layer unavailable for metric "${metric}"`,
        hint: 'Only aeti, npp, tbp, bwp, and rwd have satellite raster layers.',
      },
      { status: 404 }
    )
  }

  if (granularity === 'dekad' && !period) {
    return NextResponse.json({ error: 'period is required for dekad raster layers' }, { status: 400 })
  }

  let requestedSeasonId: number | null = seasonIdParam ? Number(seasonIdParam) : null
  if (requestedSeasonId !== null && !Number.isFinite(requestedSeasonId)) {
    requestedSeasonId = null
  }

  try {
    requestedSeasonId = await resolveHarvestSeasonId(parcelId, mode, false, seasonIdParam)
    if (!Number.isFinite(requestedSeasonId)) {
      return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
    }

    const clipRings = await loadHarvestClipRings(parcelId, false)
    const fieldPolygonBounds = fieldBoundsFromClipRings(clipRings)
    const seasonIds = await listHarvestSeasonIds(parcelId, requestedSeasonId)
    const dataMode = resolveHarvestDataMode(mode, granularity)
    const meta = await fetchHarvestRasterMeta({
      mode: dataMode,
      parcelId,
      seasonId: requestedSeasonId,
      metric,
      granularity,
      period,
      seasonIds,
      fieldPolygonBounds,
    })

    const resolvedSeasonId = meta.resolvedSeasonId ?? requestedSeasonId
    const payload = {
      metric,
      granularity: meta.granularity,
      period: meta.period,
      raster_mode: meta.rasterMode,
      image_source: meta.imageSource,
      bounds_extent: meta.boundsExtent,
      requested_season_id: requestedSeasonId,
      resolved_season_id: resolvedSeasonId,
      image_url: buildImageUrl({
        parcelId,
        meta,
        metric,
        mode,
        resolvedSeasonId,
      }),
      bounds: meta.bounds,
      clip_rings: clipRings,
      georef_debug: meta.georefDebug,
      vmin: meta.vmin,
      vmax: meta.vmax,
      unit: meta.unit,
      legend: meta.legend,
    }

    return harvestJsonResponse(payload, false)
  } catch (error) {
    const fallbackSeasonId =
      requestedSeasonId && Number.isFinite(requestedSeasonId) ? requestedSeasonId : null
    const collecting = fallbackSeasonId
      ? await findHarvestCollectingTask(parcelId, fallbackSeasonId)
      : null
    const seasonIds = fallbackSeasonId
      ? await listHarvestSeasonIds(parcelId, fallbackSeasonId).catch(() => [fallbackSeasonId])
      : []
    const details = error instanceof Error ? error.message : 'Unknown raster error'

    return NextResponse.json(
      {
        error: 'Satellite raster is not available for this field and season',
        details,
        requested_season_id: requestedSeasonId,
        season_ids_tried: seasonIds,
        collecting: collecting
          ? {
              task_id: collecting.task_id,
              season_id: collecting.season_id,
            }
          : null,
        hint: collecting
          ? 'Geospatial data is still being collected for this field. Refresh in a few minutes.'
          : granularity === 'dekad'
            ? 'Try Season map instead of Dekad, or pick another dekad period from the dropdown.'
            : 'Verify that entity collection has completed and that stats_agg.csv is available for this season.',
      },
      { status: 404 }
    )
  }
}
