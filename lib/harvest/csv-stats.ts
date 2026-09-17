import type { HarvestMetricKey, HarvestTimeseriesPoint } from '@/lib/harvest/types'

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

export interface HarvestFieldPeriodOption {
  value: string
  label: string
}

export interface HarvestFieldStatsResponse {
  parcel_id: string
  season_id: number
  periods: HarvestFieldPeriodOption[]
  timeseries: {
    dekad: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
    season: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  values.push(current.trim())
  return values
}

function toMetricValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function resolveMetricColumn(headers: string[], metric: HarvestMetricKey): number {
  const candidates = [metric, `${metric}_sum`, `${metric}_mean`, `${metric}_value`]
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate)
    if (index >= 0) return index
  }
  return -1
}

function isHarvestMetricKey(value: string): value is HarvestMetricKey {
  return METRIC_KEYS.includes(value as HarvestMetricKey)
}

function appendPoint(
  target: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>,
  metric: HarvestMetricKey,
  period: string,
  value: number
) {
  if (!target[metric]) target[metric] = []
  target[metric]!.push({ period, value })
}

function parseLongFormatStatsCsv(
  lines: string[],
  headers: string[]
): Pick<HarvestFieldStatsResponse, 'periods' | 'timeseries'> {
  const granularityIndex = headers.indexOf('granularity')
  const metricIndex = headers.indexOf('metric')
  const periodStartIndex = headers.indexOf('period_start')
  const periodEndIndex = headers.indexOf('period_end')
  const valueIndex = headers.indexOf('value')
  const cumulativeValueIndex = headers.indexOf('cumulative_value')
  const totalValueIndex = headers.indexOf('total_value')

  const dekadSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const seasonSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const periods = new Map<string, HarvestFieldPeriodOption>()

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const granularity = granularityIndex >= 0 ? cells[granularityIndex] : 'dekad'
    const metricRaw = metricIndex >= 0 ? cells[metricIndex]?.trim().toLowerCase() : ''
    if (!isHarvestMetricKey(metricRaw)) continue

    const periodStart = periodStartIndex >= 0 ? cells[periodStartIndex] : ''
    const periodEnd = periodEndIndex >= 0 ? cells[periodEndIndex] : ''
    const periodLabel = periodEnd ? `${periodStart} / ${periodEnd}` : periodStart

    if (granularity === 'dekad' && periodStart) {
      periods.set(periodStart, { value: periodStart, label: periodLabel })
    }

    const value =
      toMetricValue(valueIndex >= 0 ? cells[valueIndex] : undefined) ??
      toMetricValue(cumulativeValueIndex >= 0 ? cells[cumulativeValueIndex] : undefined) ??
      toMetricValue(totalValueIndex >= 0 ? cells[totalValueIndex] : undefined)
    if (value === undefined) continue

    const target =
      granularity === 'season'
        ? seasonSeries
        : granularity === 'dekad'
          ? dekadSeries
          : null
    if (!target) continue

    appendPoint(
      target,
      metricRaw,
      granularity === 'season' ? 'Season total' : periodStart,
      value
    )
  }

  const sortedPeriods = Array.from(periods.values()).sort((left, right) =>
    left.value.localeCompare(right.value)
  )

  return {
    periods: sortedPeriods,
    timeseries: {
      dekad: dekadSeries,
      season: seasonSeries,
    },
  }
}

function parseWideFormatStatsCsv(
  lines: string[],
  headers: string[]
): Pick<HarvestFieldStatsResponse, 'periods' | 'timeseries'> {
  const granularityIndex = headers.indexOf('granularity')
  const periodStartIndex = headers.indexOf('period_start')
  const periodEndIndex = headers.indexOf('period_end')
  const metricColumns = METRIC_KEYS.reduce(
    (acc, metric) => {
      acc[metric] = resolveMetricColumn(headers, metric)
      return acc
    },
    {} as Record<HarvestMetricKey, number>
  )

  const dekadSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const seasonSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const periods = new Map<string, HarvestFieldPeriodOption>()

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const granularity = granularityIndex >= 0 ? cells[granularityIndex] : 'dekad'
    const periodStart = periodStartIndex >= 0 ? cells[periodStartIndex] : ''
    const periodEnd = periodEndIndex >= 0 ? cells[periodEndIndex] : ''
    const periodLabel = periodEnd ? `${periodStart} / ${periodEnd}` : periodStart

    if (granularity === 'dekad' && periodStart) {
      periods.set(periodStart, { value: periodStart, label: periodLabel })
    }

    const target =
      granularity === 'season'
        ? seasonSeries
        : granularity === 'dekad'
          ? dekadSeries
          : null
    if (!target) continue

    for (const metric of METRIC_KEYS) {
      const columnIndex = metricColumns[metric]
      if (columnIndex < 0) continue
      const value = toMetricValue(cells[columnIndex])
      if (value === undefined) continue
      appendPoint(
        target,
        metric,
        granularity === 'season' ? 'Season total' : periodStart,
        value
      )
    }
  }

  const sortedPeriods = Array.from(periods.values()).sort((left, right) =>
    left.value.localeCompare(right.value)
  )

  return {
    periods: sortedPeriods,
    timeseries: {
      dekad: dekadSeries,
      season: seasonSeries,
    },
  }
}

export function mergeHarvestFieldStats(
  base: HarvestFieldStatsResponse,
  overlay: HarvestFieldStatsResponse
): HarvestFieldStatsResponse {
  const mergedSeason: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {
    ...base.timeseries.season,
  }

  for (const [metric, points] of Object.entries(overlay.timeseries.season)) {
    if (points && points.length > 0) {
      mergedSeason[metric as HarvestMetricKey] = points
    }
  }

  return {
    ...base,
    periods: base.periods.length > 0 ? base.periods : overlay.periods,
    timeseries: {
      dekad: Object.keys(base.timeseries.dekad).length > 0
        ? base.timeseries.dekad
        : overlay.timeseries.dekad,
      season: mergedSeason,
    },
  }
}

export function hasHarvestFieldStatsPoints(stats: HarvestFieldStatsResponse) {
  const dekadHasPoints = Object.values(stats.timeseries.dekad).some((points) => (points?.length || 0) > 0)
  const seasonHasPoints = Object.values(stats.timeseries.season).some((points) => (points?.length || 0) > 0)
  return dekadHasPoints || seasonHasPoints
}

export function parseHarvestFieldStatsCsv(
  csv: string,
  meta: { parcel_id: string; season_id: number }
): HarvestFieldStatsResponse {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    return {
      parcel_id: meta.parcel_id,
      season_id: meta.season_id,
      periods: [],
      timeseries: { dekad: {}, season: {} },
    }
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase())
  const parsed =
    headers.includes('metric')
      ? parseLongFormatStatsCsv(lines, headers)
      : parseWideFormatStatsCsv(lines, headers)

  return {
    parcel_id: meta.parcel_id,
    season_id: meta.season_id,
    periods: parsed.periods,
    timeseries: parsed.timeseries,
  }
}
