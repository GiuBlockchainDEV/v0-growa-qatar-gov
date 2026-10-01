'use client'

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildWeatherDashboardParams } from '@/lib/dashboard/weather-url'
import {
  BarChart3,
  CloudRain,
  CloudSun,
  Compass,
  Loader2,
  MapPin,
  MousePointer2,
  RefreshCw,
  Sprout,
  SunMedium,
  ThermometerSun,
  Waves,
  Wind,
} from 'lucide-react'
import { qatarConfig } from '@/lib/config/country-qatar'
import { Card, EmptyState, ErrorState, LoadingState, Notice } from '@/components/brand/layout'
import { Button, Field, Tag } from '@/components/brand/ui'
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
import { useI18n } from '@/lib/i18n'

type WeatherRecord = Record<string, unknown>

interface WeatherReadingResponse {
  stored_at?: string | null
  requested_at?: string | null
  matched_timestamp?: string | null
  data_source?: string
  coordinate?: { latitude?: number; longitude?: number }
  country?: WeatherRecord
  cell_id?: string
  grid_size_m?: number | null
  weather?: WeatherRecord
  solar?: WeatherRecord
  agronomy?: WeatherRecord
}

interface HistoryPoint {
  requestedAt: string
  reading: WeatherReadingResponse | null
  error: string | null
}

interface MetricDefinition {
  key: string
  label: string
  unit?: string
  decimals?: number
  max?: number
  accent: string
}

interface MetricSection {
  title: string
  description: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  accentClassName: string
  metrics: MetricDefinition[]
}

const DEFAULT_REQUESTED_AT = ''

const metricSections: MetricSection[] = [
  {
    title: 'Light',
    description: 'Cloud cover and solar radiation from the 10 km light grid.',
    icon: SunMedium,
    accentClassName: 'text-warning-strong',
    metrics: [
      { key: 'cloudiness_percent', label: 'Cloudiness', unit: '%', decimals: 1, max: 100, accent: '#C9A227' },
      { key: 'solar_dhi_w_m2', label: 'Diffuse irradiance', unit: ' W/m2', decimals: 1, max: 1000, accent: '#E0C9A6' },
      { key: 'solar_dni_w_m2', label: 'Direct normal irradiance', unit: ' W/m2', decimals: 1, max: 1000, accent: '#C9A227' },
      { key: 'solar_ghi_w_m2', label: 'Global horizontal irradiance', unit: ' W/m2', decimals: 1, max: 1100, accent: '#B4644A' },
      { key: 'solar_global_tilted_irradiance_w_m2', label: 'Global tilted irradiance', unit: ' W/m2', decimals: 1, max: 1100, accent: '#B4644A' },
    ],
  },
  {
    title: 'Environment',
    description: 'Thermal, humidity, vapor pressure and fungal risk indicators.',
    icon: ThermometerSun,
    accentClassName: 'text-critical',
    metrics: [
      { key: 'pressure_hpa', label: 'Pressure', unit: ' hPa', decimals: 1, accent: '#D19C8A' },
      { key: 'temperature_c', label: 'Temperature', unit: ' C', decimals: 1, max: 55, accent: '#B4644A' },
      { key: 'humidity_percent', label: 'Humidity', unit: '%', decimals: 1, max: 100, accent: '#5C7A88' },
      { key: 'vpd_kpa', label: 'VPD', unit: ' kPa', decimals: 2, max: 8, accent: '#B4644A' },
      { key: 'fungal_risk_index_0_100', label: 'Fungal risk', unit: '/100', decimals: 1, max: 100, accent: '#55611F' },
      { key: 'actual_vapor_pressure_kpa', label: 'Actual vapor pressure', unit: ' kPa', decimals: 3, max: 10, accent: '#5C7A88' },
      { key: 'thermal_stress_index_0_100', label: 'Thermal stress', unit: '/100', decimals: 1, max: 100, accent: '#A8392B' },
      { key: 'saturation_vapor_pressure_kpa', label: 'Saturation vapor pressure', unit: ' kPa', decimals: 3, max: 12, accent: '#C9A227' },
    ],
  },
  {
    title: 'Wind',
    description: 'Speed, gust and direction for spray and field operations.',
    icon: Wind,
    accentClassName: 'text-content-soft',
    metrics: [
      { key: 'wind_gust_km_h', label: 'Wind gust', unit: ' km/h', decimals: 1, max: 80, accent: '#2F5D50' },
      { key: 'wind_speed_km_h', label: 'Wind speed', unit: ' km/h', decimals: 1, max: 80, accent: '#2F5D50' },
      { key: 'wind_direction_deg', label: 'Wind direction', unit: ' deg', decimals: 0, max: 360, accent: '#5C7A88' },
    ],
  },
  {
    title: 'Rain',
    description: 'Short-window rain and total precipitation for the selected cell.',
    icon: CloudRain,
    accentClassName: 'text-content-soft',
    metrics: [
      { key: 'rain_1h_mm', label: 'Rain 1h', unit: ' mm', decimals: 2, max: 20, accent: '#5C7A88' },
      { key: 'rain_3h_mm', label: 'Rain 3h', unit: ' mm', decimals: 2, max: 30, accent: '#2F5D50' },
      { key: 'precipitation_total_mm', label: 'Total precipitation', unit: ' mm', decimals: 2, max: 40, accent: '#2F5D50' },
    ],
  },
  {
    title: 'Irrigation',
    description: 'Water stress, drift risk and ET0 estimates for irrigation decisions.',
    icon: Waves,
    accentClassName: 'text-content-accent',
    metrics: [
      { key: 'spray_drift_risk_index_0_100', label: 'Spray drift risk', unit: '/100', decimals: 1, max: 100, accent: '#B4644A' },
      { key: 'water_stress_index_0_100', label: 'Water stress', unit: '/100', decimals: 1, max: 100, accent: '#6C8952' },
      { key: 'eto_instant_mm_h', label: 'ET0 instant', unit: ' mm/h', decimals: 3, max: 5, accent: '#6C8952' },
      { key: 'eto_daily_estimated_mm_day', label: 'ET0 daily estimated', unit: ' mm/day', decimals: 2, max: 50, accent: '#55611F' },
    ],
  },
]
const flatMetrics = metricSections.flatMap((section) => section.metrics)

function asRecord(input: unknown): WeatherRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  return input as WeatherRecord
}

function metricValue(reading: WeatherReadingResponse | null, key: string) {
  if (!reading) return null
  const sources: unknown[] = [reading.weather, reading.solar, reading.agronomy, reading]
  for (const source of sources) {
    const record = asRecord(source)
    if (record && key in record) return record[key]
  }
  return null
}

function toNumber(input: unknown) {
  const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  return Number.isFinite(value) ? value : null
}

function formatMetric(input: unknown, decimals = 1, unit = '') {
  const numeric = toNumber(input)
  if (numeric === null) return typeof input === 'string' && input.trim() ? input : '—'
  return `${numeric.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })}${unit}`
}

function formatTimestamp(input?: string | null) {
  if (!input) return '—'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: qatarConfig.timezone,
  })
}

function countryLabel(country?: WeatherRecord) {
  const candidates = country ? [country.name, country.country, country.admin, country.ADMIN, country.iso_a3, country.code] : []
  const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())
  return typeof match === 'string' ? match : 'Qatar'
}

function metricCompletion(value: unknown, max?: number) {
  const numeric = toNumber(value)
  if (numeric === null || !max || max <= 0) return null
  return Math.max(0, Math.min(100, (numeric / max) * 100))
}

function readingNumber(reading: WeatherReadingResponse | null, key: string) {
  return toNumber(metricValue(reading, key))
}

function MetricCard({
  definition,
  reading,
  selected,
  onSelect,
}: {
  definition: MetricDefinition
  reading: WeatherReadingResponse | null
  selected: boolean
  onSelect: () => void
}) {
  const { tr } = useI18n()
  const value = metricValue(reading, definition.key)
  const completion = metricCompletion(value, definition.max)

  /* A tile like the SaaS weather station: small label with the series
     square, the figure LIGHT and large, the unit small beside it. */
  const unit = (definition.unit || '').trim().replace(/^C$/, '°C').replace(/^deg$/, '°')
  const numberText = formatMetric(value, definition.decimals, '')
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`bg-card border p-3.5 text-start transition-colors hover:border-line-strong ${
        selected ? 'border-sage ring-2 ring-sage/25' : 'border-line'
      }`}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] text-content-soft">
          <span aria-hidden="true" className="w-1.5 h-1.5 shrink-0" style={{ borderRadius: 1, background: definition.accent }} />
          {tr(definition.label)}
        </p>
        <BarChart3 strokeWidth={1.5} className={`h-3.5 w-3.5 ${selected ? 'text-content' : 'text-stone-300'}`} />
      </div>
      <p className="growa-figure mt-2 text-content truncate" style={{ fontSize: 28 }}>
        {numberText}
        {unit && numberText !== '—' && (
          <span className="ms-1 text-[12px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>{unit}</span>
        )}
      </p>
      {completion !== null && (
        <div className="mt-3 h-1.5 overflow-hidden" style={{ background: 'var(--growa-stone-200)', borderRadius: 2 }}>
          <div className="h-full" style={{ width: `${completion}%`, backgroundColor: definition.accent, borderRadius: 2 }} />
        </div>
      )}
    </button>
  )
}

function SectionCard({
  section,
  reading,
  selectedMetricKey,
  onMetricSelect,
  highlighted = false,
}: {
  section: MetricSection
  reading: WeatherReadingResponse | null
  selectedMetricKey: string | null
  onMetricSelect: (metric: MetricDefinition) => void
  highlighted?: boolean
}) {
  const { tr } = useI18n()
  return (
    <Card
      icon={section.icon}
      title={tr(section.title)}
      subtitle={tr(section.description)}
      actions={highlighted ? <Tag size="sm" variant="outline-ink">{tr('Selected cell')}</Tag> : null}
    >
      <div className="@container">
      <div className={`grid grid-cols-1 gap-3 ${highlighted ? '@md:grid-cols-2 @3xl:grid-cols-4' : '@md:grid-cols-2'}`}>
        {section.metrics.map((definition) => (
          <MetricCard
            key={definition.key}
            definition={definition}
            reading={reading}
            selected={selectedMetricKey === definition.key}
            onSelect={() => onMetricSelect(definition)}
          />
        ))}
      </div>
      </div>
    </Card>
  )
}

function TrendChart({
  metric,
  historyPoints,
  loading = false,
}: {
  metric: MetricDefinition | null
  historyPoints: HistoryPoint[]
  loading?: boolean
}) {
  const { tr } = useI18n()
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const values = useMemo(() => {
    if (!metric) return []
    return historyPoints
      .map((point) => ({
        label: formatTimestamp(point.reading?.matched_timestamp || point.requestedAt),
        value: readingNumber(point.reading, metric.key),
      }))
      .filter((point): point is { label: string; value: number } => point.value !== null)
  }, [historyPoints, metric])

  useEffect(() => {
    setSelectedPointIndex(null)
  }, [metric?.key, historyPoints])

  if (!metric) {
    return (
      <EmptyState compact title={tr('No metric selected')} description={tr('Click any metric tile to show its trend over the last 24 hours.')} />
    )
  }

  if (loading) {
    return (
      <LoadingState label={tr('Loading last 24h readings…')} className="min-h-72" />
    )
  }

  if (values.length < 2) {
    return (
      <EmptyState compact title={tr('Not enough points for {metric}', { metric: tr(metric.label).toLowerCase() })} description={tr('Select a weather grid cell and try again.')} />
    )
  }

  const width = 720
  const height = 220
  const paddingX = 36
  const paddingY = 28
  const min = Math.min(...values.map((point) => point.value))
  const max = Math.max(...values.map((point) => point.value))
  const spread = max - min || 1
  const points = values.map((point, index) => {
    const x = paddingX + (index / Math.max(1, values.length - 1)) * (width - paddingX * 2)
    const y = paddingY + (1 - (point.value - min) / spread) * (height - paddingY * 2)
    return { ...point, x, y }
  })
  const selectedPoint = selectedPointIndex === null ? null : points[selectedPointIndex] || null
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  /* The SaaS sensor chart: big LIGHT figure, min / max row, a thin line
     over a soft area of its own colour, dotted guides, and only the last
     (or the chosen) reading marked. */
  const last = points[points.length - 1]
  const marked = selectedPoint || last
  const area = `${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`
  const gradientId = `trend-${metric.key}`
  const unit = (metric.unit || '').trim().replace(/^C$/, '°C').replace(/^deg$/, '°')
  return (
    <div>
      <p className="growa-figure text-content" style={{ fontSize: 48 }}>
        {formatMetric(marked.value, metric.decimals, '')}
        <span className="ms-1.5 text-[14px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>{unit}</span>
      </p>
      <div className="mt-1 flex items-center justify-between text-[13px] text-content-soft">
        <span>{tr('Min')} <span className="text-content tabular-nums">{formatMetric(min, metric.decimals, metric.unit)}</span></span>
        <span>{selectedPoint ? selectedPoint.label : tr('Latest reading')}</span>
        <span>{tr('Max')} <span className="text-content tabular-nums">{formatMetric(max, metric.decimals, metric.unit)}</span></span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-56 w-full overflow-visible" role="img" aria-label={tr('{metric}, last 24 hours', { metric: tr(metric.label) })}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={metric.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingY + ratio * (height - paddingY * 2)
          return <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#CBD0C5" strokeDasharray="1 4" />
        })}
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E1E4DC" />
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline points={polyline} fill="none" stroke={metric.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r="9"
            fill="transparent"
            className="cursor-pointer"
            onClick={() => setSelectedPointIndex(index)}
          >
            <title>{`${point.label}: ${formatMetric(point.value, metric.decimals, metric.unit)}`}</title>
          </circle>
        ))}
        {/* Square data point: the brand has no dots. */}
        <rect x={marked.x - 5} y={marked.y - 5} width="10" height="10" rx="1.5" fill={metric.accent} stroke="#FFFFFF" strokeWidth="2" pointerEvents="none" />
      </svg>
      <div className="mt-1 flex justify-between text-[12px] text-content-soft">
        <span>{tr('24h ago')}</span>
        <span>{tr('Now')}</span>
      </div>
      <p className="mt-1 text-end text-[12px] text-content-soft">{tr('{count} data points', { count: values.length })}</p>
    </div>
  )
}

export function WeatherWorkspace() {
  const { tr } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const watchtower = useModuleWatchtowerContext(['weather', 'crop_health'])
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [requestedAt, setRequestedAt] = useState(DEFAULT_REQUESTED_AT)
  const [reading, setReading] = useState<WeatherReadingResponse | null>(null)
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([])
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null)
  const [chartModalOpen, setChartModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const historyCacheRef = useRef<Record<string, HistoryPoint[]>>({})
  const activeHistoryKeyRef = useRef<string>('')
  const historyPrefetchAbortRef = useRef<AbortController | null>(null)

  const selectedMetric = useMemo(
    () => flatMetrics.find((metric) => metric.key === selectedMetricKey) || null,
    [selectedMetricKey]
  )

  const getHistoryCacheKey = useCallback((latValue: string, lonValue: string, requestedAtValue: string) => {
    return `${Number(latValue).toFixed(5)}:${Number(lonValue).toFixed(5)}:${requestedAtValue.trim() || 'latest'}`
  }, [])

  const loadHistory = useCallback(
    async (
      latValue: string,
      lonValue: string,
      requestedAtValue: string,
      options: { prefetch?: boolean; signal?: AbortSignal } = {}
    ) => {
      const cacheKey = getHistoryCacheKey(latValue, lonValue, requestedAtValue)
      const cached = historyCacheRef.current[cacheKey]
      if (cached) {
        if (!options.prefetch) {
          setHistoryPoints(cached)
          setHistoryError(null)
        }
        return cached
      }

      if (!options.prefetch) {
        setHistoryLoading(true)
        setHistoryError(null)
      }

      try {
        const params = new URLSearchParams({
          latitude: latValue.trim(),
          longitude: lonValue.trim(),
          count: '24',
          interval_hours: '1',
        })
        if (requestedAtValue.trim()) params.set('requested_at', requestedAtValue.trim())

        const response = await fetch(`/api/weather/history/by-coordinates?${params.toString()}`, {
          cache: 'no-store',
          signal: options.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = asRecord(payload)?.error
          throw new Error(typeof message === 'string' ? message : 'Failed to load weather history')
        }
        const points = Array.isArray(asRecord(payload)?.points) ? (asRecord(payload)?.points as HistoryPoint[]) : []

        if (options.prefetch && activeHistoryKeyRef.current !== cacheKey) {
          return []
        }

        historyCacheRef.current[cacheKey] = points
        if (!options.prefetch) {
          setHistoryPoints(points)
          if (points.length === 0) setHistoryError('No historical readings returned for this cell yet.')
        }
        return points
      } catch (historyLoadError) {
        if (options.signal?.aborted) return []
        if (!options.prefetch) {
          setHistoryPoints([])
          setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Failed to load last 24h readings')
        }
        return []
      } finally {
        if (!options.prefetch) {
          setHistoryLoading(false)
        }
      }
    },
    [getHistoryCacheKey]
  )

  const prefetchHistory = useCallback(
    (latValue: string, lonValue: string, requestedAtValue: string) => {
      const cacheKey = getHistoryCacheKey(latValue, lonValue, requestedAtValue)
      activeHistoryKeyRef.current = cacheKey
      if (historyCacheRef.current[cacheKey]) return

      historyPrefetchAbortRef.current?.abort()
      const controller = new AbortController()
      historyPrefetchAbortRef.current = controller
      void loadHistory(latValue, lonValue, requestedAtValue, {
        prefetch: true,
        signal: controller.signal,
      })
    },
    [getHistoryCacheKey, loadHistory]
  )


  const loadWeatherFor = useCallback(
    async (latValue: string, lonValue: string, requestedAtValue: string) => {
      if (!latValue.trim() || !lonValue.trim()) {
        setReading(null)
        setHistoryPoints([])
        setSelectedMetricKey(null)
        setChartModalOpen(false)
        activeHistoryKeyRef.current = ''
        historyPrefetchAbortRef.current?.abort()
        setError(null)
        return
      }

      const selectionKey = getHistoryCacheKey(latValue, lonValue, requestedAtValue)
      activeHistoryKeyRef.current = selectionKey
      historyPrefetchAbortRef.current?.abort()

      try {
        setLoading(true)
        setError(null)
        setReading(null)
        setHistoryPoints([])
        setHistoryError(null)
        setSelectedMetricKey(null)
        setChartModalOpen(false)
        const params = new URLSearchParams({ latitude: latValue.trim(), longitude: lonValue.trim() })
        if (requestedAtValue.trim()) params.set('requested_at', requestedAtValue.trim())

        const response = await fetch(`/api/weather/by-coordinates?${params.toString()}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const record = asRecord(payload)
          const message = record?.error
          const hint = record?.hint
          throw new Error(`${typeof message === 'string' ? message : 'Failed to load weather data'}${typeof hint === 'string' ? `. ${hint}` : ''}`)
        }
        if (activeHistoryKeyRef.current !== selectionKey) return
        setReading(asRecord(payload) as WeatherReadingResponse | null)
        setHistoryPoints([])
        setHistoryError(null)
        prefetchHistory(latValue, lonValue, requestedAtValue)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load weather data')
        setReading(null)
        setHistoryPoints([])
      } finally {
        setLoading(false)
      }
    },
    [getHistoryCacheKey, prefetchHistory]
  )

  const applyWeatherSelection = useCallback(
    (nextLatitude: string, nextLongitude: string, nextRequestedAt: string) => {
      setLatitude(nextLatitude)
      setLongitude(nextLongitude)
      setRequestedAt(nextRequestedAt)
      if (!nextLatitude || !nextLongitude) {
        setReading(null)
        setHistoryPoints([])
        setSelectedMetricKey(null)
        setChartModalOpen(false)
        activeHistoryKeyRef.current = ''
        historyPrefetchAbortRef.current?.abort()
        setError(null)
        return
      }
      loadWeatherFor(nextLatitude, nextLongitude, nextRequestedAt)
    },
    [loadWeatherFor]
  )

  useEffect(() => {
    const nextLatitude = searchParams.get('weatherLat') || ''
    const nextLongitude = searchParams.get('weatherLng') || ''
    const nextRequestedAt =
      searchParams.get('weatherRequestedAt') || searchParams.get('requested_at') || DEFAULT_REQUESTED_AT
    applyWeatherSelection(nextLatitude, nextLongitude, nextRequestedAt)
  }, [applyWeatherSelection, searchParams])

  useEffect(() => {
    const handleGridSelect = (event: Event) => {
      const detail = (event as CustomEvent<{
        lat?: number
        lng?: number
        requestedAt?: string | null
      }>).detail
      if (!detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lng)) return
      const nextRequestedAt = detail.requestedAt || requestedAt || DEFAULT_REQUESTED_AT
      applyWeatherSelection(detail.lat!.toFixed(6), detail.lng!.toFixed(6), nextRequestedAt)
    }

    window.addEventListener('weather:grid-select', handleGridSelect)
    return () => window.removeEventListener('weather:grid-select', handleGridSelect)
  }, [applyWeatherSelection, requestedAt])

  const loadSelectedWeather = useCallback(() => {
    if (!latitude.trim() || !longitude.trim()) {
      setError('Select one of the yellow grid points on the lateral map, or enter latitude and longitude manually.')
      return
    }
    const latValue = Number(latitude)
    const lonValue = Number(longitude)
    if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
      setError('Enter valid latitude and longitude values.')
      return
    }

    const params = buildWeatherDashboardParams(searchParams, {
      lat: latValue,
      lng: lonValue,
      requestedAt,
    })
    params.delete('weatherGridId')
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
    loadWeatherFor(latitude, longitude, requestedAt)
  }, [latitude, loadWeatherFor, longitude, requestedAt, router, searchParams])

  const hasSelection = Boolean(latitude.trim() && longitude.trim())
  const summary = useMemo(() => {
    const displayLatitude = reading?.coordinate?.latitude ?? toNumber(latitude)
    const displayLongitude = reading?.coordinate?.longitude ?? toNumber(longitude)
    return {
      cellId: reading?.cell_id || (hasSelection ? tr('Resolving…') : '—'),
      gridSize: reading?.grid_size_m ? `${reading.grid_size_m / 1000} km` : '5 km',
      country: hasSelection ? countryLabel(reading?.country) : tr('No point selected'),
      matchedTimestamp: hasSelection ? formatTimestamp(reading?.matched_timestamp || reading?.stored_at || reading?.requested_at) : '—',
      dataSource: reading?.data_source || 'Weather API',
      coordinate:
        hasSelection && displayLatitude !== null && displayLongitude !== null
          ? `${displayLatitude.toFixed(4)}, ${displayLongitude.toFixed(4)}`
          : '—',
    }
  }, [hasSelection, latitude, longitude, reading, tr])



  return (
    <div className="growa h-full overflow-y-auto overscroll-contain space-y-4 bg-background p-6 text-content">
      <InvestigationContextHeader
        eyebrow={tr('Intelligence · climate')}
        title={tr('Weather intelligence')}
        description={tr('Qatar 5 km weather grid with ET0, VPD, heat stress and irrigation indicators. Select a grid cell on the map to investigate local conditions.')}
        icon={CloudSun}
        meta={[
          { label: tr('Grid'), value: '5 km', accent: true },
          { label: tr('Cells'), value: '510' },
          { label: tr('Selection'), value: hasSelection ? summary.cellId : tr('None') },
          { label: tr('Signals'), value: String(watchtower.signals.length), accent: watchtower.signals.length > 0 },
        ]}
      />

      <OperationalContextBanner />

      {/* The weather cell and its metric tiles are the module itself: they
          used to sit in a half-width box scrolling at 300px, with the
          coordinate fields squeezed to two letters. */}
      <IntelligenceInvestigationLayout
        wideAnalysis
        currentCondition={
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <SummaryCard icon={MapPin} label={tr('Cell')} value={summary.cellId} detail={summary.country} primary={hasSelection} />
            <SummaryCard label={tr('Coordinate')} value={summary.coordinate} detail={tr('Selected grid point')} smallValue={hasSelection} />
            <SummaryCard icon={Compass} label={tr('Grid')} value={summary.gridSize} detail={tr('Weather/agro resolution')} />
            <SummaryCard icon={SunMedium} label={tr('Solar grid')} value="10 km" detail={tr('Light radiation layer')}  />
            <SummaryCard label={tr('Snapshot')} value={summary.matchedTimestamp} detail={tr('Nearest requested time')} smallValue />
            <SummaryCard icon={Sprout} label={tr('Source')} value={hasSelection ? summary.dataSource : tr('Waiting')} detail={tr('OpenWeather + Open-Meteo grid')} smallValue />
          </div>
        }
        whatChanged={<IntelligenceWatchtowerChanges changes={watchtower.changes} loading={watchtower.loading} />}
        mapOrTimeseries={<IntelligenceMapHint moduleLabel={tr('weather grid cells and climate layers')} />}
        signals={<IntelligenceWatchtowerSignals signals={watchtower.signals} loading={watchtower.loading} />}
        forecast={
          <IntelligenceWatchtowerForecast
            outlook={watchtower.outlook}
            loading={watchtower.loading}
            domain="climate"
          />
        }
        actions={
          <IntelligenceModuleActions
            module="weather"
            mapLayers={['temperature', 'vpd', 'et0', 'heat-stress']}
          />
        }
        primaryAnalysis={
          <div className="space-y-4">
      {!hasSelection && (
        <Notice tone="warning" title={tr('No weather cell selected')}>
          {tr('Click a point of the cream grid on the map to load that 5 km Qatar grid cell.')}
        </Notice>
      )}

      {/* Choosing the cell acts on the view: the command (cream) family. */}
      <Card family="comando" icon={MousePointer2} title={tr('Weather cell')} subtitle={tr('Coordinates of the grid cell and the time to read.')}>
        <div className="@container"><div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @3xl:grid-cols-[1fr_1fr_1.2fr_auto] items-end">
          <Field id="wx-lat" label={tr('Latitude')} value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" placeholder={tr('Select point')} />
          <Field id="wx-lon" label={tr('Longitude')} value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" placeholder={tr('Select point')} />
          <Field id="wx-at" label={tr('Requested at')} value={requestedAt} onChange={(event) => setRequestedAt(event.target.value)} placeholder={tr('Latest available')} />
          <Button onClick={loadSelectedWeather} disabled={loading} aria-busy={loading || undefined}>
            {loading ? <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" role="status" /> : <RefreshCw strokeWidth={1.5} className="h-4 w-4" />}
            {loading ? tr('Loading') : tr('Load cell')}
          </Button>
        </div></div>
        {error && <ErrorState message={tr(error)} className="mt-4" />}
      </Card>

      <div className="space-y-4">
        {metricSections
          .filter((section) => section.title === 'Irrigation')
          .map((section) => (
            <SectionCard
              key={section.title}
              section={section}
              reading={reading}
              selectedMetricKey={selectedMetricKey}
              highlighted
              onMetricSelect={(metric) => {
                setSelectedMetricKey(metric.key)
                setChartModalOpen(true)
                if (latitude.trim() && longitude.trim()) {
                  const cacheKey = getHistoryCacheKey(latitude, longitude, requestedAt)
                  const cached = historyCacheRef.current[cacheKey]
                  if (cached) {
                    setHistoryPoints(cached)
                    setHistoryError(null)
                  } else {
                    loadHistory(latitude, longitude, requestedAt)
                  }
                }
              }}
            />
          ))}

        <div className="@container"><div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
          {metricSections
            .filter((section) => section.title !== 'Irrigation')
            .map((section) => (
              <SectionCard
                key={section.title}
                section={section}
                reading={reading}
                selectedMetricKey={selectedMetricKey}
                onMetricSelect={(metric) => {
                  setSelectedMetricKey(metric.key)
                  setChartModalOpen(true)
                  if (latitude.trim() && longitude.trim()) {
                    const cacheKey = getHistoryCacheKey(latitude, longitude, requestedAt)
                    const cached = historyCacheRef.current[cacheKey]
                    if (cached) {
                      setHistoryPoints(cached)
                      setHistoryError(null)
                    } else {
                      loadHistory(latitude, longitude, requestedAt)
                    }
                  }
                }}
              />
            ))}
        </div></div>
      </div>
          </div>
        }
      />

      {chartModalOpen && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center p-6" style={{ background: 'rgba(17,30,19,.45)' }} role="dialog" aria-modal="true" aria-label={selectedMetric ? tr(selectedMetric.label) : tr('Metric trend')}>
          <div className="growa max-h-[88vh] w-full max-w-4xl overflow-y-auto bg-card p-7" style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-panel-lg)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="growa-eyebrow text-content-soft">{tr('( Last 24h )')}</span>
                <h2 className="mt-2 text-content" style={{ fontSize: 'var(--text-heading)', fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
                  {selectedMetric ? tr(selectedMetric.label) : tr('Metric trend')}
                </h2>
                <p className="mt-1 text-[14px] text-content-soft">
                  {tr('Historical trend for the selected cell based on the latest 24 hourly nearest snapshots.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChartModalOpen(false)}
                className="g-btn g-btn--secondary"
                style={{ height: 36, padding: '0 16px', fontSize: 14 }}
              >
                {tr('Close')}
              </button>
            </div>
            {historyError && <ErrorState message={tr(historyError)} className="mt-4" />}
            <div className="mt-6 pt-5 border-t border-dotted border-line-strong">
              <TrendChart metric={selectedMetric} historyPoints={historyPoints} loading={historyLoading} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  primary = false,
  smallValue = false,
  valueClassName = 'text-content',
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: string
  detail: string
  primary?: boolean
  smallValue?: boolean
  valueClassName?: string
}) {
  return (
    <div className="bg-card border border-line p-4" style={{ borderRadius: 'var(--radius-lg)' }}>
      <p className="flex items-center gap-1.5 text-[12px] text-content-soft">
        {primary ? <span aria-hidden="true" className="w-1.5 h-1.5 bg-sage" style={{ borderRadius: 1 }} /> : Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
        {label}
      </p>
      <p className={`mt-2 text-content break-words ${smallValue ? 'text-[14px] leading-snug' : 'growa-figure'} ${valueClassName}`} style={smallValue ? { fontWeight: 500 } : { fontSize: 24 }}>{value}</p>
      <p className="mt-1 text-[12px] text-content-soft">{detail}</p>
    </div>
  )
}
