import type { HarvestAnalyticsField } from '@/lib/harvest/types'

export function catalogFieldKey(field: HarvestAnalyticsField): string {
  return `${field.parcel_id}:${field.season_id ?? 'none'}`
}

export function deduplicateHarvestCatalogFields(fields: HarvestAnalyticsField[]): HarvestAnalyticsField[] {
  const seen = new Map<string, HarvestAnalyticsField>()
  for (const field of fields) {
    const key = catalogFieldKey(field)
    if (!seen.has(key)) {
      seen.set(key, field)
    }
  }
  return Array.from(seen.values())
}

export function resolveCatalogField(
  fields: HarvestAnalyticsField[],
  parcelId: string,
  seasonId?: number
): HarvestAnalyticsField | null {
  const matches = fields.filter((field) => field.parcel_id === parcelId)
  if (matches.length === 0) return null

  if (seasonId !== undefined && Number.isFinite(seasonId)) {
    return matches.find((field) => field.season_id === seasonId) ?? matches[0]
  }

  return matches[0]
}
