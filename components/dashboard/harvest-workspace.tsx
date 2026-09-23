'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  Droplets,
  Leaf,
  Loader2,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Sprout,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { GrowaIntelligencePanel } from '@/components/dashboard/growa-intelligence-panel'
import { HarvestFieldCreatePanel } from '@/components/dashboard/harvest-field-create-panel'
import {
  IntelligenceInvestigationLayout,
  InvestigationContextHeader,
} from '@/components/dashboard/intelligence-investigation-layout'
import {
  IntelligenceMapHint,
  IntelligenceModuleActions,
  IntelligenceWatchtowerChanges,
  IntelligenceWatchtowerForecast,
  IntelligenceWatchtowerSignals,
} from '@/components/dashboard/intelligence-investigation-shared'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useModuleWatchtowerContext } from '@/lib/intelligence/use-module-watchtower-context'
import { buildHarvestGrowaContext } from '@/lib/ai/build-harvest-growa-context'
import type { LatLngVertex } from '@/lib/harvest/geojson'
import {
  IntelligenceCommandLayout,
  IntelligenceDataTable,
  IntelligenceErrorState,
  IntelligenceKpiCard,
  IntelligenceLoadingState,
  IntelligencePanel,
  IntelligenceTableBody,
  IntelligenceTableHead,
  IntelligenceWorkspaceCommand,
  IntelligenceWorkspaceRoot,
} from '@/components/dashboard/intelligence-workspace-ui'
import { useHarvestDashboard } from '@/contexts/harvest-dashboard-context'
import {
  HARVEST_METRIC_META,
  formatHarvestMetricWithUnit,
  harvestMetricColumnHeader,
} from '@/lib/harvest/metrics'
import type {
  HarvestAnalyticsField,
  HarvestAnalyticsResponse,
  HarvestFieldMetrics,
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

const FIELD_KPI_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']
const MAP_METRICS: HarvestMetricKey[] = ['npp', 'aeti', 'tbp', 'bwp', 'rwd']
const TREND_METRICS: HarvestMetricKey[] = ['aeti', 'npp', 'tbp', 'bwp', 'rwd', 'wcu', 'cost']

function formatArea(areaM2: number) {
  if (!Number.isFinite(areaM2)) return '—'
  const hectares = areaM2 / 10_000
  return `${hectares.toFixed(2)} ha`
}

async function fetchJson<T>(url: string): Promise<{ data: T; isDemo: boolean }> {
  const response = await fetch(url, { cache: 'no-store' })
  const isDemo = response.headers.get('X-Harvest-Demo') === 'true'
  const contentType = response.headers.get('content-type') || ''
  const rawBody = await response.text()
  let payload: Record<string, unknown> | null = null

  if (contentType.includes('application/json')) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      throw new Error('Server returned invalid JSON.')
    }
  } else if (rawBody.trim().startsWith('<')) {
    throw new Error(
      `Server returned HTML instead of JSON (${response.status}). The API route may have crashed during raster georeferencing.`
    )
  } else {
    throw new Error(`Unexpected response type: ${contentType || 'unknown'}`)
  }

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
          {HARVEST_METRIC_META[metric].unit}
        </span>
      </div>
      <div className="space-y-1.5">
        {validPoints.slice(-12).map((point) => {
          const width = maxValue > 0 ? Math.max(4, (point.value / maxValue) * 100) : 4
          return (
            <div key={`${metric}-${point.period}`} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="truncate pr-2">{point.period}</span>
                <span>{formatHarvestMetricWithUnit(point.value, metric)}</span>
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
  const watchtower = useModuleWatchtowerContext(['crop_health', 'production', 'weather'])
  const harvestCreateActive = searchParams.get('harvestCreate') === '1'
  const harvestDrawMethod = searchParams.get('harvestDraw') === 'circle' ? 'circle' : 'vertex'
  const selectedMapMetric = (searchParams.get('harvestMetric') || 'npp') as HarvestMetricKey
  const mapGranularity = (searchParams.get('harvestGranularity') || 'season') as HarvestTrendGranularity
  const selectedPeriod = searchParams.get('harvestPeriod')
  const [pendingMapMetric, setPendingMapMetric] = useState<HarvestMetricKey | null>(null)
  const activeMapMetric = pendingMapMetric ?? selectedMapMetric
  const [nationalLoading, setNationalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<HarvestAnalyticsResponse | null>(null)
  const [timeseries, setTimeseries] = useState<HarvestTimeseriesResponse | null>(null)
  const [fieldStats, setFieldStats] = useState<HarvestFieldStatsResponse | null>(null)
  const [fieldRaster, setFieldRaster] = useState<HarvestRasterResponse | null>(null)
  const [fieldDetailLoading, setFieldDetailLoading] = useState(false)
  const [fieldRasterLoading, setFieldRasterLoading] = useState(false)
  const [fieldStatsError, setFieldStatsError] = useState<string | null>(null)
  const [fieldRasterError, setFieldRasterError] = useState<string | null>(null)
  const [trendGranularity, setTrendGranularity] = useState<HarvestTrendGranularity>('dekad')
  const [yieldTask, setYieldTask] = useState<HarvestTaskStatus | null>(null)
  const [yieldLoading, setYieldLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [collectingTasks, setCollectingTasks] = useState<
    Array<{ parcel_id: string; season_id: number; task_id: string }>
  >([])
  const [createRings, setCreateRings] = useState<LatLngVertex[][]>([])
  const [createDraftVertices, setCreateDraftVertices] = useState<LatLngVertex[]>([])
  const [createDrawMethod, setCreateDrawMethod] = useState<'vertex' | 'circle'>(harvestDrawMethod)
  const rasterBlobUrlRef = useRef<string | null>(null)
  const rasterLoadSeqRef = useRef(0)
  const fieldDetailSeqRef = useRef(0)
  const workspaceScrollRef = useRef<HTMLDivElement>(null)

  const {
    mode,
    setMode: setHarvestMode,
    fields,
    catalogLoading,
    catalogError,
    usingDemoData,
    refreshCatalog,
    parcelId,
    activeSeasonId,
    activeField,
    isFieldDetailView,
    selectField: selectFieldFromContext,
    clearFieldSelection,
    startFieldCreate,
    patchActiveSeasonId,
  } = useHarvestDashboard()

  const scrollWorkspaceToTop = useCallback(() => {
    workspaceScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const selectField = useCallback(
    (field: HarvestAnalyticsField) => {
      selectFieldFromContext(field)
    },
    [selectFieldFromContext]
  )

  useEffect(() => {
    const handleFieldSelected = () => scrollWorkspaceToTop()
    window.addEventListener('harvest:field-selected', handleFieldSelected)
    return () => window.removeEventListener('harvest:field-selected', handleFieldSelected)
  }, [scrollWorkspaceToTop])

  useEffect(() => {
    if (!parcelId) return
    scrollWorkspaceToTop()
  }, [parcelId, scrollWorkspaceToTop])

  const activeParcelId = parcelId

  useEffect(() => {
    setCreateDrawMethod(harvestDrawMethod)
  }, [harvestDrawMethod])

  useEffect(() => {
    const handleDrawUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ rings: LatLngVertex[][]; draft: LatLngVertex[] }>).detail
      if (!detail) return
      setCreateRings(Array.isArray(detail.rings) ? detail.rings : [])
      setCreateDraftVertices(Array.isArray(detail.draft) ? detail.draft : [])
    }
    window.addEventListener('harvest:field-draw-update', handleDrawUpdate)
    return () => window.removeEventListener('harvest:field-draw-update', handleDrawUpdate)
  }, [])

  const loadNationalData = useCallback(async () => {
    if (parcelId || harvestCreateActive) {
      setAnalytics(null)
      setTimeseries(null)
      return
    }

    setNationalLoading(true)
    setError(null)

    try {
      const [analyticsResult, timeseriesResult, collectingResult] = await Promise.all([
        fetchJson<HarvestAnalyticsResponse>(`/api/harvest/analytics?mode=${mode}`),
        fetchJson<HarvestTimeseriesResponse>(
          `/api/harvest/timeseries?mode=${mode}&metric=aeti&granularity=dekad`
        ),
        fetchJson<Array<{ parcel_id: string; season_id: number; task_id: string }>>(
          '/api/harvest/collecting'
        ),
      ])

      setAnalytics(analyticsResult.data)
      setTimeseries(timeseriesResult.data)
      setCollectingTasks(collectingResult.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Harvest data')
      setAnalytics(null)
      setTimeseries(null)
    } finally {
      setNationalLoading(false)
    }
  }, [harvestCreateActive, mode, parcelId])

  const loadCollectingTasks = useCallback(async () => {
    try {
      const collectingResult = await fetchJson<
        Array<{ parcel_id: string; season_id: number; task_id: string }>
      >('/api/harvest/collecting')
      setCollectingTasks(collectingResult.data || [])
    } catch {
      // ignore collecting poll errors
    }
  }, [])

  const refreshWorkspace = useCallback(async () => {
    refreshCatalog()
    if (!parcelId) {
      await loadNationalData()
    } else {
      await loadCollectingTasks()
    }
  }, [loadCollectingTasks, loadNationalData, parcelId, refreshCatalog])

  const handleFieldCreated = useCallback(
    (createdParcelId: string, seasonId?: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'harvest')
      params.set('parcelId', createdParcelId)
      params.set('zoom', '13')
      params.set('focus', `harvest-${createdParcelId}`)
      params.set('harvestMetric', 'npp')
      params.set('harvestGranularity', 'season')
      if (seasonId) params.set('harvestSeasonId', String(seasonId))
      params.delete('harvestCreate')
      params.delete('harvestDraw')
      router.replace(`/dashboard?${params.toString()}`)
      void refreshWorkspace()
    },
    [refreshWorkspace, router, searchParams]
  )

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
      const parcelIdForFocus = params.get('parcelId')
      if (parcelIdForFocus) {
        params.set('focus', `harvest-${parcelIdForFocus}`)
      }
      router.replace(`/dashboard?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const seasonIdForParams = activeSeasonId ? String(activeSeasonId) : null
  const latestDekadPeriod = fieldStats?.periods?.at(-1)?.value || null

  useEffect(() => {
    setPendingMapMetric(null)
  }, [selectedMapMetric])

  const buildHarvestMapParamUpdates = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next: Record<string, string | null | undefined> = {
        ...(seasonIdForParams ? { harvestSeasonId: seasonIdForParams } : {}),
        ...updates,
      }
      if (mapGranularity === 'dekad' || updates.harvestGranularity === 'dekad') {
        const period =
          updates.harvestPeriod ??
          selectedPeriod ??
          latestDekadPeriod ??
          null
        if (period) {
          next.harvestPeriod = period
        }
      }
      return next
    },
    [latestDekadPeriod, mapGranularity, seasonIdForParams, selectedPeriod]
  )

  const activeCollectingTask = useMemo(() => {
    if (!activeParcelId) return null
    return (
      collectingTasks.find(
        (entry) =>
          entry.parcel_id === activeParcelId &&
          (!activeSeasonId || entry.season_id === activeSeasonId)
      ) || collectingTasks.find((entry) => entry.parcel_id === activeParcelId) || null
    )
  }, [activeParcelId, activeSeasonId, collectingTasks])

  useEffect(() => {
    setFieldStats(null)
    setFieldStatsError(null)
    setFieldRaster(null)
    setFieldRasterError(null)
    setYieldTask(null)
  }, [activeParcelId])

  const loadFieldDetail = useCallback(async () => {
    if (!activeParcelId || !activeSeasonId) {
      setFieldStats(null)
      setFieldRaster(null)
      return
    }

    const requestId = ++fieldDetailSeqRef.current
    setFieldDetailLoading(true)
    setFieldStatsError(null)
    try {
      const statsResult = await fetchJson<HarvestFieldStatsResponse>(
        `/api/harvest/field/${activeParcelId}/stats?mode=${mode}&season_id=${activeSeasonId}`
      )
      if (requestId !== fieldDetailSeqRef.current) return
      setFieldStats(statsResult.data)
      const resolvedSeasonId = statsResult.data.resolved_season_id ?? statsResult.data.season_id
      if (resolvedSeasonId && resolvedSeasonId !== activeSeasonId) {
        patchActiveSeasonId(resolvedSeasonId)
      }
      const latestPeriod = statsResult.data.periods.at(-1)?.value || null
      if (mapGranularity === 'dekad' && latestPeriod && !selectedPeriod) {
        updateHarvestMapParams({
          harvestGranularity: 'dekad',
          harvestPeriod: latestPeriod,
          harvestSeasonId: String(resolvedSeasonId),
        })
      } else if (resolvedSeasonId !== activeSeasonId) {
        updateHarvestMapParams({
          harvestSeasonId: String(resolvedSeasonId),
        })
      }
    } catch (statsError) {
      if (requestId !== fieldDetailSeqRef.current) return
      setFieldStats(null)
      setFieldStatsError(
        statsError instanceof Error
          ? statsError.message
          : 'Unable to load field statistics for this season.'
      )
    } finally {
      if (requestId === fieldDetailSeqRef.current) {
        setFieldDetailLoading(false)
      }
    }
  }, [
    activeParcelId,
    activeSeasonId,
    mapGranularity,
    mode,
    patchActiveSeasonId,
    selectedPeriod,
    updateHarvestMapParams,
  ])

  const revokeRasterBlobUrl = useCallback(() => {
    if (rasterBlobUrlRef.current) {
      URL.revokeObjectURL(rasterBlobUrlRef.current)
      rasterBlobUrlRef.current = null
    }
  }, [])

  const dispatchRasterOverlay = useCallback(
    (raster: HarvestRasterResponse | null, imageUrl?: string) => {
      if (!raster) {
        revokeRasterBlobUrl()
      }
      window.dispatchEvent(
        new CustomEvent('harvest:raster-overlay', {
          detail: raster
            ? {
                imageUrl: imageUrl || raster.image_url,
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
    },
    [revokeRasterBlobUrl]
  )

  useEffect(() => {
    if (!harvestCreateActive) return
    setFieldStats(null)
    setFieldRaster(null)
    setFieldRasterError(null)
    dispatchRasterOverlay(null)
  }, [dispatchRasterOverlay, harvestCreateActive])

  const selectMapMetric = useCallback(
    (metric: HarvestMetricKey) => {
      setPendingMapMetric(metric)
      setFieldRaster(null)
      setFieldRasterError(null)
      dispatchRasterOverlay(null)
      updateHarvestMapParams(
        buildHarvestMapParamUpdates({
          harvestMetric: metric,
          harvestGranularity: mapGranularity,
        })
      )
    },
    [buildHarvestMapParamUpdates, dispatchRasterOverlay, mapGranularity, updateHarvestMapParams]
  )

  const selectMapGranularity = useCallback(
    (granularity: HarvestTrendGranularity) => {
      setFieldRaster(null)
      setFieldRasterError(null)
      dispatchRasterOverlay(null)
      if (granularity === 'dekad') {
        updateHarvestMapParams(
          buildHarvestMapParamUpdates({
            harvestGranularity: 'dekad',
            harvestPeriod: selectedPeriod || latestDekadPeriod,
          })
        )
        return
      }
      updateHarvestMapParams(
        buildHarvestMapParamUpdates({
          harvestGranularity: 'season',
          harvestPeriod: null,
        })
      )
    },
    [
      buildHarvestMapParamUpdates,
      dispatchRasterOverlay,
      latestDekadPeriod,
      selectedPeriod,
      updateHarvestMapParams,
    ]
  )

  const loadFieldRaster = useCallback(async () => {
    const seasonId = activeSeasonId
    if (!activeParcelId || !seasonId || !Number.isFinite(seasonId)) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      return
    }

    const metricToLoad = activeMapMetric
    if (!MAP_METRICS.includes(metricToLoad)) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      return
    }

    const dekadPeriod = mapGranularity === 'dekad' ? selectedPeriod || latestDekadPeriod : null
    if (mapGranularity === 'dekad' && !dekadPeriod) {
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      setFieldRasterError('Select a dekad period before loading the map layer.')
      return
    }

    const rasterMode = mapGranularity === 'dekad' ? 'current' : mode
    const requestId = ++rasterLoadSeqRef.current

    setFieldRasterLoading(true)
    setFieldRasterError(null)
    try {
      const rasterParams = new URLSearchParams({
        mode: rasterMode,
        metric: metricToLoad,
        granularity: mapGranularity,
        season_id: String(seasonId),
      })
      if (mapGranularity === 'dekad' && dekadPeriod) {
        rasterParams.set('period', dekadPeriod)
      }

      const rasterResult = await fetchJson<HarvestRasterResponse>(
        `/api/harvest/field/${activeParcelId}/raster?${rasterParams.toString()}`
      )
      if (requestId !== rasterLoadSeqRef.current) return

      const imageResponse = await fetch(rasterResult.data.image_url, { cache: 'no-store' })
      if (!imageResponse.ok) {
        throw new Error(`Raster image request failed (${imageResponse.status})`)
      }
      const imageBlob = await imageResponse.blob()
      if (!imageBlob.size) {
        throw new Error('Raster image response was empty')
      }
      if (requestId !== rasterLoadSeqRef.current) return

      revokeRasterBlobUrl()
      const blobImageUrl = URL.createObjectURL(imageBlob)
      rasterBlobUrlRef.current = blobImageUrl

      setFieldRaster(rasterResult.data)
      dispatchRasterOverlay(rasterResult.data, blobImageUrl)
    } catch (rasterError) {
      if (requestId !== rasterLoadSeqRef.current) return
      setFieldRaster(null)
      dispatchRasterOverlay(null)
      setFieldRasterError(
        rasterError instanceof Error
          ? rasterError.message
          : 'Unable to load satellite raster for this field.'
      )
    } finally {
      if (requestId === rasterLoadSeqRef.current) {
        setFieldRasterLoading(false)
      }
    }
  }, [
    activeParcelId,
    activeSeasonId,
    dispatchRasterOverlay,
    mapGranularity,
    mode,
    revokeRasterBlobUrl,
    activeMapMetric,
    latestDekadPeriod,
    selectedPeriod,
  ])

  useEffect(() => {
    void loadNationalData()
  }, [loadNationalData])

  useEffect(() => {
    if (!parcelId) return
    void loadCollectingTasks()
  }, [loadCollectingTasks, parcelId])

  useEffect(() => {
    if (catalogError) {
      setError(catalogError)
    }
  }, [catalogError])

  const loading = catalogLoading || nationalLoading

  useEffect(() => {
    void loadFieldDetail()
  }, [loadFieldDetail])

  useEffect(() => {
    void loadFieldRaster()
  }, [loadFieldRaster])

  useEffect(() => {
    return () => {
      revokeRasterBlobUrl()
      dispatchRasterOverlay(null)
    }
  }, [dispatchRasterOverlay, revokeRasterBlobUrl])

  useEffect(() => {
    if (collectingTasks.length === 0) return undefined

    const intervalId = window.setInterval(() => {
      void fetchJson<Array<{ parcel_id: string; season_id: number; task_id: string }>>(
        '/api/harvest/collecting'
      )
        .then((result) => {
          setCollectingTasks(result.data || [])
        })
        .catch(() => {
          // ignore polling errors
        })
    }, 10_000)

    return () => window.clearInterval(intervalId)
  }, [collectingTasks.length])

  useEffect(() => {
    return () => {
      dispatchRasterOverlay(null)
    }
  }, [dispatchRasterOverlay])

  const startCreateField = useCallback(() => {
    dispatchRasterOverlay(null)
    startFieldCreate('vertex')
  }, [dispatchRasterOverlay, startFieldCreate])

  const updateCreateDrawMethod = useCallback(
    (method: 'vertex' | 'circle') => {
      setCreateDrawMethod(method)
      window.dispatchEvent(
        new CustomEvent('harvest:field-draw-method-change', { detail: { method } })
      )
      if (harvestCreateActive) {
        updateHarvestMapParams({ harvestCreate: '1', harvestDraw: method })
        window.dispatchEvent(new Event('harvest:field-draw-clear-draft'))
        return
      }
      startFieldCreate(method)
    },
    [harvestCreateActive, startFieldCreate, updateHarvestMapParams]
  )

  const clearCreateDraw = useCallback(() => {
    window.dispatchEvent(new Event('harvest:field-draw-clear'))
  }, [])

  const finishCreatePolygon = useCallback(() => {
    window.dispatchEvent(new Event('harvest:field-draw-finish-polygon'))
  }, [])

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

  const growaContext = useMemo(() => {
    if (loading || error || harvestCreateActive) return null

    return buildHarvestGrowaContext({
      view: isFieldDetailView ? 'field' : 'national',
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
      activeMapMetric,
      mapGranularity,
      selectedPeriod,
      trendGranularity,
      fieldTrendSeries,
    })
  }, [
    activeField,
    activeMapMetric,
    analytics,
    collectingTasks,
    error,
    fieldRaster,
    fieldStats,
    fieldTrendSeries,
    fields,
    harvestCreateActive,
    isFieldDetailView,
    loading,
    mapGranularity,
    mode,
    selectedPeriod,
    timeseries,
    trendGranularity,
    usingDemoData,
    yieldTask,
  ])

  const handleClearFieldSelection = useCallback(() => {
    clearFieldSelection()
    setFieldStats(null)
    setFieldRaster(null)
    setYieldTask(null)
    dispatchRasterOverlay(null)
  }, [clearFieldSelection, dispatchRasterOverlay])

  const deleteSelectedField = useCallback(async () => {
    if (!activeField?.parcel_id) return
    const confirmed = window.confirm(
      `Delete field "${activeField.name}"? This action cannot be undone.`
    )
    if (!confirmed) return

    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/harvest/entity/${activeField.parcel_id}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Unable to delete field')
      }

      window.dispatchEvent(new Event('harvest:fields-updated'))
      handleClearFieldSelection()
      await refreshWorkspace()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete field')
    } finally {
      setDeleteLoading(false)
    }
  }, [activeField, handleClearFieldSelection, refreshWorkspace])

  const runYieldEstimate = useCallback(async () => {
    if (!activeField?.parcel_id || !activeSeasonId) return

    setYieldLoading(true)
    setYieldTask(null)

    try {
      const triggerResult = await fetchJson<{ task_id: string }>(
        `/api/harvest/yield/${mode}/${activeField.parcel_id}/${activeSeasonId}`
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
  }, [activeField?.parcel_id, activeSeasonId, mode])

  const updateMode = (nextMode: HarvestMode) => {
    setHarvestMode(nextMode)
  }

  return (
    <IntelligenceWorkspaceRoot ref={workspaceScrollRef} layout="scroll">
      <InvestigationContextHeader
        eyebrow="Intelligence • Satellite & Harvest"
        title={
          isFieldDetailView
            ? activeField?.name ?? (parcelId ? 'Loading field...' : 'Satellite & Harvest Intelligence')
            : 'Satellite & Harvest Intelligence'
        }
        description={
          isFieldDetailView && activeField
            ? `${activeField.crop} • ${formatArea(activeField.area)} • ${activeField.start_date} → ${activeField.harvest_date}`
            : 'Satellite-driven crop health, biomass, water productivity and yield outlook connected to national signals.'
        }
        icon={Sprout}
        meta={[
          {
            label: 'View',
            value: mode === 'current' ? 'Observed' : 'Forecast',
            accent: true,
          },
          { label: 'Fields', value: String(fields.length) },
          {
            label: 'Source',
            value: isFieldDetailView && activeField ? 'Field detail' : 'National analytics',
          },
          {
            label: 'Signals',
            value: String(watchtower.signals.length),
            accent: watchtower.signals.length > 0,
          },
        ]}
      />

      {usingDemoData ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Demo sample data is active. Configure Harvest API credentials on Vercel to load your real
          fields (Hassad N, Baladna, mazrati, etc.).
        </div>
      ) : null}

      {isFieldDetailView ? (
        <button
          type="button"
          onClick={handleClearFieldSelection}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all fields
        </button>
      ) : null}

      <div className="space-y-2">
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
          Observed
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
          Forecast
        </button>
        <button
          type="button"
          onClick={() => startCreateField()}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
            harvestCreateActive
              ? 'border-primary/50 bg-primary/20 text-primary'
              : 'border-primary/30 bg-primary/10 text-primary'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Create field
        </button>
        <button
          type="button"
          onClick={() => void refreshWorkspace()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {mode === 'current'
            ? 'Observed shows satellite-derived values recorded to date for each field.'
            : 'Forecast projects end-of-season values using the predict model (falls back to observed data when forecast is unavailable).'}
        </p>
      </div>

      <OperationalContextBanner />

      {loading && !harvestCreateActive ? (
        <IntelligenceLoadingState message="Loading Harvest analytics..." />
      ) : null}
      {!loading && error && !harvestCreateActive ? <IntelligenceErrorState message={error} /> : null}

      {harvestCreateActive ? (
        <HarvestFieldCreatePanel
          drawMethod={createDrawMethod}
          rings={createRings}
          draftVertices={createDraftVertices}
          onDrawMethodChange={updateCreateDrawMethod}
          onClearDraw={clearCreateDraw}
          onFinishPolygon={finishCreatePolygon}
          onCreated={handleFieldCreated}
        />
      ) : null}

      {!loading && !error && !harvestCreateActive ? (
        <>
          {!isFieldDetailView ? (
            <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {headlineMetrics.map((metric, index) => {
                const meta = HARVEST_METRIC_META[metric.key]
                const icons = [Droplets, Leaf, TrendingUp, Target]
                const Icon = icons[index] || Activity
                return (
                  <IntelligenceKpiCard
                    key={metric.key}
                    label={meta.label}
                    value={formatHarvestMetricWithUnit(metric.value, metric.key, { agg: metric.agg })}
                    icon={Icon}
                    accent={index === 0}
                    tone={index === 2 ? 'sky' : 'default'}
                  />
                )
              })}
            </div>
            <IntelligenceInvestigationLayout
              sectionScrollable={false}
              whatChanged={<IntelligenceWatchtowerChanges changes={watchtower.changes} loading={watchtower.loading} />}
              mapOrTimeseries={<IntelligenceMapHint moduleLabel="harvest fields and crop-health layers" />}
              signals={
                <IntelligenceWatchtowerSignals
                  signals={watchtower.signals}
                  loading={watchtower.loading}
                  module="harvest"
                />
              }
              forecast={
                <IntelligenceWatchtowerForecast
                  outlook={watchtower.outlook}
                  loading={watchtower.loading}
                  domain="production"
                />
              }
              actions={
                <IntelligenceModuleActions
                  module="harvest"
                  mapLayers={['crop-health', 'harvest-forecast', 'fields']}
                />
              }
            />
            </>
          ) : null}

          {isFieldDetailView && !activeField ? (
            <IntelligenceLoadingState message="Loading field details..." />
          ) : null}

          <IntelligenceWorkspaceCommand variant="stacked">
          {isFieldDetailView && activeField ? (
            <IntelligenceCommandLayout
              key={activeField.parcel_id}
              variant="stacked"
              main={
            <div className="space-y-4">
              <IntelligencePanel
                title="Field overview"
                subtitle="KPIs, yield estimate, and field actions"
                icon={Sprout}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
                    {FIELD_KPI_METRICS.map((key) => (
                      <div key={key} className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {HARVEST_METRIC_META[key].label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatHarvestMetricWithUnit(activeField.metrics?.[key], key)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void runYieldEstimate()}
                      disabled={yieldLoading || !activeSeasonId}
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
                        onClick={() => selectMapMetric(metric)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          activeMapMetric === metric
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {`${HARVEST_METRIC_META[metric].label} (${HARVEST_METRIC_META[metric].unit})`}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectMapGranularity('dekad')}
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
                      onClick={() => selectMapGranularity('season')}
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
                        onChange={(event) => {
                          setFieldRaster(null)
                          setFieldRasterError(null)
                          dispatchRasterOverlay(null)
                          updateHarvestMapParams(
                            buildHarvestMapParamUpdates({
                              harvestGranularity: 'dekad',
                              harvestPeriod: event.target.value || null,
                            })
                          )
                        }}
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

                  {activeCollectingTask ? (
                    <p className="text-sm text-amber-300">
                      Geospatial data collection is still in progress for this field. Satellite layers
                      will appear after the task completes.
                    </p>
                  ) : null}

                  {fieldStatsError ? (
                    <p className="text-sm text-amber-300">{fieldStatsError}</p>
                  ) : null}

                  {fieldRasterLoading || fieldDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading raster layer on map...
                    </div>
                  ) : fieldRaster ? (
                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">
                          {HARVEST_METRIC_META[fieldRaster.metric].label} (
                          {HARVEST_METRIC_META[fieldRaster.metric].unit})
                        </span>{' '}
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
                      {fieldRasterError ||
                        'No satellite raster available for this field and metric. Try season map or another metric.'}
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
                        title={`${HARVEST_METRIC_META[metric].label} (${HARVEST_METRIC_META[metric].unit})`}
                        metric={metric}
                        points={fieldTrendSeries[metric] || []}
                      />
                    ))}
                  </div>
                </div>
              </IntelligencePanel>
            </div>
              }
              insights={
                <div className="space-y-4">
                  <IntelligencePanel
                    title="Field signals"
                    subtitle="Quick read on the active field"
                    icon={Activity}
                  >
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">{activeField.name}</span> •{' '}
                        {activeField.crop} • {formatArea(activeField.area)}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {FIELD_KPI_METRICS.slice(0, 4).map((key) => (
                          <div key={key} className="rounded-lg border border-border bg-secondary/20 px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wide">{HARVEST_METRIC_META[key].shortLabel}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {formatHarvestMetricWithUnit(activeField.metrics?.[key], key)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {fieldRaster ? (
                        <p>
                          Active map layer: {HARVEST_METRIC_META[fieldRaster.metric].label} (
                          {fieldRaster.vmin}–{fieldRaster.vmax} {fieldRaster.unit})
                        </p>
                      ) : (
                        <p>No satellite raster loaded yet. Select a metric to enable map analysis.</p>
                      )}
                      {activeCollectingTask ? (
                        <p className="text-amber-300">Geospatial collection still in progress.</p>
                      ) : null}
                    </div>
                  </IntelligencePanel>
                  <IntelligenceInvestigationLayout
                    sectionScrollable={false}
                    signals={
                      <IntelligenceWatchtowerSignals
                        signals={watchtower.signals}
                        loading={watchtower.loading}
                        module="harvest"
                      />
                    }
                    forecast={
                      <IntelligenceWatchtowerForecast
                        outlook={watchtower.outlook}
                        loading={watchtower.loading}
                        domain="production"
                      />
                    }
                    actions={
                      <IntelligenceModuleActions
                        module="harvest"
                        mapLayers={['crop-health', 'harvest-forecast', 'fields']}
                      />
                    }
                  />
                </div>
              }
              assistant={<GrowaIntelligencePanel module="harvest" context={growaContext} />}
            />
          ) : null}

          {!isFieldDetailView ? (
          <IntelligenceCommandLayout
            variant="stacked"
            main={
            <IntelligencePanel
              title="Open-field registry"
              subtitle={
                mode === 'current'
                  ? 'Observed AETI, TBP, and BWP per field'
                  : 'Forecast AETI, TBP, and BWP per field'
              }
              icon={Leaf}
            >
              <IntelligenceDataTable>
                <IntelligenceTableHead>
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Field</th>
                    <th className="px-3 py-2.5 font-medium">Crop</th>
                    <th className="px-3 py-2.5 font-medium">Area</th>
                    <th className="px-3 py-2.5 font-medium">{harvestMetricColumnHeader('aeti')}</th>
                    <th className="px-3 py-2.5 font-medium">{harvestMetricColumnHeader('tbp')}</th>
                    <th className="px-3 py-2.5 font-medium">{harvestMetricColumnHeader('bwp')}</th>
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
                        role="button"
                        tabIndex={0}
                        onClick={() => selectField(field)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            selectField(field)
                          }
                        }}
                        className={`cursor-pointer text-sm transition-colors hover:bg-primary/10 ${
                          parcelId === field.parcel_id
                            ? 'bg-primary/10'
                            : index % 2 === 0
                              ? 'bg-card/60'
                              : 'bg-secondary/20'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          <span className="hover:text-primary hover:underline">{field.name}</span>
                          {collectingTasks.some((entry) => entry.parcel_id === field.parcel_id) ? (
                            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                              Collecting
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{field.crop}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatArea(field.area)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatHarvestMetricWithUnit(field.metrics?.aeti, 'aeti')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatHarvestMetricWithUnit(field.metrics?.tbp, 'tbp')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatHarvestMetricWithUnit(field.metrics?.bwp, 'bwp')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{field.harvest_date}</td>
                      </tr>
                    ))
                  )}
                </IntelligenceTableBody>
              </IntelligenceDataTable>
            </IntelligencePanel>
            }
            insights={
              <>
                <IntelligencePanel
                  title="Water consumption trend"
                  subtitle="National dekad AETI series"
                  icon={Droplets}
                  scrollable
                >
                  <div className="space-y-2">
                    {timeseriesPoints.slice(-12).map((point) => {
                      const width =
                        maxTimeseriesValue > 0 ? Math.max(4, (point.value / maxTimeseriesValue) * 100) : 4
                      return (
                        <div key={point.period} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{point.period}</span>
                            <span>{formatHarvestMetricWithUnit(point.value, 'aeti')}</span>
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

                <IntelligencePanel
                  title="Portfolio signals"
                  subtitle="Outliers and collection status"
                  icon={Target}
                  scrollable
                >
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Collecting:</span>{' '}
                      {collectingTasks.length > 0
                        ? collectingTasks
                            .map((task) => fields.find((field) => field.parcel_id === task.parcel_id)?.name)
                            .filter(Boolean)
                            .join(', ')
                        : 'none'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Mode:</span>{' '}
                      {mode === 'current' ? 'Observed satellite values' : 'Forecast end-of-season values'}
                    </p>
                  </div>
                </IntelligencePanel>
              </>
            }
            assistant={<GrowaIntelligencePanel module="harvest" context={growaContext} />}
          />
          ) : null}
          </IntelligenceWorkspaceCommand>
        </>
      ) : null}
    </IntelligenceWorkspaceRoot>
  )
}
