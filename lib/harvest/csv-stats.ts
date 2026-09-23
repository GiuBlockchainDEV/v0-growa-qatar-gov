import type { HarvestMetricKey, HarvestTimeseriesPoint } from '@/lib/harvest/types'

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']
const ADDITIVE_METRICS = new Set<HarvestMetricKey>(['aeti', 'npp', 'tbp', 'cost'])
const PERIOD_START_HEADERS = ['period_start', 'start_date', 'startdate', 'date', 'time', 'timestamp', 'dekad_start', 'period', 'from']
const PERIOD_END_HEADERS = ['period_end', 'end_date', 'enddate', 'to']
const GRANULARITY_HEADERS = ['granularity', 'grain', 'interval', 'resolution', 'frequency']
const METRIC_NAME_HEADERS = ['metric', 'variable', 'indicator']
const VALUE_HEADERS = ['value', 'metric_value', 'val', 'amount']
const CUMULATIVE_HEADERS = ['cumulative_value', 'cumulative', 'running_total', 'cumsum', 'total_value']

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

function detectDelimiter(headerLine: string) {
  const commas = (headerLine.match(/,/g) || []).length
  const semicolons = (headerLine.match(/;/g) || []).length
  return semicolons > commas ? ';' : ','
}

function parseCsvLine(line: string, delimiter = ','): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === delimiter && !inQuotes) {
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

function findHeader(headers: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate)
    if (index >= 0) return index
  }
  return -1
}

function findFirstHeader(headers: string[], names: string[]) {
  for (const name of names) {
    const index = headers.indexOf(name)
    if (index >= 0) return index
  }
  return -1
}

const EXTRA_SUM_COLUMNS: Partial<Record<HarvestMetricKey, string[]>> = {
  aeti: ['water_consumption_m3', 'aeti_m3', 'water_consumption'],
  npp: ['npp_total'],
  tbp: ['total_biomass_product', 'biomass_product'],
  cost: ['irrigation_cost'],
}

function resolveMetricColumn(headers: string[], metric: HarvestMetricKey): { index: number; cumulative: boolean } {
  const sumNames = [`${metric}_sum`, `${metric}_total`, ...(EXTRA_SUM_COLUMNS[metric] || [])]
  const meanNames = [`${metric}_mean`, `${metric}_avg`, `${metric}_average`]
  const cumulativeNames = [`${metric}_cumulative`, `${metric}_cumsum`, `${metric}_running`]
  const exactNames = [metric, `${metric}_value`]

  if (ADDITIVE_METRICS.has(metric)) {
    const sumIndex = findFirstHeader(headers, sumNames)
    if (sumIndex >= 0) return { index: sumIndex, cumulative: false }
    const cumulativeIndex = findFirstHeader(headers, cumulativeNames)
    if (cumulativeIndex >= 0) return { index: cumulativeIndex, cumulative: true }
    const exactIndex = findFirstHeader(headers, exactNames)
    if (exactIndex >= 0) return { index: exactIndex, cumulative: false }
    const meanIndex = findFirstHeader(headers, meanNames)
    if (meanIndex >= 0) return { index: meanIndex, cumulative: false }
    return { index: -1, cumulative: false }
  }

  const meanIndex = findFirstHeader(headers, meanNames)
  if (meanIndex >= 0) return { index: meanIndex, cumulative: false }
  const exactIndex = findFirstHeader(headers, exactNames)
  if (exactIndex >= 0) return { index: exactIndex, cumulative: false }
  const sumIndex = findFirstHeader(headers, sumNames)
  if (sumIndex >= 0) return { index: sumIndex, cumulative: false }
  return { index: -1, cumulative: false }
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
): { bucket: 'dekad' | 'season'; explicitSeason: boolean } | null {
  const granularity = granularityRaw.trim().toLowerCase()
  if (['season', 'seasonal', 'season_total', 'total'].includes(granularity)) {
    return { bucket: 'season', explicitSeason: true }
  }
  if (['dekad', 'dekadal', 'dekads', '10d', '10-day'].includes(granularity)) {
    return { bucket: 'dekad', explicitSeason: false }
  }

  const start = Date.parse(normalizeHarvestPeriodDate(periodStart))
  const end = Date.parse(normalizeHarvestPeriodDate(periodEnd))
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const days = (end - start) / 86_400_000
    if (days > 16) return { bucket: 'season', explicitSeason: false }
    if (days >= 0) return { bucket: 'dekad', explicitSeason: false }
  }

  if (!granularity || granularity === 'dekad') return { bucket: 'dekad', explicitSeason: false }
  return null
}

function comparePeriods(left: string, right: string) {
  const leftDate = Date.parse(left)
  const rightDate = Date.parse(right)
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
    return leftDate - rightDate
  }
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }
  return left.localeCompare(right)
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
      .sort(([left], [right]) => comparePeriods(left, right))
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

interface ParsedStatsRow {
  metric: HarvestMetricKey
  periodStart: string
  periodEnd: string
  bucket: 'dekad' | 'season'
  explicitSeason: boolean
  value: number
  cumulativeOnly: boolean
}

function seasonTotalFor(series: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>, metric: HarvestMetricKey) {
  const value = series[metric]?.at(-1)?.value
  return value !== undefined && Number.isFinite(value) ? value : undefined
}

function isRunningTotal(points: HarvestTimeseriesPoint[], seasonTotal: number) {
  if (points.length < 3 || seasonTotal <= 0) return false
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].value + 1e-6 < points[index - 1].value) return false
  }
  const last = points[points.length - 1].value
  const sum = points.reduce((total, point) => total + point.value, 0)
  const lastMatchesSeason = Math.abs(last - seasonTotal) / seasonTotal <= 0.2
  return lastMatchesSeason && sum > seasonTotal * 1.5
}

function reconcileCumulativeDekads(
  dekadSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>,
  seasonSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>,
  alreadyConverted: Set<HarvestMetricKey>
) {
  for (const metric of ADDITIVE_METRICS) {
    if (alreadyConverted.has(metric)) continue
    const points = dekadSeries[metric]
    const seasonTotal = seasonTotalFor(seasonSeries, metric)
    if (!points || seasonTotal === undefined || !isRunningTotal(points, seasonTotal)) continue
    dekadSeries[metric] = incrementsFromCumulative(points)
  }
}

function promoteImplicitSeasonRowsToDekads(rows: ParsedStatsRow[]) {
  const implicit = rows.filter((row) => row.bucket === 'season' && !row.explicitSeason)
  const starts = new Set(implicit.map((row) => normalizeHarvestPeriodDate(row.periodStart)).filter(Boolean))
  if (starts.size < 3) return

  for (const row of implicit) {
    row.bucket = 'dekad'
  }
}

function seriesFromRows(rows: ParsedStatsRow[]): Pick<HarvestFieldStatsResponse, 'periods' | 'timeseries'> {
  const dekadSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const seasonSeries: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}
  const cumulativeDekadMetrics = new Set<HarvestMetricKey>()
  const periods = new Map<string, HarvestFieldPeriodOption>()

  for (const row of rows) {
    const periodDate = normalizeHarvestPeriodDate(row.periodStart)
    const periodEnd = normalizeHarvestPeriodDate(row.periodEnd)
    const periodLabel = periodEnd ? `${periodDate} / ${periodEnd}` : periodDate
    if (row.bucket === 'dekad' && periodDate) {
      periods.set(periodDate, { value: periodDate, label: periodLabel })
    }
    if (row.bucket === 'dekad' && row.cumulativeOnly && ADDITIVE_METRICS.has(row.metric)) {
      cumulativeDekadMetrics.add(row.metric)
    }
    appendPoint(
      row.bucket === 'season' ? seasonSeries : dekadSeries,
      row.metric,
      row.bucket === 'season' ? 'Season total' : periodDate,
      row.value
    )
  }

  finalizeSeries(dekadSeries, cumulativeDekadMetrics)
  finalizeSeries(seasonSeries, new Set())
  reconcileCumulativeDekads(dekadSeries, seasonSeries, cumulativeDekadMetrics)

  return {
    periods: Array.from(periods.values()).sort((left, right) => comparePeriods(left.value, right.value)),
    timeseries: {
      dekad: dekadSeries,
      season: seasonSeries,
    },
  }
}

function readStatsRows(
  lines: string[],
  headers: string[],
  delimiter: string,
  readMetric: (cells: string[]) => Array<{ metric: HarvestMetricKey; value: number; cumulativeOnly: boolean }>
): ParsedStatsRow[] {
  const granularityIndex = findHeader(headers, GRANULARITY_HEADERS)
  const periodStartIndex = findHeader(headers, PERIOD_START_HEADERS)
  const periodEndIndex = findHeader(headers, PERIOD_END_HEADERS)
  const rows: ParsedStatsRow[] = []

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line, delimiter)
    const granularityRaw = granularityIndex >= 0 ? cells[granularityIndex] || '' : ''
    const periodStart = periodStartIndex >= 0 ? cells[periodStartIndex] || '' : ''
    const periodEnd = periodEndIndex >= 0 ? cells[periodEndIndex] || '' : ''
    const classified = classifyStatsGranularity(granularityRaw, periodStart, periodEnd)
    if (!classified) continue

    for (const metricValue of readMetric(cells)) {
      rows.push({
        metric: metricValue.metric,
        periodStart,
        periodEnd,
        bucket: classified.bucket,
        explicitSeason: classified.explicitSeason,
        value: metricValue.value,
        cumulativeOnly: metricValue.cumulativeOnly,
      })
    }
  }

  promoteImplicitSeasonRowsToDekads(rows)
  return rows
}

function parseLongFormatStatsCsv(
  lines: string[],
  headers: string[],
  delimiter: string
): Pick<HarvestFieldStatsResponse, 'periods' | 'timeseries'> {
  const metricIndex = findHeader(headers, METRIC_NAME_HEADERS)
  const valueIndex = findHeader(headers, VALUE_HEADERS)
  const cumulativeValueIndex = findHeader(headers, CUMULATIVE_HEADERS)

  const rows = readStatsRows(lines, headers, delimiter, (cells) => {
    const metric = metricIndex >= 0 ? resolveMetricKey(cells[metricIndex] || '') : null
    if (!metric) return []
    const periodValue = toMetricValue(valueIndex >= 0 ? cells[valueIndex] : undefined)
    const cumulativeValue = toMetricValue(cumulativeValueIndex >= 0 ? cells[cumulativeValueIndex] : undefined)
    const value = periodValue ?? cumulativeValue
    if (value === undefined) return []
    return [
      {
        metric,
        value,
        cumulativeOnly: periodValue === undefined && cumulativeValue !== undefined,
      },
    ]
  })

  return seriesFromRows(rows)
}

function parseWideFormatStatsCsv(
  lines: string[],
  headers: string[],
  delimiter: string
): Pick<HarvestFieldStatsResponse, 'periods' | 'timeseries'> {
  const metricColumns = METRIC_KEYS.reduce(
    (acc, metric) => {
      acc[metric] = resolveMetricColumn(headers, metric)
      return acc
    },
    {} as Record<HarvestMetricKey, { index: number; cumulative: boolean }>
  )

  const rows = readStatsRows(lines, headers, delimiter, (cells) => {
    const values: Array<{ metric: HarvestMetricKey; value: number; cumulativeOnly: boolean }> = []
    for (const metric of METRIC_KEYS) {
      const column = metricColumns[metric]
      if (!column || column.index < 0) continue
      const value = toMetricValue(cells[column.index])
      if (value === undefined) continue
      values.push({ metric, value, cumulativeOnly: column.cumulative })
    }
    return values
  })

  return seriesFromRows(rows)
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

  const mergedDekad: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {
    ...base.timeseries.dekad,
  }
  for (const metric of METRIC_KEYS) {
    const basePoints = base.timeseries.dekad[metric]
    const overlayPoints = overlay.timeseries.dekad[metric]
    if (!overlayPoints?.length) continue
    if (!basePoints?.length || overlayPoints.length > basePoints.length) {
      mergedDekad[metric] = overlayPoints
    }
  }

  const periods = new Map<string, HarvestFieldPeriodOption>()
  for (const period of [...base.periods, ...overlay.periods]) {
    periods.set(period.value, period)
  }

  return {
    ...base,
    periods: Array.from(periods.values()).sort((left, right) => comparePeriods(left.value, right.value)),
    timeseries: {
      dekad: mergedDekad,
      season: mergedSeason,
    },
  }
}

export function buildFieldTrendSeries(
  stats: Pick<HarvestFieldStatsResponse, 'timeseries'>,
  granularity: 'dekad' | 'season'
): Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> {
  const series: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>> = {}

  for (const metric of METRIC_KEYS) {
    const dekad = (stats.timeseries.dekad[metric] || []).filter((point) => Number.isFinite(point.value))
    const season = (stats.timeseries.season[metric] || []).filter((point) => Number.isFinite(point.value))

    if (granularity === 'dekad') {
      series[metric] = dekad
      continue
    }

    if (season.length > 1) {
      series[metric] = season
      continue
    }

    if (ADDITIVE_METRICS.has(metric) && dekad.length > 1) {
      let running = 0
      series[metric] = dekad.map((point) => {
        running += point.value
        return { period: point.period, value: Math.round(running * 1000) / 1000 }
      })
      continue
    }

    series[metric] = season
  }

  return series
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

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.trim().toLowerCase())
  const parsed =
    findHeader(headers, METRIC_NAME_HEADERS) >= 0
      ? parseLongFormatStatsCsv(lines, headers, delimiter)
      : parseWideFormatStatsCsv(lines, headers, delimiter)

  return {
    parcel_id: meta.parcel_id,
    season_id: meta.season_id,
    periods: parsed.periods,
    timeseries: parsed.timeseries,
  }
}
