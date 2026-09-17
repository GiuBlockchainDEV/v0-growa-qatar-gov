import { harvestGetAllFields, harvestGetEntity, harvestGetSeasons } from '@/lib/harvest/client'
import { getDemoAnalyticsFields } from '@/lib/harvest/demo-data'
import { normalizeEntityToField, normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

export async function resolveHarvestSeasonId(
  parcelId: string,
  mode: HarvestMode,
  demoMode: boolean,
  seasonIdParam?: string | null
): Promise<number | null> {
  if (seasonIdParam) {
    const parsed = Number(seasonIdParam)
    if (Number.isFinite(parsed)) return parsed
  }

  const { payload } = await resolveHarvestPayload({
    demoMode,
    fetchLive: async () =>
      normalizePaginatedFieldsResponse(
        await harvestGetAllFields({
          sort_by: 'harvest_date',
          sort_dir: 'desc',
        })
      ),
    fetchDemo: () => getDemoAnalyticsFields(mode),
    validateLive: (data) => data.results.length > 0,
  })

  const fromList = payload.results.find((field) => field.parcel_id === parcelId)?.season_id
  if (fromList && Number.isFinite(fromList)) return fromList

  if (demoMode) return null

  try {
    const entity = await harvestGetEntity(parcelId)
    const normalized = normalizeEntityToField(entity, parcelId)
    if (normalized?.season_id && Number.isFinite(normalized.season_id)) {
      return normalized.season_id
    }
    const record = entity && typeof entity === 'object' ? (entity as Record<string, unknown>) : null
    const currentSeasonId = record?.current_season_id
    if (typeof currentSeasonId === 'number' && Number.isFinite(currentSeasonId)) {
      return currentSeasonId
    }
  } catch {
    // fall through to seasons endpoint
  }

  try {
    const seasons = await harvestGetSeasons(parcelId)
    const list = Array.isArray(seasons) ? seasons : []
    const lastSeason = list[list.length - 1] as { id?: number } | undefined
    if (typeof lastSeason?.id === 'number' && Number.isFinite(lastSeason.id)) {
      return lastSeason.id
    }
  } catch {
    return null
  }

  return null
}
