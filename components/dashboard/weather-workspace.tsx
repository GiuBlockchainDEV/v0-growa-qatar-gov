'use client'

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  icon: ComponentType<{ className?: string }>
  accentClassName: string
  metrics: MetricDefinition[]
}

const DEFAULT_REQUESTED_AT = ''

const metricSections: MetricSection[] = [
  {
    title: 'Light',
    description: 'Cloud cover and solar radiation from the 10 km light grid.',
    icon: SunMedium,
    accentClassName: 'text-amber-300',
    metrics: [
      { key: 'cloudiness_percent', label: 'Cloudiness', unit: '%', decimals: 1, max: 100, accent: '#facc15' },
      { key: 'solar_dhi_w_m2', label: 'Diffuse Irradiance', unit: ' W/m2', decimals: 1, max: 1000, accent: '#fde047' },
      { key: 'solar_dni_w_m2', label: 'Direct Normal Irradiance', unit: ' W/m2', decimals: 1, max: 1000, accent: '#f59e0b' },
      { key: 'solar_ghi_w_m2', label: 'Global Horizontal Irradiance', unit: ' W/m2', decimals: 1, max: 1100, accent: '#fb923c' },
      { key: 'solar_global_tilted_irradiance_w_m2', label: 'Global Tilted Irradiance', unit: ' W/m2', decimals: 1, max: 1100, accent: '#f97316' },
    ],
  },
  {
    title: 'Rain',
    description: 'Short-window rain and total precipitation for the selected cell.',
    icon: CloudRain,
    accentClassName: 'text-sky-300',
    metrics: [
      { key: 'rain_1h_mm', label: 'Rain 1h', unit: ' mm', decimals: 2, max: 20, accent: '#38bdf8' },
      { key: 'rain_3h_mm', label: 'Rain 3h', unit: ' mm', decimals: 2, max: 30, accent: '#0ea5e9' },
      { key: 'precipitation_total_mm', label: 'Total Precipitation', unit: ' mm', decimals: 2, max: 40, accent: '#0284c7' },
    ],
  },
  {
    title: 'Wind',
    description: 'Speed, gust and direction for spray and field operations.',
    icon: Wind,
    accentClassName: 'text-cyan-300',
    metrics: [
      { key: 'wind_gust_km_h', label: 'Wind Gust', unit: ' km/h', decimals: 1, max: 80, accent: '#22d3ee' },
      { key: 'wind_speed_km_h', label: 'Wind Speed', unit: ' km/h', decimals: 1, max: 80, accent: '#06b6d4' },
      { key: 'wind_direction_deg', label: 'Wind Direction', unit: ' deg', decimals: 0, max: 360, accent: '#67e8f9' },
    ],
  },
  {
    title: 'Environment',
    description: 'Thermal, humidity, vapor pressure and fungal risk indicators.',
    icon: ThermometerSun,
    accentClassName: 'text-red-300',
    metrics: [
      { key: 'pressure_hpa', label: 'Pressure', unit: ' hPa', decimals: 1, accent: '#fca5a5' },
      { key: 'temperature_c', label: 'Temperature', unit: ' C', decimals: 1, max: 55, accent: '#fb7185' },
      { key: 'humidity_percent', label: 'Humidity', unit: '%', decimals: 1, max: 100, accent: '#93c5fd' },
      { key: 'vpd_kpa', label: 'VPD', unit: ' kPa', decimals: 2, max: 8, accent: '#f97316' },
      { key: 'fungal_risk_index_0_100', label: 'Fungal Risk', unit: '/100', decimals: 1, max: 100, accent: '#a3e635' },
      { key: 'actual_vapor_pressure_kpa', label: 'Actual Vapor Pressure', unit: ' kPa', decimals: 3, max: 10, accent: '#60a5fa' },
      { key: 'thermal_stress_index_0_100', label: 'Thermal Stress', unit: '/100', decimals: 1, max: 100, accent: '#ef4444' },
      { key: 'saturation_vapor_pressure_kpa', label: 'Saturation Vapor Pressure', unit: ' kPa', decimals: 3, max: 12, accent: '#f59e0b' },
    ],
  },
  {
    title: 'Irrigation',
    description: 'Water stress, drift risk and ET0 estimates for irrigation decisions.',
    icon: Waves,
    accentClassName: 'text-primary',
    metrics: [
      { key: 'spray_drift_risk_index_0_100', label: 'Spray Drift Risk', unit: '/100', decimals: 1, max: 100, accent: '#f97316' },
      { key: 'water_stress_index_0_100', label: 'Water Stress', unit: '/100', decimals: 1, max: 100, accent: '#07f880' },
      { key: 'eto_instant_mm_h', label: 'ET0 Instant', unit: ' mm/h', decimals: 3, max: 5, accent: '#22c55e' },
      { key: 'eto_daily_estimated_mm_day', label: 'ET0 Daily Estimated', unit: ' mm/day', decimals: 2, max: 50, accent: '#16a34a' },
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
  if (numeric === null) return typeof input === 'string' && input.trim() ? input : 'N/A'
  return `${numeric.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })}${unit}`
}

function formatTimestamp(input?: string | null) {
  if (!input) return 'N/A'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
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
  const value = metricValue(reading, definition.key)
  const completion = metricCompletion(value, definition.max)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${
        selected ? 'border-primary/60 bg-primary/10' : 'border-border bg-secondary/25'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{definition.label}</p>
        <BarChart3 className={`h-3.5 w-3.5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{formatMetric(value, definition.decimals, definition.unit)}</p>
      {completion !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full" style={{ width: `${completion}%`, backgroundColor: definition.accent }} />
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-white/35">{definition.key}</p>
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
  const Icon = section.icon
  return (
    <section
      className={`rounded-xl border p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)] ${
        highlighted ? 'border-primary/40 bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Icon className={`h-5 w-5 ${section.accentClassName}`} />
            {section.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
          Click metric
        </div>
      </div>
      <div className={`mt-4 grid grid-cols-1 gap-3 ${highlighted ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'}`}>
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
    </section>
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
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
        Click any metric card above to show its historical trend here.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-border bg-secondary/20 p-8 text-primary">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="mt-3 text-sm font-medium">Loading last 24h readings...</p>
      </div>
    )
  }

  if (values.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
        Not enough historical points for {metric.label}. Select a weather grid cell and try again.
      </div>
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

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{metric.label}</p>
          <p className="text-xs text-muted-foreground">Click a chart point to read its value.</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Min {formatMetric(min, metric.decimals, metric.unit)}</p>
          <p>Max {formatMetric(max, metric.decimals, metric.unit)}</p>
        </div>
      </div>
      {selectedPoint && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <p className="font-semibold text-primary">{formatMetric(selectedPoint.value, metric.decimals, metric.unit)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedPoint.label}</p>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-56 w-full overflow-visible">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(148,163,184,0.25)" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="rgba(148,163,184,0.25)" />
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingY + ratio * (height - paddingY * 2)
          return <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.12)" />
        })}
        <polyline points={polyline} fill="none" stroke={metric.accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => {
          const selected = selectedPointIndex === index
          return (
            <circle
              key={`${point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r={selected ? '7' : '5'}
              fill={selected ? '#07f880' : metric.accent}
              stroke={selected ? '#ffffff' : '#0b0f14'}
              strokeWidth={selected ? '3' : '2'}
              className="cursor-pointer"
              onClick={() => setSelectedPointIndex(index)}
            >
              <title>{`${point.label}: ${formatMetric(point.value, metric.decimals, metric.unit)}`}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

export function WeatherWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  useEffect(() => {
    const nextLatitude = searchParams.get('weatherLat') || ''
    const nextLongitude = searchParams.get('weatherLng') || ''
    const nextRequestedAt = searchParams.get('weatherRequestedAt') || searchParams.get('requested_at') || DEFAULT_REQUESTED_AT
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
  }, [loadWeatherFor, searchParams])

  const loadSelectedWeather = useCallback(() => {
    if (!latitude.trim() || !longitude.trim()) {
      setError('Select one of the yellow grid points on the lateral map, or enter latitude and longitude manually.')
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('module', 'weather')
    params.set('weatherLat', latitude.trim())
    params.set('weatherLng', longitude.trim())
    params.delete('weatherGridId')
    if (requestedAt.trim()) params.set('weatherRequestedAt', requestedAt.trim())
    router.push(`/dashboard?${params.toString()}`)
    loadWeatherFor(latitude, longitude, requestedAt)
  }, [latitude, loadWeatherFor, longitude, requestedAt, router, searchParams])



  const selectCoordinate = useCallback(
    (latValue: number, lonValue: number, gridId?: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('module', 'weather')
      params.set('weatherLat', latValue.toFixed(6))
      params.set('weatherLng', lonValue.toFixed(6))
      if (gridId) params.set('weatherGridId', gridId)
      if (requestedAt.trim()) params.set('weatherRequestedAt', requestedAt.trim())
      router.push(`/dashboard?${params.toString()}`)
    },
    [requestedAt, router, searchParams]
  )

  const hasSelection = Boolean(latitude.trim() && longitude.trim())
  const summary = useMemo(() => {
    const displayLatitude = reading?.coordinate?.latitude ?? toNumber(latitude)
    const displayLongitude = reading?.coordinate?.longitude ?? toNumber(longitude)
    return {
      cellId: reading?.cell_id || (hasSelection ? 'Resolving...' : 'None'),
      gridSize: reading?.grid_size_m ? `${reading.grid_size_m / 1000} km` : '5 km',
      country: hasSelection ? countryLabel(reading?.country) : 'No point selected',
      matchedTimestamp: hasSelection ? formatTimestamp(reading?.matched_timestamp || reading?.stored_at || reading?.requested_at) : 'Select a point',
      dataSource: reading?.data_source || 'Weather API',
      coordinate:
        displayLatitude !== null && displayLongitude !== null
          ? `${displayLatitude.toFixed(4)}, ${displayLongitude.toFixed(4)}`
          : 'Click grid point',
    }
  }, [hasSelection, latitude, longitude, reading])



  return (
    <div className="space-y-6 p-6 pt-20 text-foreground">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_24px_60px_rgba(0,0,0,0.36)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(7,248,128,0.14),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.10),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:30px_30px]" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Qatar Weather Grid</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-4xl font-semibold text-foreground">
                <CloudSun className="h-8 w-8 text-primary" />
                Weather Command
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                Select one of the 510 Growa-green grid cells on the lateral map. The panel stays empty until a point is selected;
                after selection, click any metric card to plot its historical trend.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary">WEATHER: 5 KM</div>
              <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-200">LIGHT: 10 KM</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">POINTS: 510</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">SELECT: MAP</div>
            </div>
          </div>
        </div>
      </div>

      {!hasSelection && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="flex items-center gap-2 font-semibold"><MousePointer2 className="h-4 w-4" />No weather cell selected.</p>
          <p className="mt-1 text-amber-100/75">Click a yellow point on the map at right to load that 5 km Qatar grid cell.</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Latitude</span>
            <input value={latitude} onChange={(event) => setLatitude(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" inputMode="decimal" placeholder="Select point" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Longitude</span>
            <input value={longitude} onChange={(event) => setLongitude(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" inputMode="decimal" placeholder="Select point" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Requested at</span>
            <input value={requestedAt} onChange={(event) => setRequestedAt(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" placeholder="Latest available" />
          </label>
          <button type="button" onClick={loadSelectedWeather} disabled={loading} className="self-end rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading</span> : <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" />Load cell</span>}
          </button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={MapPin} label="Cell" value={summary.cellId} detail={summary.country} primary={hasSelection} />
        <SummaryCard label="Coordinate" value={summary.coordinate} detail="Selected grid point" />
        <SummaryCard icon={Compass} label="Grid" value={summary.gridSize} detail="Weather/agro resolution" />
        <SummaryCard icon={SunMedium} label="Solar grid" value="10 km" detail="Light radiation layer" valueClassName="text-amber-300" />
        <SummaryCard label="Snapshot" value={summary.matchedTimestamp} detail="Nearest requested time" smallValue />
        <SummaryCard icon={Sprout} label="Source" value={hasSelection ? summary.dataSource : 'Waiting'} detail="OpenWeather + Open-Meteo grid" smallValue />
      </div>

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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
        </div>
      </div>


      {chartModalOpen && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-[#070a10] p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary">Last 24h</p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {selectedMetric?.label || 'Metric trend'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Historical trend for the selected cell based on the latest 24 hourly nearest snapshots.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChartModalOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            {historyLoading && <div className="mt-4 text-sm text-primary">Loading last 24h readings...</div>}
            {historyError && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{historyError}</div>}
            <div className="mt-5">
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
  valueClassName = 'text-foreground',
}: {
  icon?: ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  primary?: boolean
  smallValue?: boolean
  valueClassName?: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${primary ? 'border-primary/30 bg-primary/10' : 'border-border bg-card/80'}`}>
      <p className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] ${primary ? 'text-primary/90' : 'text-muted-foreground'}`}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className={`mt-2 font-semibold ${smallValue ? 'text-sm' : 'text-xl'} ${primary ? 'text-primary' : valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
