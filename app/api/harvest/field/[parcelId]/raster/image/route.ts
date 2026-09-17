import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldRaster } from '@/lib/harvest/client'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import { isLiveRasterMetric } from '@/lib/harvest/field-raster-fallback'
import { resolveHarvestDataMode } from '@/lib/harvest/mode-resolve'
import { listHarvestSeasonIds } from '@/lib/harvest/season-resolve'
import { readRasterImageDimensions } from '@/lib/harvest/raster-image'
import { fetchHarvestRasterBinary, fetchHarvestRasterMeta } from '@/lib/harvest/view-fetch'
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
    const seasonIds = await listHarvestSeasonIds(parcelId, Number(seasonId))
    const meta = await fetchHarvestRasterMeta({
      mode: resolvedRasterMode,
      parcelId,
      seasonId,
      metric,
      granularity,
      period,
      seasonIds,
    })

    if (meta.imageSource === 'view') {
      return NextResponse.redirect(
        new URL(
          `/api/harvest/field/${parcelId}/view/${meta.imageFilename}?mode=${meta.rasterMode}&season_id=${meta.resolvedSeasonId ?? seasonId}`,
          request.url
        ),
        307
      )
    }

    const query = {
      var: metric,
      granularity: meta.granularity,
      ...(meta.granularity === 'dekad' && meta.period ? { period: meta.period } : {}),
    }

    let buffer: ArrayBuffer
    try {
      buffer = await harvestGetFieldRaster(meta.rasterMode, parcelId, meta.resolvedSeasonId ?? seasonId, query)
    } catch {
      buffer = await fetchHarvestRasterBinary({ meta, parcelId, metric })
    }

    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty raster response from Harvest API' }, { status: 502 })
    }

    const imageBuffer = Buffer.from(buffer)
    const dimensions = await readRasterImageDimensions(imageBuffer)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        ...(dimensions
          ? {
              'X-Harvest-Raster-Width': String(dimensions.width),
              'X-Harvest-Raster-Height': String(dimensions.height),
            }
          : {}),
      },
    })
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
