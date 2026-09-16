import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldRaster, harvestGetFieldRasterMeta } from '@/lib/harvest/client'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
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
    if (!demoRaster) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }
    return harvestJsonResponse(demoRaster, true)
  }

  try {
    const rasterMode = granularity === 'season' ? mode : 'current'
    const query = {
      var: metric,
      granularity,
      ...(granularity === 'dekad' && period ? { period } : {}),
    }

    const [buffer, meta] = await Promise.all([
      harvestGetFieldRaster(rasterMode, parcelId, seasonId, query),
      harvestGetFieldRasterMeta(rasterMode, parcelId, seasonId, query),
    ])

    const image_url = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`
    const payload = {
      metric,
      granularity,
      period,
      image_url,
      bounds: meta.bounds || [[25.2, 51.1], [25.5, 51.4]],
      vmin: meta.vmin ?? 0,
      vmax: meta.vmax ?? 100,
      unit: meta.unit || '',
      legend: meta.legend || [],
    }

    return harvestJsonResponse(payload, false)
  } catch {
    const demoRaster = getDemoFieldRaster(parcelId, mode, metric, granularity, period)
    if (demoRaster) return harvestJsonResponse(demoRaster, true)
    return harvestErrorResponse(new Error('HARVEST_RASTER_UNAVAILABLE'))
  }
}
