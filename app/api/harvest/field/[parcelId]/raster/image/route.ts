import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldRaster } from '@/lib/harvest/client'
import { getDemoFieldRaster } from '@/lib/harvest/demo-data'
import { isLiveRasterMetric } from '@/lib/harvest/field-raster-fallback'
import { readRasterImageDimensions } from '@/lib/harvest/raster-image'
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
  const metric = (searchParams.get('metric') || 'npp') as HarvestMetricKey
  const granularity = (searchParams.get('granularity') || 'season') as HarvestTrendGranularity
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
        'Access-Control-Allow-Origin': '*',
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

    const buffer = await harvestGetFieldRaster(mode, parcelId, seasonId, query)

    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty raster response from Harvest API' }, { status: 502 })
    }

    const imageBuffer = Buffer.from(buffer)
    const dimensions = await readRasterImageDimensions(imageBuffer)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'X-Harvest-Raster-Mode': mode,
        'X-Harvest-Raster-Source': 'entity/raster',
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
