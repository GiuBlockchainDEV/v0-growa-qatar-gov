import { harvestGetFieldStatsCsv } from '@/lib/harvest/client'
import { parseHarvestFieldStatsCsv } from '@/lib/harvest/csv-stats'
import { harvestStatsModesToTry } from '@/lib/harvest/mode-resolve'
import type {
  HarvestAnalyticsField,
  HarvestFieldMetrics,
  HarvestFieldStatsResponse,
  HarvestMetricKey,
  HarvestMode,
} from '@/lib/harvest/types'

export const FIELD_KPI_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

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

export function hasSeasonFieldStats(stats: HarvestFieldStatsResponse) {
  return Object.values(stats.timeseries.season).some((points) => (points?.length || 0) > 0)
}

export function metricsFromFieldStats(stats: HarvestFieldStatsResponse): HarvestFieldMetrics {
  const metrics: HarvestFieldMetrics = {}

  for (const key of FIELD_KPI_METRICS) {
    const seasonValue = stats.timeseries.season[key]?.at(-1)?.value
    if (seasonValue !== undefined && Number.isFinite(seasonValue)) {
      metrics[key] = seasonValue
    }
  }

  return metrics
}

export function fillMissingHarvestMetrics(
  existing: HarvestFieldMetrics | undefined,
  incoming: HarvestFieldMetrics
): HarvestFieldMetrics {
  const metrics: HarvestFieldMetrics = { ...(existing || {}) }
  for (const key of FIELD_KPI_METRICS) {
    const current = metrics[key]
    const next = incoming[key]
    if ((current === undefined || !Number.isFinite(current)) && next !== undefined && Number.isFinite(next)) {
      metrics[key] = next
    }
  }
  return metrics
}

export function mergeSeasonMetrics(
  existing: HarvestFieldMetrics | undefined,
  seasonMetrics: HarvestFieldMetrics
): HarvestFieldMetrics {
  if (Object.keys(seasonMetrics).length === 0) return existing || {}
  return {
    ...(existing || {}),
    ...seasonMetrics,
  }
}

function applySeasonMetricsToField(
  field: HarvestAnalyticsField,
  seasonMetrics: HarvestFieldMetrics
): HarvestAnalyticsField {
  if (Object.keys(seasonMetrics).length === 0) return field
  return { ...field, metrics: fillMissingHarvestMetrics(field.metrics, seasonMetrics) }
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
      if (!hasSeasonFieldStats(stats)) continue
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
    .filter(({ field }) => field.season_id !== undefined && Number.isFinite(field.season_id))

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
    return applySeasonMetricsToField(field, statsMetrics)
  })
}
