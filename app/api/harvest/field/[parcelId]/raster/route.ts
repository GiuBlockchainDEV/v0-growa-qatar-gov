import { NextResponse } from 'next/server'
import { requireHarvestAccess } from '@/lib/harvest/auth'
import { findHarvestCollectingTask } from '@/lib/harvest/collecting'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import {
  buildFieldRasterFallback,
  isLiveRasterMetric,
} from '@/lib/harvest/field-raster-fallback'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { normalizeRasterBounds, normalizeRasterLegend } from '@/lib/harvest/raster-bounds'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import { listHarvestSeasonIds } from '@/lib/harvest/season-resolve'
import { loadHarvestClipRings } from '@/lib/harvest/clip-rings'
import { fieldBoundsFromClipRings } from '@/lib/harvest/raster-georef'
import { applyHarvestRasterGeoref, fetchHarvestRasterMeta } from '@/lib/harvest/view-fetch'
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
  const granularity = (searchParams.get('granularity') || 'dekad') as HarvestTrendGranularity
  const period = searchParams.get('period')
  const seasonIdParam = searchParams.get('season_id')

  if (!METRIC_KEYS.includes(metric)) {
    return NextResponse.json({ error: 'metric is invalid' }, { status: 400 })
  }

  if (!seasonIdParam) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  const requestedSeasonId = Number(seasonIdParam)
  if (!Number.isFinite(requestedSeasonId)) {
    return NextResponse.json({ error: 'season_id is invalid' }, { status: 400 })
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
          bounds: normalizeRasterBounds(demoRaster.bounds),
          legend: normalizeRasterLegend(demoRaster.legend),
          clip_rings: clipRings,
          georef_debug: {
            rasterCrs: 'EPSG:4326',
            rasterTransform: null,
            rawBounds: demoRaster.bounds,
            rawBbox: null,
            imageWidth: null,
            imageHeight: null,
            computedLeafletBounds: normalizeRasterBounds(demoRaster.bounds),
            fieldPolygonBounds,
            boundsSource: 'leaflet_bounds',
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

  try {
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
    })

    const resolvedSeasonId = meta.resolvedSeasonId ?? requestedSeasonId
    const clipRings = await loadHarvestClipRings(parcelId, false)
    const georefMeta = applyHarvestRasterGeoref({
      meta,
      parcelId,
      clipRings,
    })
    const payload = {
      metric,
      granularity: georefMeta.granularity,
      period: georefMeta.period,
      raster_mode: georefMeta.rasterMode,
      image_source: georefMeta.imageSource,
      requested_season_id: requestedSeasonId,
      resolved_season_id: resolvedSeasonId,
      image_url: buildImageUrl({
        parcelId,
        meta: georefMeta,
        metric,
        mode,
        resolvedSeasonId,
      }),
      bounds: georefMeta.bounds,
      clip_rings: clipRings,
      georef_debug: georefMeta.georefDebug,
      vmin: georefMeta.vmin,
      vmax: georefMeta.vmax,
      unit: georefMeta.unit,
      legend: georefMeta.legend,
    }

    return harvestJsonResponse(payload, false)
  } catch {
    const collecting = await findHarvestCollectingTask(parcelId, requestedSeasonId)
    const seasonIds = await listHarvestSeasonIds(parcelId, requestedSeasonId).catch(() => [requestedSeasonId])

    return NextResponse.json(
      {
        error: 'Satellite raster is not available for this field and season',
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
          : 'Verify that entity collection has completed and that stats_agg.csv is available for this season.',
      },
      { status: 404 }
    )
  }
}
