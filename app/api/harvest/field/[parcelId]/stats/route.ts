import { NextResponse } from 'next/server'
import { requireHarvestAccess, harvestErrorResponse } from '@/lib/harvest/auth'
import { findHarvestCollectingTask } from '@/lib/harvest/collecting'
import { harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import { parseHarvestFieldStatsCsv } from '@/lib/harvest/csv-stats'
import { getDemoFieldStats } from '@/lib/harvest/demo-data'
import { listHarvestSeasonIds, resolveHarvestSeasonId } from '@/lib/harvest/season-resolve'
import { harvestJsonResponse } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

interface RouteContext {
  params: Promise<{ parcelId: string }>
}

async function loadLiveFieldStats(
  parcelId: string,
  seasonId: number,
  mode: HarvestMode
) {
  const csv = await harvestGetFieldStatsCsv(mode, parcelId, seasonId)
  const stats = parseHarvestFieldStatsCsv(csv, { parcel_id: parcelId, season_id: seasonId })
  const hasPoints = Object.values(stats.timeseries.dekad).some((points) => (points?.length || 0) > 0)
    || Object.values(stats.timeseries.season).some((points) => (points?.length || 0) > 0)
  return { stats, hasPoints }
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
    const modesToTry: HarvestMode[] = mode === 'predict' ? ['predict', 'current'] : [mode]

    for (const trySeasonId of seasonIds) {
      for (const statsMode of modesToTry) {
        try {
          const { stats, hasPoints } = await loadLiveFieldStats(parcelId, trySeasonId, statsMode)
          if (hasPoints) {
            return harvestJsonResponse(
              {
                ...stats,
                requested_season_id: requestedSeasonId,
                resolved_season_id: trySeasonId,
              },
              false
            )
          }
        } catch {
          // try next mode/season
        }
      }
    }

    const demoStats = getDemoFieldStats(parcelId, mode)
    if (demoStats) return harvestJsonResponse(demoStats, true)

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
