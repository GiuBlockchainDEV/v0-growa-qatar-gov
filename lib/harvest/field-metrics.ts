import { harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import { parseHarvestFieldStatsCsv, hasHarvestFieldStatsPoints } from '@/lib/harvest/csv-stats'
import { harvestStatsModesToTry } from '@/lib/harvest/mode-resolve'
import type { HarvestAnalyticsField, HarvestFieldMetrics, HarvestFieldStatsResponse, HarvestMetricKey, HarvestMode } from '@/lib/harvest/types'

const TABLE_METRICS: HarvestMetricKey[] = ['aeti', 'tbp', 'bwp']

export function missingHarvestTableMetrics(metrics?: HarvestFieldMetrics): HarvestMetricKey[] {
  return TABLE_METRICS.filter((key) => {
    const value = metrics?.[key]
    return value === undefined || !Number.isFinite(value)
  })
}

export function hasHarvestTableMetrics(metrics?: HarvestFieldMetrics) {
  return missingHarvestTableMetrics(metrics).length === 0
}

export function metricsFromFieldStats(stats: HarvestFieldStatsResponse): HarvestFieldMetrics {
  const metrics: HarvestFieldMetrics = {}

  for (const key of TABLE_METRICS) {
    const seasonValue = stats.timeseries.season[key]?.at(-1)?.value
    const dekadValue = stats.timeseries.dekad[key]?.at(-1)?.value
    const value = seasonValue ?? dekadValue
    if (value !== undefined && Number.isFinite(value)) {
      metrics[key] = value
    }
  }

  return metrics
}

async function loadFieldStatsMetrics(
  field: HarvestAnalyticsField,
  mode: HarvestMode
): Promise<HarvestFieldMetrics> {
  const seasonId = field.season_id
  if (!seasonId || !Number.isFinite(seasonId)) return {}

  for (const statsMode of harvestStatsModesToTry(mode)) {
    try {
      const csv = await harvestGetFieldStatsCsv(statsMode, field.parcel_id, seasonId)
      const stats = parseHarvestFieldStatsCsv(csv, {
        parcel_id: field.parcel_id,
        season_id: seasonId,
      })
      if (!hasHarvestFieldStatsPoints(stats)) continue
      const metrics = metricsFromFieldStats(stats)
      if (Object.keys(metrics).length > 0) return metrics
    } catch {
      // try next mode
    }
  }

  return {}
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function enrichHarvestFieldsWithStats(
  fields: HarvestAnalyticsField[],
  mode: HarvestMode,
  concurrency = 4
): Promise<HarvestAnalyticsField[]> {
  const targets = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => missingHarvestTableMetrics(field.metrics).length > 0)

  if (targets.length === 0) return fields

  const enrichedMetrics = await mapWithConcurrency(targets, concurrency, async ({ field }) => {
    const metrics = await loadFieldStatsMetrics(field, mode)
    return { parcel_id: field.parcel_id, metrics }
  })

  const metricsByParcel = new Map(
    enrichedMetrics
      .filter((entry) => Object.keys(entry.metrics).length > 0)
      .map((entry) => [entry.parcel_id, entry.metrics])
  )

  if (metricsByParcel.size === 0) return fields

  return fields.map((field) => {
    const statsMetrics = metricsByParcel.get(field.parcel_id)
    if (!statsMetrics) return field
    return {
      ...field,
      metrics: {
        ...(field.metrics || {}),
        ...statsMetrics,
      },
    }
  })
}
