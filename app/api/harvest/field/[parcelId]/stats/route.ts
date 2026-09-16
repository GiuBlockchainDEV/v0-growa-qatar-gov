import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetAnalyticsFields, harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import { parseHarvestFieldStatsCsv } from '@/lib/harvest/csv-stats'
import { getDemoAnalyticsFields, getDemoFieldStats } from '@/lib/harvest/demo-data'
import { normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { harvestJsonResponse, resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

async function resolveFieldSeasonId(parcelId: string, mode: HarvestMode, demoMode: boolean) {
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

  const field = payload.results.find((entry) => entry.parcel_id === parcelId)
  return field?.season_id ?? null
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
  const seasonIdParam = searchParams.get('season_id')

  try {
    const seasonIdFromList = await resolveFieldSeasonId(parcelId, mode, access.demoMode)
    const seasonId = Number(seasonIdParam || seasonIdFromList)
    if (!Number.isFinite(seasonId)) {
      return NextResponse.json({ error: 'Field season not found' }, { status: 404 })
    }

    if (access.demoMode) {
      const demoStats = getDemoFieldStats(parcelId, mode)
      if (!demoStats) {
        return NextResponse.json({ error: 'Field not found' }, { status: 404 })
      }
      return harvestJsonResponse(demoStats, true)
    }

    try {
      const csv = await harvestGetFieldStatsCsv(mode, parcelId, seasonId)
      const stats = parseHarvestFieldStatsCsv(csv, { parcel_id: parcelId, season_id: seasonId })
      const hasPoints = Object.values(stats.timeseries.dekad).some((points) => (points?.length || 0) > 0)
      if (!hasPoints) {
        const demoStats = getDemoFieldStats(parcelId, mode)
        if (demoStats) return harvestJsonResponse(demoStats, true)
      }
      return harvestJsonResponse(stats, false)
    } catch {
      const demoStats = getDemoFieldStats(parcelId, mode)
      if (demoStats) return harvestJsonResponse(demoStats, true)
      throw new Error('HARVEST_FIELD_STATS_UNAVAILABLE')
    }
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
