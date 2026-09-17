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

  return baseFields.map((field) => {
    const analyticsMatch =
      analyticsByKey.get(metricsKey(field)) || analyticsByParcel.get(field.parcel_id)
    if (!analyticsMatch) return field

    const metrics: HarvestFieldMetrics = {
      ...(analyticsMatch.metrics || {}),
      ...(field.metrics || {}),
    }

    return {
      ...field,
      season_id: field.season_id ?? analyticsMatch.season_id,
      crop: field.crop && field.crop !== '—' ? field.crop : analyticsMatch.crop,
      cultivation: field.cultivation ?? analyticsMatch.cultivation,
      area: field.area > 0 ? field.area : analyticsMatch.area,
      start_date: field.start_date || analyticsMatch.start_date,
      harvest_date: field.harvest_date || analyticsMatch.harvest_date,
      metrics,
    }
  })
}
