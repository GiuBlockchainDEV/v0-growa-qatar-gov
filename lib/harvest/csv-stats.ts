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

const METRIC_ALIASES: Record<string, HarvestMetricKey> = {
  water_consumption: 'aeti',
  aeti_mm: 'aeti',
  et: 'aeti',
  npp_sum: 'npp',
  total_biomass_product: 'tbp',
  biomass: 'tbp',
  biomass_water_productivity: 'bwp',
}

function isHarvestMetricKey(value: string): value is HarvestMetricKey {
  return METRIC_KEYS.includes(value as HarvestMetricKey)
}

function resolveMetricKey(raw: string): HarvestMetricKey | null {
  const normalized = raw.trim().toLowerCase()
  if (isHarvestMetricKey(normalized)) return normalized
  return METRIC_ALIASES[normalized] || null
}

export function normalizeHarvestPeriodDate(raw: string): string {
  const match = raw.trim().match(/\d{4}-\d{2}-\d{2}/)
  return match?.[0] || raw.trim()
}

function classifyStatsGranularity(
  granularityRaw: string,
  periodStart: string,
  periodEnd: string
): 'dekad' | 'season' | null {
  const granularity = granularityRaw.trim().toLowerCase()
  if (['season', 'seasonal', 'season_total', 'total'].includes(granularity)) return 'season'
  if (['dekad', 'dekadal', 'dekads', '10d', '10-day'].includes(granularity)) return 'dekad'

  const start = Date.parse(normalizeHarvestPeriodDate(periodStart))
  const end = Date.parse(normalizeHarvestPeriodDate(periodEnd))
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const days = (end - start) / 86_400_000
    if (days > 16) return 'season'
    if (days >= 0) return 'dekad'
  }

  if (!granularity || granularity === 'dekad') return 'dekad'
  return null
}

function finalizeSeries(
  series: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>,
  cumulativeMetrics: Set<HarvestMetricKey>
) {
  for (const metric of METRIC_KEYS) {
    const points = series[metric]
    if (!points?.length) continue
    const byPeriod = new Map<string, number>()
    for (const point of points) {
      byPeriod.set(normalizeHarvestPeriodDate(point.period), point.value)
    }
    const sorted = Array.from(byPeriod.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([period, value]) => ({ period, value }))

    series[metric] = cumulativeMetrics.has(metric) ? incrementsFromCumulative(sorted) : sorted
  }
}

function incrementsFromCumulative(points: HarvestTimeseriesPoint[]) {
  let previous = 0
  return points.map((point) => {
    const increment = point.value - previous
    previous = point.value
    return { period: point.period, value: Math.round(increment * 1000) / 1000 }
  })
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
  const cumulativeDekadMetrics = new Set<HarvestMetricKey>()
  const periods = new Map<string, HarvestFieldPeriodOption>()

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const granularityRaw = granularityIndex >= 0 ? cells[granularityIndex] || '' : ''
    const metric = metricIndex >= 0 ? resolveMetricKey(cells[metricIndex] || '') : null
    if (!metric) continue

    const periodStart = periodStartIndex >= 0 ? cells[periodStartIndex] || '' : ''
    const periodEnd = periodEndIndex >= 0 ? cells[periodEndIndex] || '' : ''
    const bucket = classifyStatsGranularity(granularityRaw, periodStart, periodEnd)
    if (!bucket) continue

    const periodDate = normalizeHarvestPeriodDate(periodStart)
    const periodLabel = periodEnd ? `${periodDate} / ${normalizeHarvestPeriodDate(periodEnd)}` : periodDate
    if (bucket === 'dekad' && periodDate) {
      periods.set(periodDate, { value: periodDate, label: periodLabel })
    }

    const periodValue = toMetricValue(valueIndex >= 0 ? cells[valueIndex] : undefined)
    const cumulativeValue =
      toMetricValue(cumulativeValueIndex >= 0 ? cells[cumulativeValueIndex] : undefined) ??
      toMetricValue(totalValueIndex >= 0 ? cells[totalValueIndex] : undefined)
    const value = periodValue ?? cumulativeValue
    if (value === undefined) continue
    if (bucket === 'dekad' && periodValue === undefined && cumulativeValue !== undefined) {
      cumulativeDekadMetrics.add(metric)
    }

    appendPoint(bucket === 'season' ? seasonSeries : dekadSeries, metric, bucket === 'season' ? 'Season total' : periodDate, value)
  }

  finalizeSeries(dekadSeries, cumulativeDekadMetrics)
  finalizeSeries(seasonSeries, new Set())

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
    const granularityRaw = granularityIndex >= 0 ? cells[granularityIndex] || '' : ''
    const periodStart = periodStartIndex >= 0 ? cells[periodStartIndex] || '' : ''
    const periodEnd = periodEndIndex >= 0 ? cells[periodEndIndex] || '' : ''
    const bucket = classifyStatsGranularity(granularityRaw, periodStart, periodEnd)
    if (!bucket) continue

    const periodDate = normalizeHarvestPeriodDate(periodStart)
    const periodLabel = periodEnd ? `${periodDate} / ${normalizeHarvestPeriodDate(periodEnd)}` : periodDate
    if (bucket === 'dekad' && periodDate) {
      periods.set(periodDate, { value: periodDate, label: periodLabel })
    }

    for (const metric of METRIC_KEYS) {
      const columnIndex = metricColumns[metric]
      if (columnIndex < 0) continue
      const value = toMetricValue(cells[columnIndex])
      if (value === undefined) continue
      appendPoint(
        bucket === 'season' ? seasonSeries : dekadSeries,
        metric,
        bucket === 'season' ? 'Season total' : periodDate,
        value
      )
    }
  }

  finalizeSeries(dekadSeries, new Set())
  finalizeSeries(seasonSeries, new Set())

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

  const baseDekadCount = Object.values(base.timeseries.dekad).reduce(
    (count, points) => count + (points?.length || 0),
    0
  )
  const overlayDekadCount = Object.values(overlay.timeseries.dekad).reduce(
    (count, points) => count + (points?.length || 0),
    0
  )
  const periods = new Map<string, HarvestFieldPeriodOption>()
  for (const period of [...base.periods, ...overlay.periods]) {
    periods.set(period.value, period)
  }

  return {
    ...base,
    periods: Array.from(periods.values()).sort((left, right) => left.value.localeCompare(right.value)),
    timeseries: {
      dekad: overlayDekadCount > baseDekadCount ? overlay.timeseries.dekad : base.timeseries.dekad,
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
