import { NextResponse } from 'next/server'
import { requireHarvestAccess } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetFieldRaster, harvestGetFieldRasterMeta } from '@/lib/harvest/client'
import { getDemoAnalyticsFields, getDemoFieldRaster } from '@/lib/harvest/demo-data'
import {
  buildFieldRasterFallback,
  isLiveRasterMetric,
} from '@/lib/harvest/field-raster-fallback'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMetricKey, HarvestMode, HarvestTrendGranularity } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

async function resolveFieldName(parcelId: string, mode: HarvestMode, demoMode: boolean) {
  const { payload } = await resolveHarvestPayload({
    demoMode,
    fetchLive: async () =>
      normalizePaginatedFieldsResponse(
        await harvestGetAnalyticsFields({
          mode,
          page: '1',
          perpage: '50',
          sort: 'name',
          order: 'asc',
        })
      ),
    fetchDemo: () => getDemoAnalyticsFields(mode),
    validateLive: (data) => data.results.length > 0,
  })

  return payload.results.find((field) => field.parcel_id === parcelId)?.name || 'Field'
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
  const seasonId = searchParams.get('season_id')

  if (!METRIC_KEYS.includes(metric)) {
    return NextResponse.json({ error: 'metric is invalid' }, { status: 400 })
  }

  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  const fieldName = await resolveFieldName(parcelId, mode, access.demoMode)

  if (access.demoMode) {
    const demoRaster = getDemoFieldRaster(parcelId, mode, metric, granularity, period)
    if (demoRaster) return harvestJsonResponse(demoRaster, true)
    const fallback = await buildFieldRasterFallback({
      parcelId,
      fieldName,
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

    if (!buffer.byteLength) {
      return NextResponse.json({ error: 'Empty raster response from Harvest API' }, { status: 502 })
    }

    const contentType = 'image/png'
    const image_url = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Harvest raster request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
