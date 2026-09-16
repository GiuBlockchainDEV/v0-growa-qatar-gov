'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  Droplets,
  Leaf,
  Loader2,
  RefreshCw,
  Sprout,
  Target,
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
  HarvestMode,
  HarvestMetricKey,
  HarvestMetricSummary,
  HarvestTaskStatus,
  HarvestTimeseriesResponse,
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

function formatTimeseriesValue(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—'
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

export function HarvestWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parcelId = searchParams.get('parcelId')
  const [mode, setMode] = useState<HarvestMode>(
    searchParams.get('harvestMode') === 'predict' ? 'predict' : 'current'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<HarvestAnalyticsResponse | null>(null)
  const [fields, setFields] = useState<HarvestAnalyticsField[]>([])
  const [timeseries, setTimeseries] = useState<HarvestTimeseriesResponse | null>(null)
  const [selectedField, setSelectedField] = useState<HarvestAnalyticsField | null>(null)
  const [yieldTask, setYieldTask] = useState<HarvestTaskStatus | null>(null)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [isSimulated, setIsSimulated] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const analyticsParams = new URLSearchParams({ mode })
      const fieldsParams = new URLSearchParams({
        mode,
        page: '1',
        perpage: '50',
        sort: 'area',
        order: 'desc',
      })
      const timeseriesParams = new URLSearchParams({
        mode,
        metric: 'aeti',
        granularity: 'dekad',
      })

      const [analyticsResult, fieldsResult, timeseriesResult] = await Promise.all([
        fetchJson<HarvestAnalyticsResponse>(`/api/harvest/analytics?${analyticsParams.toString()}`),
        fetchJson<{ total: number; results: HarvestAnalyticsField[] }>(
          `/api/harvest/fields?${fieldsParams.toString()}`
        ),
        fetchJson<HarvestTimeseriesResponse>(`/api/harvest/timeseries?${timeseriesParams.toString()}`),
      ])

      setIsSimulated(analyticsResult.isDemo || fieldsResult.isDemo || timeseriesResult.isDemo)
      const analyticsPayload = analyticsResult.data
      const fieldsPayload = fieldsResult.data
      const timeseriesPayload = timeseriesResult.data

      setAnalytics(analyticsPayload)
      setFields(fieldsPayload.results || analyticsPayload.fields || [])
      setTimeseries(timeseriesPayload)

      if (parcelId) {
        const match =
          (fieldsPayload.results || []).find((field) => field.parcel_id === parcelId) ||
          (analyticsPayload.fields || []).find((field) => field.parcel_id === parcelId) ||
          null
        setSelectedField(match)
      } else {
        setSelectedField(null)
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

  useEffect(() => {
    void loadData()
  }, [loadData])

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

  const openField = useCallback(
    (field: HarvestAnalyticsField) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'harvest')
      params.set('parcelId', field.parcel_id)
      params.set('harvestMode', mode)
      router.push(`/dashboard?${params.toString()}`)
      setSelectedField(field)
    },
    [mode, router, searchParams]
  )

  const clearFieldSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'harvest')
    params.delete('parcelId')
    params.set('harvestMode', mode)
    router.push(`/dashboard?${params.toString()}`)
    setSelectedField(null)
    setYieldTask(null)
  }, [mode, router, searchParams])

  const runYieldEstimate = useCallback(async () => {
    if (!selectedField?.parcel_id || !selectedField.season_id) return

    setYieldLoading(true)
    setYieldTask(null)

    try {
      const triggerResult = await fetchJson<{ task_id: string }>(
        `/api/harvest/yield/${mode}/${selectedField.parcel_id}/${selectedField.season_id}`
      )
      if (triggerResult.isDemo) setIsSimulated(true)

      let attempts = 0
      while (attempts < 40) {
        const statusResult = await fetchJson<HarvestTaskStatus>(
          `/api/harvest/task/${triggerResult.data.task_id}`
        )
        if (statusResult.isDemo) setIsSimulated(true)
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
            value: parcelId ? 'Field detail' : 'National analytics',
          },
        ]}
      />

      {isSimulated ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Demo data — showing Qatar sample fields while live Harvest credentials are missing or the upstream API
          returned incomplete data. Configure <span className="font-mono">HARVEST_SERVICE_USERNAME</span> and{' '}
          <span className="font-mono">HARVEST_SERVICE_PASSWORD</span> on Vercel, then redeploy to load live data
          from <span className="font-mono">harvest.growa.ai</span>.
        </div>
      ) : null}

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

          {selectedField ? (
            <IntelligencePanel title={selectedField.name} subtitle="Field detail and yield estimation" icon={Sprout}>
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

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {(['aeti', 'tbp', 'bwp', 'cost'] as HarvestMetricKey[]).map((key) => (
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
                  {!selectedField.season_id ? (
                    <span className="text-xs text-muted-foreground">Season id unavailable for this field.</span>
                  ) : null}
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
                          index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'
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

            <IntelligencePanel
              title="Water consumption trend"
              subtitle="Dekad AETI series from Harvest analytics"
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
                        <span>{formatTimeseriesValue(point.value)}</span>
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
          </div>
        </>
      ) : null}
    </IntelligenceWorkspaceRoot>
  )
}
