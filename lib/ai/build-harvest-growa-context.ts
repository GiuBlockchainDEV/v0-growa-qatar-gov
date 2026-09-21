import { HARVEST_METRIC_META } from '@/lib/harvest/metrics'
import type {
  HarvestAnalyticsField,
  HarvestAnalyticsResponse,
  HarvestFieldStatsResponse,
  HarvestMetricKey,
  HarvestMetricSummary,
  HarvestMode,
  HarvestRasterResponse,
  HarvestTaskStatus,
  HarvestTimeseriesPoint,
  HarvestTimeseriesResponse,
  HarvestTrendGranularity,
} from '@/lib/harvest/types'
import { buildHarvestGrowaDigest } from './growa-digest'
import type { HarvestGrowaAnalysisContext } from './growa-types'

interface BuildHarvestGrowaContextInput {
  view: 'national' | 'field'
  mode: HarvestMode
  usingDemoData: boolean
  analytics: HarvestAnalyticsResponse | null
  timeseries: HarvestTimeseriesResponse | null
  fields: HarvestAnalyticsField[]
  collectingTasks: Array<{ parcel_id: string; season_id: number; task_id: string }>
  activeField?: HarvestAnalyticsField | null
  fieldStats?: HarvestFieldStatsResponse | null
  fieldRaster?: HarvestRasterResponse | null
  yieldTask?: HarvestTaskStatus | null
  activeMapMetric?: HarvestMetricKey
  mapGranularity?: HarvestTrendGranularity
  selectedPeriod?: string | null
  trendGranularity?: HarvestTrendGranularity
  fieldTrendSeries?: Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function areaHa(areaM2: number) {
  if (!Number.isFinite(areaM2)) return 0
  return round(areaM2 / 10_000, 2)
}

function metricValue(field: HarvestAnalyticsField, key: HarvestMetricKey) {
  const value = field.metrics?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function rankFieldsByMetric(fields: HarvestAnalyticsField[], key: HarvestMetricKey, direction: 'asc' | 'desc') {
  const ranked = fields
    .map((field) => ({ name: field.name, value: metricValue(field, key) }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => (direction === 'desc' ? b.value! - a.value! : a.value! - b.value!))
  return ranked.slice(0, 5).map((entry) => `${entry.name} (${round(entry.value!, 2)} ${HARVEST_METRIC_META[key].unit})`)
}

function fieldsMissingMetric(fields: HarvestAnalyticsField[], key: HarvestMetricKey) {
  return fields
    .filter((field) => metricValue(field, key) === null)
    .map((field) => field.name)
    .slice(0, 8)
}

function summarizeTrend(points: HarvestTimeseriesPoint[] | undefined) {
  const valid = (points || []).filter((point) => Number.isFinite(point.value))
  if (valid.length === 0) return null
  const latest = valid.at(-1)!
  const previous = valid.length > 1 ? valid.at(-2)! : null
  const change =
    previous && previous.value !== 0
      ? round(((latest.value - previous.value) / Math.abs(previous.value)) * 100, 1)
      : null
  return {
    period: latest.period,
    value: round(latest.value, 2),
    previousPeriod: previous?.period ?? null,
    previousValue: previous ? round(previous.value, 2) : null,
    changePercent: change,
  }
}

export function buildHarvestGrowaContext(
  input: BuildHarvestGrowaContextInput
): HarvestGrowaAnalysisContext {
  const {
    view,
    mode,
    usingDemoData,
    analytics,
    timeseries,
    fields,
    collectingTasks,
    activeField,
    fieldStats,
    fieldRaster,
    yieldTask,
    activeMapMetric = 'npp',
    mapGranularity = 'season',
    selectedPeriod = null,
    trendGranularity = 'dekad',
    fieldTrendSeries = {},
  } = input

  const nationalMetrics: HarvestMetricSummary[] = analytics?.metrics || []
  const totalAreaHa = round(
    fields.reduce((sum, field) => sum + areaHa(field.area), 0),
    2
  )
  const collectingFieldNames = fields
    .filter((field) => collectingTasks.some((task) => task.parcel_id === field.parcel_id))
    .map((field) => field.name)

  const metricHeadline = (key: HarvestMetricKey) => {
    const summary = nationalMetrics.find((metric) => metric.key === key)
    return summary
      ? {
          value: round(summary.value, 2),
          unit: HARVEST_METRIC_META[key].unit,
          fieldCount: summary.field_count,
          agg: summary.agg,
        }
      : undefined
  }

  const fieldSnapshots = fields.map((field) => ({
    parcel_id: field.parcel_id,
    name: field.name,
    crop: field.crop,
    areaHa: areaHa(field.area),
    harvest_date: field.harvest_date,
    start_date: field.start_date,
    metrics: Object.fromEntries(
      (['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost'] as HarvestMetricKey[])
        .map((key) => [key, metricValue(field, key)])
        .filter(([, value]) => value !== null)
    ) as Partial<Record<HarvestMetricKey, number>>,
    isCollecting: collectingTasks.some((task) => task.parcel_id === field.parcel_id),
  }))

  const contextBase: HarvestGrowaAnalysisContext = {
    module: 'harvest',
    generatedAt: new Date().toISOString(),
    view,
    mode,
    usingDemoData,
    digest: '',
    headline: {
      fieldCount: fields.length,
      totalAreaHa,
      collectingCount: collectingFieldNames.length,
      modeLabel: mode === 'current' ? 'Observed (current)' : 'Forecast (predict)',
      usingDemoData,
      aeti: metricHeadline('aeti'),
      npp: metricHeadline('npp'),
      tbp: metricHeadline('tbp'),
      bwp: metricHeadline('bwp'),
      rwd: metricHeadline('rwd'),
      wcu: metricHeadline('wcu'),
      cost: metricHeadline('cost'),
    },
    nationalMetrics,
    fields: fieldSnapshots,
    timeseries: timeseries
      ? {
          metric: timeseries.metric,
          granularity: timeseries.granularity,
          mode: timeseries.mode,
          points: (timeseries.points || [])
            .filter((point) => Number.isFinite(point.value))
            .slice(-12)
            .map((point) => ({ period: point.period, value: round(point.value, 2) })),
        }
      : undefined,
    rankings: {
      highestAeti: rankFieldsByMetric(fields, 'aeti', 'desc'),
      lowestBwp: rankFieldsByMetric(fields, 'bwp', 'asc'),
      highestTbp: rankFieldsByMetric(fields, 'tbp', 'desc'),
      highestCost: rankFieldsByMetric(fields, 'cost', 'desc'),
    },
    alerts: {
      collectingFields: collectingFieldNames,
      missingAeti: fieldsMissingMetric(fields, 'aeti'),
      missingTbp: fieldsMissingMetric(fields, 'tbp'),
      missingBwp: fieldsMissingMetric(fields, 'bwp'),
      demoDataActive: usingDemoData,
    },
  }

  if (view === 'field' && activeField) {
    const trendHighlights = Object.fromEntries(
      (['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost'] as HarvestMetricKey[])
        .map((key) => {
          const summary = summarizeTrend(fieldTrendSeries[key])
          return summary ? [key, summary] : null
        })
        .filter(Boolean) as Array<[HarvestMetricKey, NonNullable<ReturnType<typeof summarizeTrend>>]>
    )

    contextBase.fieldDetail = {
      parcel_id: activeField.parcel_id,
      season_id: activeField.season_id || fieldStats?.season_id || 0,
      name: activeField.name,
      crop: activeField.crop,
      areaHa: areaHa(activeField.area),
      start_date: activeField.start_date,
      harvest_date: activeField.harvest_date,
      metrics: Object.fromEntries(
        (['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost'] as HarvestMetricKey[])
          .map((key) => [key, metricValue(activeField, key)])
          .filter(([, value]) => value !== null)
      ) as Partial<Record<HarvestMetricKey, number>>,
      activeMapMetric,
      mapGranularity,
      selectedPeriod,
      trendGranularity,
      isCollecting: collectingTasks.some((task) => task.parcel_id === activeField.parcel_id),
      trendHighlights,
      yieldTask: yieldTask
        ? {
            status: yieldTask.status,
            result: yieldTask.result,
          }
        : undefined,
      raster: fieldRaster
        ? {
            metric: fieldRaster.metric,
            granularity: fieldRaster.granularity,
            period: fieldRaster.period,
            vmin: fieldRaster.vmin,
            vmax: fieldRaster.vmax,
            unit: fieldRaster.unit,
            legend: fieldRaster.legend,
            image_url: fieldRaster.image_url,
            bounds_extent: fieldRaster.bounds_extent,
          }
        : undefined,
      availablePeriods: fieldStats?.periods?.map((period) => period.label) || [],
    }
  }

  contextBase.digest = buildHarvestGrowaDigest(contextBase)
  return contextBase
}
