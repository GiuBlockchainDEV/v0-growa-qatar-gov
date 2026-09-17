import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import { parseHarvestFieldStatsCsv } from '@/lib/harvest/csv-stats'
import { getDemoFieldStats } from '@/lib/harvest/demo-data'
import { resolveHarvestSeasonId } from '@/lib/harvest/season-resolve'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

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
  const seasonIdParam = searchParams.get('season_id')

  try {
    const seasonId = await resolveHarvestSeasonId(
      parcelId,
      mode,
      access.demoMode,
      seasonIdParam
    )
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
