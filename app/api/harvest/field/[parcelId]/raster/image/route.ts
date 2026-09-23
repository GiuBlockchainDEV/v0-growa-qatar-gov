import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldRaster } from '@/lib/harvest/client'
import { harvestRasterModesToTry } from '@/lib/harvest/mode-resolve'
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
      ...(granularity === 'dekad' && period ? { period: period.match(/\d{4}-\d{2}-\d{2}/)?.[0] || period } : {}),
    }

    let buffer: ArrayBuffer | null = null
    let resolvedMode = mode
    let lastError: unknown = null
    for (const rasterMode of harvestRasterModesToTry(mode, granularity)) {
      try {
        const candidate = await harvestGetFieldRaster(rasterMode, parcelId, seasonId, query)
        if (candidate.byteLength > 0) {
          buffer = candidate
          resolvedMode = rasterMode
          break
        }
      } catch (error) {
        lastError = error
      }
    }

    if (!buffer) {
      throw lastError instanceof Error ? lastError : new Error('Harvest raster image unavailable')
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
        'Access-Control-Allow-Origin': '*',
        'X-Harvest-Raster-Mode': resolvedMode,
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
