import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import {
  buildFieldRasterFallback,
  isLiveRasterMetric,
} from '@/lib/harvest/field-raster-fallback'
import { fetchHarvestRasterMeta } from '@/lib/harvest/raster-fetch'
import { normalizeRasterBounds, normalizeRasterLegend } from '@/lib/harvest/raster-bounds'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

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
  const seasonId = searchParams.get('season_id')

  if (!METRIC_KEYS.includes(metric)) {
    return NextResponse.json({ error: 'metric is invalid' }, { status: 400 })
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  if (access.demoMode) {
    const demoRaster = getDemoFieldRaster(parcelId, mode, metric, granularity, period)
    if (demoRaster) {
      const imageParams = new URLSearchParams({
        mode,
        metric,
        granularity,
        season_id: seasonId,
      })
      if (granularity === 'dekad' && period) imageParams.set('period', period)
      return harvestJsonResponse(
        {
          ...demoRaster,
          image_url: `/api/harvest/field/${parcelId}/raster/image?${imageParams.toString()}`,
          bounds: normalizeRasterBounds(demoRaster.bounds),
          legend: normalizeRasterLegend(demoRaster.legend),
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
    const meta = await fetchHarvestRasterMeta({
      mode,
      parcelId,
      seasonId,
      metric,
      granularity,
      period,
    })

    const imageParams = new URLSearchParams({
      mode,
      raster_mode: meta.rasterMode,
      metric,
      granularity: meta.granularity,
      season_id: seasonId,
    })
    if (meta.granularity === 'dekad' && meta.period) {
      imageParams.set('period', meta.period)
    }

    const payload = {
      metric,
      granularity: meta.granularity,
      period: meta.period,
      raster_mode: meta.rasterMode,
      image_url: `/api/harvest/field/${parcelId}/raster/image?${imageParams.toString()}`,
      bounds: meta.bounds,
      vmin: meta.vmin,
      vmax: meta.vmax,
      unit: meta.unit,
      legend: meta.legend,
    }

    return harvestJsonResponse(payload, false)
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
