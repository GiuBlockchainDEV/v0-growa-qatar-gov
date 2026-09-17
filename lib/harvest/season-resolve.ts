import { harvestGetAllFields, harvestGetEntity, harvestGetSeasons } from '@/lib/harvest/client'
import { getDemoAnalyticsFields } from '@/lib/harvest/demo-data'
import { normalizeEntityToField, normalizePaginatedFieldsResponse } from '@/lib/harvest/normalize'
import { resolveHarvestPayload } from '@/lib/harvest/resolve'
import type { HarvestMode } from '@/lib/harvest/types'

function dedupeSeasonIds(ids: Array<number | null | undefined>): number[] {
  const seen = new Set<number>()
  const result: number[] = []

  for (const id of ids) {
    if (typeof id !== 'number' || !Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}

export async function listHarvestSeasonIds(
  parcelId: string,
  preferredSeasonId?: number | null
): Promise<number[]> {
  const candidates: Array<number | null | undefined> = [preferredSeasonId]

  try {
    const entity = await harvestGetEntity(parcelId)
    const normalized = normalizeEntityToField(entity, parcelId)
    if (normalized?.season_id) candidates.push(normalized.season_id)

    const record = entity && typeof entity === 'object' ? (entity as Record<string, unknown>) : null
    const currentSeasonId = record?.current_season_id
    if (typeof currentSeasonId === 'number') candidates.push(currentSeasonId)

    const seasonsRaw = Array.isArray(record?.seasons) ? record.seasons : []
    for (const season of seasonsRaw) {
      const seasonRecord =
        season && typeof season === 'object' ? (season as Record<string, unknown>) : null
      const id = seasonRecord?.id
      if (typeof id === 'number') candidates.push(id)
    }
  } catch {
    // fall through to seasons endpoint
  }

  try {
    const seasons = await harvestGetSeasons(parcelId)
    const list = Array.isArray(seasons) ? seasons : []
    for (const season of list) {
      const seasonRecord =
        season && typeof season === 'object' ? (season as Record<string, unknown>) : null
      const id = seasonRecord?.id
      if (typeof id === 'number') candidates.push(id)
    }
  } catch {
    // no seasons available
  }

  return dedupeSeasonIds(candidates)
}

export async function resolveHarvestSeasonId(
  parcelId: string,
  mode: HarvestMode,
  demoMode: boolean,
  seasonIdParam?: string | null
): Promise<number | null> {
  const preferredSeasonId = seasonIdParam ? Number(seasonIdParam) : null
  if (preferredSeasonId && Number.isFinite(preferredSeasonId)) {
    return preferredSeasonId
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

  const seasonIds = await listHarvestSeasonIds(parcelId)
  return seasonIds[0] ?? null
}
