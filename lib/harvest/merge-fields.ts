import type { HarvestAnalyticsField, HarvestFieldMetrics } from '@/lib/harvest/types'

function metricsKey(field: HarvestAnalyticsField) {
  return `${field.parcel_id}:${field.season_id ?? 'none'}`
}

export function mergeHarvestFieldsWithAnalytics(
  baseFields: HarvestAnalyticsField[],
  analyticsFields: HarvestAnalyticsField[]
): HarvestAnalyticsField[] {
  const analyticsByParcel = new Map<string, HarvestAnalyticsField>()
  const analyticsByKey = new Map<string, HarvestAnalyticsField>()

  for (const field of analyticsFields) {
    analyticsByParcel.set(field.parcel_id, field)
    analyticsByKey.set(metricsKey(field), field)
  }

  const merged = baseFields.map((field) => {
    const keyedMatch = analyticsByKey.get(metricsKey(field))
    const parcelMatch = keyedMatch ? null : analyticsByParcel.get(field.parcel_id)
    const analyticsMatch = keyedMatch || parcelMatch
    if (!analyticsMatch) return field

    const metrics: HarvestFieldMetrics = {
      ...(field.metrics || {}),
      ...(analyticsMatch.metrics || {}),
    }

    const season_id = field.season_id ?? analyticsMatch.season_id

    return {
      ...field,
      season_id,
      crop: field.crop && field.crop !== '—' ? field.crop : analyticsMatch.crop,
      cultivation: field.cultivation ?? analyticsMatch.cultivation,
      area: field.area > 0 ? field.area : analyticsMatch.area,
      start_date: field.start_date || analyticsMatch.start_date,
      harvest_date: field.harvest_date || analyticsMatch.harvest_date,
      metrics,
    }
  })

  const seen = new Set(merged.map((field) => field.parcel_id))
  for (const field of analyticsFields) {
    if (seen.has(field.parcel_id)) continue
    seen.add(field.parcel_id)
    merged.push(field)
  }

  return merged
}
