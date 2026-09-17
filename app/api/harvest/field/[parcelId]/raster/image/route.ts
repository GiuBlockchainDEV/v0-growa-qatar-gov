import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldRaster } from '@/lib/harvest/client'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import { isLiveRasterMetric } from '@/lib/harvest/field-raster-fallback'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { fetchHarvestRasterBinary } from '@/lib/harvest/raster-fetch'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
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
  const rasterMode = (searchParams.get('raster_mode') || mode) as HarvestMode
  const metric = (searchParams.get('metric') || 'npp') as HarvestMetricKey
  const granularity = (searchParams.get('granularity') || 'dekad') as HarvestTrendGranularity
  const resolvedRasterMode = resolveHarvestDataMode(rasterMode, granularity)
  const period = searchParams.get('period')
  const seasonId = searchParams.get('season_id')

  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  if (access.demoMode) {
    const demoRaster = getDemoFieldRaster(parcelId, mode, metric, granularity, period)
    if (!demoRaster?.image_url) {
      return NextResponse.json({ error: 'Raster not available' }, { status: 404 })
    }

    const base64 = demoRaster.image_url.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Harvest-Demo': 'true',
      },
    })
  }

  if (!isLiveRasterMetric(metric)) {
    return NextResponse.json({ error: `Raster unavailable for metric "${metric}"` }, { status: 404 })
  }

  if (granularity === 'dekad' && !period) {
    return NextResponse.json({ error: 'period is required for dekad raster layers' }, { status: 400 })
  }

  try {
    const query = {
      var: metric,
      granularity,
      ...(granularity === 'dekad' && period ? { period } : {}),
    }

    let buffer: ArrayBuffer
    try {
      buffer = await harvestGetFieldRaster(resolvedRasterMode, parcelId, seasonId, query)
    } catch {
      const resolved = await fetchHarvestRasterBinary({
        mode: resolvedRasterMode,
        parcelId,
        seasonId,
        metric,
        granularity,
        period,
      })
      buffer = resolved.buffer
    }

    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty raster response from Harvest API' }, { status: 502 })
    }

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
