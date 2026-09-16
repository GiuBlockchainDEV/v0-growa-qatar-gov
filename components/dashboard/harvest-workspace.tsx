'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  Droplets,
  Leaf,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Sprout,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  IntelligenceDataTable,
  IntelligenceErrorState,
  IntelligenceHero,
  IntelligenceKpiCard,
  IntelligenceLoadingState,
  IntelligencePanel,
  IntelligenceTableBody,
  IntelligenceTableHead,
  IntelligenceWorkspaceRoot,
} from '@/components/dashboard/intelligence-workspace-ui'
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

const METRIC_LABELS: Record<HarvestMetricKey, { label: string; unit: string }> = {
  aeti: { label: 'Water Consumption (AETI)', unit: 'm³' },
  npp: { label: 'Net Primary Production', unit: '—' },
  tbp: { label: 'Total Biomass Product', unit: 't' },
  bwp: { label: 'Biomass Water Productivity', unit: 'kg/m³' },
  rwd: { label: 'Relative Water Deficit', unit: '—' },
  wcu: { label: 'Water Consumption Uniformity', unit: '%' },
  cost: { label: 'Irrigation Cost', unit: 'QAR' },
}

const FIELD_KPI_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']
const MAP_METRICS: HarvestMetricKey[] = ['npp', 'aeti', 'tbp', 'bwp', 'rwd']
const TREND_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

function formatMetricValue(metric: HarvestMetricSummary) {
  const value = metric.value
  if (!Number.isFinite(value)) return '—'

  if (metric.key === 'cost') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  if (metric.key === 'wcu') {
    return `${value.toFixed(1)}%`
  }

  if (metric.agg === 'mean' || metric.key === 'bwp' || metric.key === 'rwd') {
    return value.toFixed(2)
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatArea(areaM2: number) {
  if (!Number.isFinite(areaM2)) return '—'
  const hectares = areaM2 / 10_000
  return `${hectares.toFixed(2)} ha`
}

function formatFieldMetric(value: number | undefined, key: HarvestMetricKey) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (key === 'cost') return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (key === 'wcu') return `${value.toFixed(1)}%`
  if (key === 'bwp' || key === 'rwd') return value.toFixed(2)
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatTimeseriesValue(value: number | undefined, key?: HarvestMetricKey) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (key === 'wcu') return `${value.toFixed(1)}%`
  if (key === 'cost') return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (key === 'bwp' || key === 'rwd') return value.toFixed(2)
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

async function fetchJson<T>(url: string): Promise<{ data: T; isDemo: boolean }> {
  const response = await fetch(url, { cache: 'no-store' })
  const isDemo = response.headers.get('X-Harvest-Demo') === 'true'
  const payload = await response.json()
  if (!response.ok) {
    const hint = typeof payload?.hint === 'string' ? payload.hint : ''
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.details === 'string'
          ? payload.details
          : 'Request failed'
    throw new Error(hint ? `${message}. ${hint}` : message)
  }
  return { data: payload as T, isDemo }
}

function HarvestTrendBars({
  title,
  metric,
  points,
}: {
  title: string
  metric: HarvestMetricKey
  points: HarvestTimeseriesPoint[]
}) {
  const validPoints = points.filter((point) => Number.isFinite(point.value))
  const maxValue = validPoints.reduce((max, point) => Math.max(max, point.value), 0)

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {METRIC_LABELS[metric].unit}
        </span>
      </div>
      <div className="space-y-1.5">
        {validPoints.slice(-8).map((point) => {
          const width = maxValue > 0 ? Math.max(4, (point.value / maxValue) * 100) : 4
          return (
            <div key={`${metric}-${point.period}`} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate pr-2">{point.period}</span>
                <span>{formatTimeseriesValue(point.value, metric)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/50">
                <div className="h-1.5 rounded-full bg-primary/80" style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
        {validPoints.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No trend data for this metric.</p>
        ) : null}
      </div>
    </div>
  )
}

export function HarvestWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parcelId = searchParams.get('parcelId')
  const harvestSeasonIdParam = searchParams.get('harvestSeasonId')
  const selectedMapMetric = (searchParams.get('harvestMetric') || 'npp') as HarvestMetricKey
  const mapGranularity = (searchParams.get('harvestGranularity') || 'dekad') as HarvestTrendGranularity
  const selectedPeriod = searchParams.get('harvestPeriod')
  const [mode, setMode] = useState<HarvestMode>(
    searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<HarvestAnalyticsResponse | null>(null)
  const [fields, setFields] = useState<HarvestAnalyticsField[]>([])
  const [timeseries, setTimeseries] = useState<HarvestTimeseriesResponse | null>(null)
  const [selectedField, setSelectedField] = useState<HarvestAnalyticsField | null>(null)
  const [fieldStats, setFieldStats] = useState<HarvestFieldStatsResponse | null>(null)
  const [fieldRaster, setFieldRaster] = useState<HarvestRasterResponse | null>(null)
  const [fieldDetailLoading, setFieldDetailLoading] = useState(false)
  const [fieldRasterLoading, setFieldRasterLoading] = useState(false)
  const [trendGranularity, setTrendGranularity] = useState<HarvestTrendGranularity>('dekad')
  const [yieldTask, setYieldTask] = useState<HarvestTaskStatus | null>(null)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const fieldsParams = new URLSearchParams({
        mode,
        page: '1',
        perpage: '50',
        sort: 'area',
        order: 'desc',
      })

      const requests: Promise<unknown>[] = [
        fetchJson<{ total: number; results: HarvestAnalyticsField[] }>(
          `/api/harvest/fields?${fieldsParams.toString()}`
        ),
      ]

      if (!parcelId) {
        requests.push(
          fetchJson<HarvestAnalyticsResponse>(`/api/harvest/analytics?mode=${mode}`),
          fetchJson<HarvestTimeseriesResponse>(
            `/api/harvest/timeseries?mode=${mode}&metric=aeti&granularity=dekad`
          )
        )
      }

      const results = await Promise.all(requests)
      const fieldsResult = results[0] as { data: { total: number; results: HarvestAnalyticsField[] } }
      const fieldsPayload = fieldsResult.data

      setFields(fieldsPayload.results || [])

      if (!parcelId) {
        const analyticsResult = results[1] as { data: HarvestAnalyticsResponse }
        const timeseriesResult = results[2] as { data: HarvestTimeseriesResponse }
        setAnalytics(analyticsResult.data)
        setTimeseries(timeseriesResult.data)
        setSelectedField(null)
      } else {
        setAnalytics(null)
        setTimeseries(null)
        const match = (fieldsPayload.results || []).find((field) => field.parcel_id === parcelId) || null
        setSelectedField(match)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Harvest data')
      setAnalytics(null)
      setFields([])
      setTimeseries(null)
      setSelectedField(null)
    } finally {
      setLoading(false)
    }
  }, [mode, parcelId])

  const updateHarvestMapParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'harvest')
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      router.replace(`/dashboard?${params.toString()}`)
    },
    [router, searchParams]
  )

  const loadFieldDetail = useCallback(async () => {
    if (!selectedField?.parcel_id || !selectedField.season_id) {
      setFieldStats(null)
      setFieldRaster(null)
      return
    }

    setFieldDetailLoading(true)
    try {
      const statsResult = await fetchJson<HarvestFieldStatsResponse>(
        `/api/harvest/field/${selectedField.parcel_id}/stats?mode=${mode}&season_id=${selectedField.season_id}`
      )
      setFieldStats(statsResult.data)
      const latestPeriod = statsResult.data.periods.at(-1)?.value || null
      if (mapGranularity === 'dekad' && latestPeriod && !selectedPeriod) {
        updateHarvestMapParams({
          harvestPeriod: latestPeriod,
          harvestSeasonId: String(selectedField.season_id),
        })
      }
    } catch {
      setFieldStats(null)
    } finally {
      setFieldDetailLoading(false)
    }
  }, [mapGranularity, mode, selectedField, selectedPeriod, updateHarvestMapParams])

  const dispatchRasterOverlay = useCallback((raster: HarvestRasterResponse | null) => {
    window.dispatchEvent(
      new CustomEvent('harvest:raster-overlay', {
        detail: raster
          ? {
              imageUrl: raster.image_url,
              bounds: raster.bounds,
              opacity: 0.5,
              metric: raster.metric,
              vmin: raster.vmin,
              vmax: raster.vmax,
              unit: raster.unit,
              legend: raster.legend,
            }
          : null,
      })
    )
  }, [])

  const loadFieldRaster = useCallback(async () => {
    const seasonId = selectedField?.season_id || (harvestSeasonIdParam ? Number(harvestSeasonIdParam) : undefined)
    if (!selectedField?.parcel_id || !seasonId || !Number.isFinite(seasonId)) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      return
    }

    if (mapGranularity === 'dekad' && !selectedPeriod) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      return
    }

    if (!MAP_METRICS.includes(selectedMapMetric)) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      return
    }

    setFieldRasterLoading(true)
    try {
      const params = new URLSearchParams({
        mode,
        metric: selectedMapMetric,
        granularity: mapGranularity,
        season_id: String(seasonId),
      })
      if (mapGranularity === 'dekad' && selectedPeriod) {
        params.set('period', selectedPeriod)
      }

      const rasterResult = await fetchJson<HarvestRasterResponse>(
        `/api/harvest/field/${selectedField.parcel_id}/raster?${params.toString()}`
      )
      setFieldRaster(rasterResult.data)
      dispatchRasterOverlay(rasterResult.data)
    } catch {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
    } finally {
      setFieldRasterLoading(false)
    }
  }, [
    dispatchRasterOverlay,
    harvestSeasonIdParam,
    mapGranularity,
    mode,
    selectedField,
    selectedMapMetric,
    selectedPeriod,
  ])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadFieldDetail()
  }, [loadFieldDetail])

  useEffect(() => {
    void loadFieldRaster()
  }, [loadFieldRaster])

  useEffect(() => {
    return () => {
      dispatchRasterOverlay(null)
    }
  }, [dispatchRasterOverlay])

  const headlineMetrics = useMemo(() => {
    const metrics = analytics?.metrics || []
    const priority: HarvestMetricKey[] = ['aeti', 'tbp', 'bwp', 'cost']
    return priority
      .map((key) => metrics.find((metric) => metric.key === key))
      .filter((metric): metric is HarvestMetricSummary => Boolean(metric))
  }, [analytics])

  const timeseriesPoints = useMemo(() => {
    return (timeseries?.points || []).filter((point) => Number.isFinite(point.value))
  }, [timeseries])

  const maxTimeseriesValue = useMemo(() => {
    return timeseriesPoints.reduce((max, point) => Math.max(max, point.value), 0)
  }, [timeseriesPoints])

  const fieldTrendSeries = useMemo(() => {
    if (!fieldStats) return {}
    const bucket = trendGranularity === 'season' ? fieldStats.timeseries.season : fieldStats.timeseries.dekad
    return TREND_METRICS.reduce(
      (acc, metric) => {
        acc[metric] = (bucket[metric] || []).filter((point) => Number.isFinite(point.value))
        return acc
      },
      {} as Partial<Record<HarvestMetricKey, HarvestTimeseriesPoint[]>>
    )
  }, [fieldStats, trendGranularity])

  const openField = useCallback(
    (field: HarvestAnalyticsField) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'harvest')
      params.set('parcelId', field.parcel_id)
      params.set('harvestMode', mode)
      params.set('zoom', '13')
      params.set('focus', `harvest-${field.parcel_id}`)
      params.set('harvestMetric', 'npp')
      params.set('harvestGranularity', 'dekad')
      if (field.season_id) {
        params.set('harvestSeasonId', String(field.season_id))
      }
      params.delete('harvestPeriod')
      params.delete('pointId')
      params.delete('farmId')
      params.delete('crop')
      router.replace(`/dashboard?${params.toString()}`)
      setSelectedField(field)
    },
    [mode, router, searchParams]
  )

  const clearFieldSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'harvest')
    params.delete('parcelId')
    params.set('harvestMode', mode)
    params.delete('harvestMetric')
    params.delete('harvestGranularity')
    params.delete('harvestPeriod')
    params.delete('harvestSeasonId')
    params.delete('focus')
    router.push(`/dashboard?${params.toString()}`)
    setSelectedField(null)
    setFieldStats(null)
    setFieldRaster(null)
    setYieldTask(null)
    dispatchRasterOverlay(null)
  }, [dispatchRasterOverlay, mode, router, searchParams])

  const deleteSelectedField = useCallback(async () => {
    if (!selectedField?.parcel_id) return
    const confirmed = window.confirm(
      `Delete field "${selectedField.name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/harvest/entity/${selectedField.parcel_id}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Unable to delete field')
      }

      window.dispatchEvent(new Event('harvest:fields-updated'))
      clearFieldSelection()
      await loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete field')
    } finally {
      setDeleteLoading(false)
    }
  }, [clearFieldSelection, loadData, selectedField])

  const runYieldEstimate = useCallback(async () => {
    if (!selectedField?.parcel_id || !selectedField.season_id) return

    setYieldLoading(true)
    setYieldTask(null)

    try {
      const triggerResult = await fetchJson<{ task_id: string }>(
        `/api/harvest/yield/${mode}/${selectedField.parcel_id}/${selectedField.season_id}`
      )
      let attempts = 0
      while (attempts < 40) {
        const statusResult = await fetchJson<HarvestTaskStatus>(
          `/api/harvest/task/${triggerResult.data.task_id}`
        )
        const status = statusResult.data
        setYieldTask(status)
        if (status.status === 'completed' || status.status === 'failed') break
        attempts += 1
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    } catch (yieldError) {
      setYieldTask({
        task_id: 'n/a',
        status: 'failed',
        result: {
          message: yieldError instanceof Error ? yieldError.message : 'Yield task failed',
        },
      })
    } finally {
      setYieldLoading(false)
    }
  }, [mode, selectedField])

  const updateMode = (nextMode: HarvestMode) => {
    setMode(nextMode)
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'harvest')
    params.set('harvestMode', nextMode)
    router.replace(`/dashboard?${params.toString()}`)
  }

  return (
    <IntelligenceWorkspaceRoot>
      <IntelligenceHero
        eyebrow="Harvest Prediction"
        title="Production & Harvest Intelligence"
        description="Satellite-driven water productivity, biomass, and yield outlook integrated directly into the Growa workspace."
        icon={Sprout}
        statusItems={[
          { label: 'Mode', value: mode === 'current' ? 'Observed' : 'Forecast', accent: true },
          { label: 'Fields', value: String(fields.length) },
          {
            label: 'Source',
            value: selectedField ? selectedField.name : 'National analytics',
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateMode('current')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'current'
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          Current
        </button>
        <button
          type="button"
          onClick={() => updateMode('predict')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'predict'
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          Predict
        </button>
        <button
          type="button"
          onClick={() => void loadData()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading ? <IntelligenceLoadingState message="Loading Harvest analytics..." /> : null}
      {!loading && error ? <IntelligenceErrorState message={error} /> : null}

      {!loading && !error ? (
        <>
          {!selectedField ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {headlineMetrics.map((metric, index) => {
                const meta = METRIC_LABELS[metric.key]
                const icons = [Droplets, Leaf, TrendingUp, Target]
                const Icon = icons[index] || Activity
                return (
                  <IntelligenceKpiCard
                    key={metric.key}
                    label={meta.label}
                    value={`${formatMetricValue(metric)} ${meta.unit}`.trim()}
                    icon={Icon}
                    accent={index === 0}
                    tone={index === 2 ? 'sky' : 'default'}
                  />
                )
              })}
            </div>
          ) : null}

          {selectedField ? (
            <div className="space-y-4">
              <IntelligencePanel
                title={selectedField.name}
                subtitle="Field-specific analytics, maps, and trends"
                icon={Sprout}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{selectedField.crop}</span>
                    <span>•</span>
                    <span>{formatArea(selectedField.area)}</span>
                    <span>•</span>
                    <span>{selectedField.start_date} → {selectedField.harvest_date}</span>
                    <button
                      type="button"
                      onClick={clearFieldSelection}
                      className="ml-auto rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-secondary/40"
                    >
                      Back to overview
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                    {FIELD_KPI_METRICS.map((key) => (
                      <div key={key} className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {METRIC_LABELS[key].label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatFieldMetric(selectedField.metrics?.[key], key)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void runYieldEstimate()}
                      disabled={yieldLoading || !selectedField.season_id}
                      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {yieldLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                      Estimate yield
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSelectedField()}
                      disabled={deleteLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete field
                    </button>
                  </div>

                  {yieldTask ? (
                    <div className="rounded-lg border border-border bg-card/70 px-3 py-3 text-xs">
                      <p className="font-medium text-foreground">Yield task: {yieldTask.status}</p>
                      {yieldTask.result ? (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {JSON.stringify(yieldTask.result, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </IntelligencePanel>

              <IntelligencePanel
                title="Field metric maps"
                subtitle="Raster layers overlaid on the map at 50% opacity"
                icon={MapIcon}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {MAP_METRICS.map((metric) => (
                      <button
                        key={metric}
                        type="button"
                        onClick={() =>
                          updateHarvestMapParams({
                            harvestMetric: metric,
                            harvestSeasonId: selectedField.season_id
                              ? String(selectedField.season_id)
                              : harvestSeasonIdParam,
                          })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          selectedMapMetric === metric
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {METRIC_LABELS[metric].label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateHarvestMapParams({
                          harvestGranularity: 'dekad',
                          harvestSeasonId: selectedField.season_id
                            ? String(selectedField.season_id)
                            : harvestSeasonIdParam,
                        })
                      }
                      className={`rounded-md border px-2.5 py-1 text-[11px] ${
                        mapGranularity === 'dekad'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Dekad map
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateHarvestMapParams({
                          harvestGranularity: 'season',
                          harvestPeriod: null,
                          harvestSeasonId: selectedField.season_id
                            ? String(selectedField.season_id)
                            : harvestSeasonIdParam,
                        })
                      }
                      className={`rounded-md border px-2.5 py-1 text-[11px] ${
                        mapGranularity === 'season'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Season map
                    </button>
                    {mapGranularity === 'dekad' ? (
                      <select
                        value={selectedPeriod || ''}
                        onChange={(event) =>
                          updateHarvestMapParams({
                            harvestPeriod: event.target.value || null,
                            harvestSeasonId: selectedField.season_id
                              ? String(selectedField.season_id)
                              : harvestSeasonIdParam,
                          })
                        }
                        className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground"
                      >
                        {(fieldStats?.periods || []).map((period) => (
                          <option key={period.value} value={period.value}>
                            {period.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  {fieldRasterLoading || fieldDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading raster layer on map...
                    </div>
                  ) : fieldRaster ? (
                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">{METRIC_LABELS[fieldRaster.metric].label}</span>{' '}
                        is active on the satellite map at 50% opacity.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Range: {fieldRaster.vmin} – {fieldRaster.vmax} {fieldRaster.unit}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {fieldRaster.legend.map((item) => (
                            <span key={item.label} className="inline-flex items-center gap-1">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No satellite raster available for this field and metric. Select a supported metric or period.
                    </p>
                  )}
                </div>
              </IntelligencePanel>

              <IntelligencePanel
                title="Field trends"
                subtitle="Metric trends for this field only"
                icon={TrendingUp}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTrendGranularity('dekad')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] ${
                        trendGranularity === 'dekad'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Dekad trends
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendGranularity('season')}
                      className={`rounded-md border px-2.5 py-1 text-[11px] ${
                        trendGranularity === 'season'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      Season trend
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {TREND_METRICS.map((metric) => (
                      <HarvestTrendBars
                        key={`${trendGranularity}-${metric}`}
                        title={METRIC_LABELS[metric].label}
                        metric={metric}
                        points={fieldTrendSeries[metric] || []}
                      />
                    ))}
                  </div>
                </div>
              </IntelligencePanel>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
            <IntelligencePanel title="Open-field registry" subtitle="Harvest entities with analytics metrics" icon={Leaf}>
              <IntelligenceDataTable>
                <IntelligenceTableHead>
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Field</th>
                    <th className="px-3 py-2.5 font-medium">Crop</th>
                    <th className="px-3 py-2.5 font-medium">Area</th>
                    <th className="px-3 py-2.5 font-medium">AETI</th>
                    <th className="px-3 py-2.5 font-medium">TBP</th>
                    <th className="px-3 py-2.5 font-medium">BWP</th>
                    <th className="px-3 py-2.5 font-medium">Harvest</th>
                  </tr>
                </IntelligenceTableHead>
                <IntelligenceTableBody>
                  {fields.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No Harvest fields available for the selected mode.
                      </td>
                    </tr>
                  ) : (
                    fields.map((field, index) => (
                      <tr
                        key={`${field.parcel_id}-${field.season_id || index}`}
                        onClick={() => openField(field)}
                        className={`cursor-pointer text-sm transition-colors hover:bg-primary/10 ${
                          selectedField?.parcel_id === field.parcel_id
                            ? 'bg-primary/10'
                            : index % 2 === 0
                              ? 'bg-card/60'
                              : 'bg-secondary/20'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">{field.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{field.crop}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatArea(field.area)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatFieldMetric(field.metrics?.aeti, 'aeti')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatFieldMetric(field.metrics?.tbp, 'tbp')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatFieldMetric(field.metrics?.bwp, 'bwp')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{field.harvest_date}</td>
                      </tr>
                    ))
                  )}
                </IntelligenceTableBody>
              </IntelligenceDataTable>
            </IntelligencePanel>

            {!selectedField ? (
              <IntelligencePanel
                title="Water consumption trend"
                subtitle="National dekad AETI series"
                icon={Droplets}
              >
                <div className="space-y-2">
                  {timeseriesPoints.slice(-12).map((point) => {
                    const width =
                      maxTimeseriesValue > 0 ? Math.max(4, (point.value / maxTimeseriesValue) * 100) : 4
                    return (
                      <div key={point.period} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{point.period}</span>
                          <span>{formatTimeseriesValue(point.value, 'aeti')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary/50">
                          <div
                            className="h-2 rounded-full bg-sky-400/80"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {timeseriesPoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No timeseries data available.</p>
                  ) : null}
                </div>
              </IntelligencePanel>
            ) : null}
          </div>
        </>
      ) : null}
    </IntelligenceWorkspaceRoot>
  )
}
