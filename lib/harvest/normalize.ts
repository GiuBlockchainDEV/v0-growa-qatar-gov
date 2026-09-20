import { deduplicateHarvestCatalogFields } from '@/lib/harvest/catalog'
import type {
  HarvestAnalyticsField,
  HarvestAnalyticsResponse,
  HarvestFieldMetrics,
  HarvestMetricKey,
  HarvestMetricSummary,
  HarvestMode,
  HarvestPaginatedFieldsResponse,
  HarvestTimeseriesPoint,
  HarvestTimeseriesResponse,
} from '@/lib/harvest/types'

const METRIC_KEYS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(record[key])
    if (value !== undefined) return value
  }
  return undefined
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function normalizeMetricSummary(raw: unknown): HarvestMetricSummary | null {
  const record = asRecord(raw)
  if (!record) return null

  const key = pickString(record, ['key', 'metric', 'metric_key']) as HarvestMetricKey | undefined
  if (!key || !METRIC_KEYS.includes(key)) return null

  const value = pickNumber(record, ['value', 'sum', 'mean', 'total', 'metric_value'])
  const aggRaw = pickString(record, ['agg', 'aggregation', 'aggregate'])
  const agg = aggRaw === 'mean' || key === 'bwp' || key === 'rwd' || key === 'wcu' ? 'mean' : 'sum'
  const fieldCount = pickNumber(record, ['field_count', 'fields', 'count']) ?? 0

  if (value === undefined) return null

  return { key, agg, value, field_count: fieldCount }
}

function normalizeFieldMetrics(raw: unknown): HarvestFieldMetrics {
  const record = asRecord(raw)
  if (!record) return {}

  const metrics: HarvestFieldMetrics = {}
  for (const key of METRIC_KEYS) {
    const value = pickNumber(record, [key, `${key}_sum`, `${key}_mean`, `${key}_value`])
    if (value !== undefined) metrics[key] = value
  }
  return metrics
}

function normalizeSeasonRecord(raw: unknown) {
  const record = asRecord(raw)
  if (!record) return null
  return {
    id: pickNumber(record, ['id', 'season_id', 'seasonId']),
    crop: pickString(record, ['crop', 'crop_name']),
    start_date: pickString(record, ['start_date', 'startDate']),
    harvest_date: pickString(record, ['harvest_date', 'harvestDate', 'end_date']),
  }
}

export function normalizeAnalyticsField(raw: unknown): HarvestAnalyticsField | null {
  const record = asRecord(raw)
  if (!record) return null

  let parcelId = pickString(record, ['parcel_id', 'parcelId'])
  if (!parcelId) {
    const idCandidate = pickString(record, ['id', 'entity_id', 'uuid'])
    if (idCandidate && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idCandidate)) {
      parcelId = idCandidate
    }
  }
  const name = pickString(record, ['name', 'field_name', 'label'])
  if (!parcelId || !name) return null

  const seasonsRaw = Array.isArray(record.seasons) ? record.seasons : []
  const seasons = seasonsRaw
    .map((entry) => normalizeSeasonRecord(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const currentSeasonId =
    pickNumber(record, ['season_id', 'seasonId', 'current_season_id', 'currentSeasonId']) ??
    seasons[0]?.id

  const activeSeason =
    seasons.find((season) => season.id === currentSeasonId) ??
    seasons.find((season) => season.id !== undefined) ??
    null

  const crop =
    pickString(record, ['crop', 'crop_name']) ??
    activeSeason?.crop ??
    '—'
  const startDate =
    pickString(record, ['start_date', 'startDate', 'sowing_date']) ??
    activeSeason?.start_date ??
    ''
  const harvestDate =
    pickString(record, ['harvest_date', 'harvestDate', 'expected_harvest_date', 'end_date']) ??
    activeSeason?.harvest_date ??
    ''
  const area = pickNumber(record, ['area', 'area_m2', 'area_m²']) ?? 0

  return {
    parcel_id: parcelId,
    season_id: currentSeasonId,
    name,
    crop,
    cultivation: pickString(record, ['cultivation', 'cultivation_method', 'cultivation_type']),
    area,
    start_date: startDate,
    harvest_date: harvestDate,
    metrics: normalizeFieldMetrics(record.metrics ?? record.metric_values ?? record.analytics ?? record),
  }
}

export function normalizeEntityToField(raw: unknown, parcelId: string): HarvestAnalyticsField | null {
  const record = asRecord(raw)
  if (!record) return null

  const seasonsRaw = Array.isArray(record.seasons) ? record.seasons : []
  const seasons = seasonsRaw
    .map((entry) => normalizeSeasonRecord(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  const currentSeasonId = pickNumber(record, ['current_season_id', 'currentSeasonId'])
  const activeSeason =
    seasons.find((season) => season.id === currentSeasonId) ??
    seasons[seasons.length - 1] ??
    null

  const name = pickString(record, ['name', 'field_name']) || 'Field'
  const area = pickNumber(record, ['area', 'area_m2']) ?? 0

  return {
    parcel_id: pickString(record, ['parcel_id', 'parcelId']) || parcelId,
    season_id: activeSeason?.id ?? currentSeasonId,
    name,
    crop: activeSeason?.crop || '—',
    area,
    start_date: activeSeason?.start_date || '',
    harvest_date: activeSeason?.harvest_date || '',
    metrics: {},
  }
}

export function normalizeAnalyticsResponse(raw: unknown): HarvestAnalyticsResponse {
  const record = asRecord(raw)
  const metricsRaw = Array.isArray(record?.metrics) ? record.metrics : []
  const fieldsRaw = Array.isArray(record?.fields) ? record.fields : []

  const metrics = metricsRaw
    .map((entry) => normalizeMetricSummary(entry))
    .filter((entry): entry is HarvestMetricSummary => Boolean(entry))

  const fields = fieldsRaw
    .map((entry) => normalizeAnalyticsField(entry))
    .filter((entry): entry is HarvestAnalyticsField => Boolean(entry))

  return { metrics, fields }
}

export function normalizePaginatedFieldsResponse(raw: unknown): HarvestPaginatedFieldsResponse {
  const record = asRecord(raw)
  const resultsRaw = Array.isArray(record?.results)
    ? record.results
    : Array.isArray(record?.fields)
      ? record.fields
      : Array.isArray(raw)
        ? raw
        : []

  const results = resultsRaw
    .map((entry) => normalizeAnalyticsField(entry))
    .filter((entry): entry is HarvestAnalyticsField => Boolean(entry))

  const deduped = deduplicateHarvestCatalogFields(results)
  const total = pickNumber(record, ['total', 'count']) ?? deduped.length
  return { total, results: deduped }
}

export function normalizeTimeseriesPoint(raw: unknown): HarvestTimeseriesPoint | null {
  const record = asRecord(raw)
  if (!record) return null

  const period = pickString(record, ['period', 'date', 'label', 'bucket', 'time'])
  const value = pickNumber(record, ['value', 'sum', 'mean', 'total', 'metric_value', 'y'])

  if (!period || value === undefined) return null
  return { period, value }
}

export function normalizeTimeseriesResponse(raw: unknown, fallbackMode: HarvestMode): HarvestTimeseriesResponse {
  const record = asRecord(raw)
  const pointsRaw = Array.isArray(record?.points)
    ? record.points
    : Array.isArray(record?.series)
      ? record.series
      : Array.isArray(record?.data)
        ? record.data
        : []

  const points = pointsRaw
    .map((entry) => normalizeTimeseriesPoint(entry))
    .filter((entry): entry is HarvestTimeseriesPoint => Boolean(entry))

  const metric = pickString(record, ['metric', 'metric_key']) || 'aeti'
  const granularity = pickString(record, ['granularity', 'interval']) || 'dekad'
  const mode = (pickString(record, ['mode']) as HarvestMode | undefined) || fallbackMode

  return { metric, granularity, mode, points }
}
