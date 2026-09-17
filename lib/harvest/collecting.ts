import { harvestGetCollectingEntities } from '@/lib/harvest/client'

export async function findHarvestCollectingTask(parcelId: string, seasonId?: number | null) {
  try {
    const entries = await harvestGetCollectingEntities()
    const list = Array.isArray(entries) ? entries : []
    const match = list.find((entry) => {
      if (entry.parcel_id !== parcelId) return false
      if (seasonId && Number.isFinite(seasonId)) return entry.season_id === seasonId
      return true
    })
    return match || null
  } catch {
    return null
  }
}
