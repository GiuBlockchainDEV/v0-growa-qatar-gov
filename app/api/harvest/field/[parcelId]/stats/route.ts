import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { findHarvestCollectingTask } from '@/lib/harvest/collecting'
import { harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import {
  hasHarvestFieldStatsPoints,
  mergeHarvestFieldStats,
  parseHarvestFieldStatsCsv,
} from '@/lib/harvest/csv-stats'
import { getDemoFieldStats } from '@/lib/harvest/demo-data'
import { harvestStatsModesToTry } from '@/lib/harvest/mode-resolve'
import { listHarvestSeasonIds, resolveHarvestSeasonId } from '@/lib/harvest/season-resolve'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { HarvestFieldStatsResponse, HarvestMode } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

async function loadLiveFieldStats(
  parcelId: string,
  seasonId: number,
  mode: HarvestMode
): Promise<HarvestFieldStatsResponse | null> {
  const modesToTry = harvestStatsModesToTry(mode)
  let merged: HarvestFieldStatsResponse | null = null

  for (const statsMode of modesToTry) {
    try {
      const csv = await harvestGetFieldStatsCsv(statsMode, parcelId, seasonId)
      const stats = parseHarvestFieldStatsCsv(csv, { parcel_id: parcelId, season_id: seasonId })
      if (!hasHarvestFieldStatsPoints(stats)) continue
      merged = merged ? mergeHarvestFieldStats(merged, stats) : stats
    } catch {
      // try next mode
    }
  }

  return merged
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
    const requestedSeasonId = await resolveHarvestSeasonId(
      parcelId,
      mode,
      access.demoMode,
      seasonIdParam
    )
    if (!Number.isFinite(requestedSeasonId)) {
      return NextResponse.json({ error: 'Field season not found' }, { status: 404 })
    }

    if (access.demoMode) {
      const demoStats = getDemoFieldStats(parcelId, mode)
      if (!demoStats) {
        return NextResponse.json({ error: 'Field not found' }, { status: 404 })
      }
      return harvestJsonResponse(demoStats, true)
    }

    const seasonIds = await listHarvestSeasonIds(parcelId, requestedSeasonId)

    for (const trySeasonId of seasonIds) {
      const stats = await loadLiveFieldStats(parcelId, trySeasonId, mode)
      if (stats && hasHarvestFieldStatsPoints(stats)) {
        return harvestJsonResponse(
          {
            ...stats,
            requested_season_id: requestedSeasonId,
            resolved_season_id: trySeasonId,
          },
          false
        )
      }
    }

    const collecting = await findHarvestCollectingTask(parcelId, requestedSeasonId)
    return NextResponse.json(
      {
        error: 'Field statistics are not available yet',
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
          : 'Geospatial data may still be collecting. Try again after the entity collection task completes.',
      },
      { status: 404 }
    )
  } catch (error) {
    return harvestErrorResponse(error)
  }
}
