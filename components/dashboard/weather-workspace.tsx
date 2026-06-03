'use client'

import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  CloudRain,
  CloudSun,
  Compass,
  Grid3X3,
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

interface GridCellResult {
  id: string
  latitude: number
  longitude: number
  gridSizeM: number
  row: number
  col: number
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
const TOTAL_QATAR_GRID_CELLS = 510

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
}: {
  section: MetricSection
  reading: WeatherReadingResponse | null
  selectedMetricKey: string | null
  onMetricSelect: (metric: MetricDefinition) => void
}) {
  const Icon = section.icon
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]">
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
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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

function TrendChart({ metric, historyPoints }: { metric: MetricDefinition | null; historyPoints: HistoryPoint[] }) {
  const values = useMemo(() => {
    if (!metric) return []
    return historyPoints
      .map((point) => ({
        label: formatTimestamp(point.reading?.matched_timestamp || point.requestedAt),
        value: readingNumber(point.reading, metric.key),
      }))
      .filter((point): point is { label: string; value: number } => point.value !== null)
  }, [historyPoints, metric])

  if (!metric) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
        Click any metric card above to show its historical trend here.
      </div>
    )
  }

  if (values.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
        Not enough historical points for {metric.label}. Select a weather grid point or load a cell first.
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
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{metric.label}</p>
          <p className="text-xs text-muted-foreground">{metric.key}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Min {formatMetric(min, metric.decimals, metric.unit)}</p>
          <p>Max {formatMetric(max, metric.decimals, metric.unit)}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-56 w-full overflow-visible">
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(148,163,184,0.25)" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="rgba(148,163,184,0.25)" />
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingY + ratio * (height - paddingY * 2)
          return <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.12)" />
        })}
        <polyline points={polyline} fill="none" stroke={metric.accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill={metric.accent} stroke="#0b0f14" strokeWidth="2" />
            <title>{`${point.label}: ${formatMetric(point.value, metric.decimals, metric.unit)}`}</title>
          </g>
        ))}
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
  const [gridCells, setGridCells] = useState<GridCellResult[]>([])
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null)
  const [chartModalOpen, setChartModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [gridLoading, setGridLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const selectedMetric = useMemo(
    () => flatMetrics.find((metric) => metric.key === selectedMetricKey) || null,
    [selectedMetricKey]
  )

  const loadHistory = useCallback(async (latValue: string, lonValue: string, requestedAtValue: string) => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const params = new URLSearchParams({
        latitude: latValue.trim(),
        longitude: lonValue.trim(),
        count: '90',
        interval_hours: '1',
      })
      if (requestedAtValue.trim()) params.set('requested_at', requestedAtValue.trim())

      const response = await fetch(`/api/weather/history/by-coordinates?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = asRecord(payload)?.error
        throw new Error(typeof message === 'string' ? message : 'Failed to load weather history')
      }
      const points = Array.isArray(asRecord(payload)?.points) ? (asRecord(payload)?.points as HistoryPoint[]) : []
      setHistoryPoints(points)
      if (points.length === 0) setHistoryError('No historical readings returned for this cell yet.')
    } catch (historyLoadError) {
      setHistoryPoints([])
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Failed to load 90 historical readings')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const loadWeatherFor = useCallback(
    async (latValue: string, lonValue: string, requestedAtValue: string) => {
      if (!latValue.trim() || !lonValue.trim()) {
        setReading(null)
        setHistoryPoints([])
        setError(null)
        return
      }

      try {
        setLoading(true)
        setError(null)
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
        setReading(asRecord(payload) as WeatherReadingResponse | null)
        loadHistory(latValue, lonValue, requestedAtValue)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load weather data')
        setReading(null)
        setHistoryPoints([])
      } finally {
        setLoading(false)
      }
    },
    [loadHistory]
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

  const loadNationalGrid = useCallback(async () => {
    try {
      setGridLoading(true)
      setGridError(null)
      const params = new URLSearchParams({ limit: String(TOTAL_QATAR_GRID_CELLS) })
      if (requestedAt.trim()) params.set('requested_at', requestedAt.trim())
      const response = await fetch(`/api/weather/grid?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const record = asRecord(payload)
        const message = record?.error
        const hint = record?.hint
        throw new Error(`${typeof message === 'string' ? message : 'Failed to load Qatar weather grid'}${typeof hint === 'string' ? `. ${hint}` : ''}`)
      }
      const cells = Array.isArray(asRecord(payload)?.cells) ? (asRecord(payload)?.cells as GridCellResult[]) : []
      setGridCells(cells)
    } catch (gridLoadError) {
      setGridError(gridLoadError instanceof Error ? gridLoadError.message : 'Failed to load Qatar weather grid')
      setGridCells([])
    } finally {
      setGridLoading(false)
    }
  }, [requestedAt])

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

  const gridStats = useMemo(() => {
    const successfulCells = gridCells.filter((cell) => cell.reading)
    const temperatures = successfulCells.map((cell) => readingNumber(cell.reading, 'temperature_c')).filter((value): value is number => value !== null)
    const waterStressValues = successfulCells.map((cell) => readingNumber(cell.reading, 'water_stress_index_0_100')).filter((value): value is number => value !== null)
    const averageTemperature = temperatures.length > 0 ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null
    const maxWaterStress = waterStressValues.length > 0 ? Math.max(...waterStressValues) : null
    return {
      loaded: gridCells.length,
      successful: successfulCells.length,
      failed: gridCells.length - successfulCells.length,
      averageTemperature,
      maxWaterStress,
    }
  }, [gridCells])

  const historyRows = historyPoints.map((point) => ({
    timestamp: formatTimestamp(point.reading?.matched_timestamp || point.requestedAt),
    temperature: formatMetric(metricValue(point.reading, 'temperature_c'), 1, ' C'),
    humidity: formatMetric(metricValue(point.reading, 'humidity_percent'), 1, '%'),
    solar: formatMetric(metricValue(point.reading, 'solar_ghi_w_m2'), 1, ' W/m2'),
    stress: formatMetric(metricValue(point.reading, 'water_stress_index_0_100'), 1, '/100'),
  }))

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
                Select one of the 510 yellow grid points on the lateral map. The panel stays empty until a point is selected;
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1.2fr_auto_auto]">
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
          <button type="button" onClick={loadNationalGrid} disabled={gridLoading} className="self-end rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60">
            {gridLoading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Grid</span> : <span className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" />Load grid data</span>}
          </button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        {gridError && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{gridError}</div>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={MapPin} label="Cell" value={summary.cellId} detail={summary.country} primary={hasSelection} />
        <SummaryCard label="Coordinate" value={summary.coordinate} detail="Selected grid point" />
        <SummaryCard icon={Compass} label="Grid" value={summary.gridSize} detail="Weather/agro resolution" />
        <SummaryCard icon={SunMedium} label="Solar grid" value="10 km" detail="Light radiation layer" valueClassName="text-amber-300" />
        <SummaryCard label="Snapshot" value={summary.matchedTimestamp} detail="Nearest requested time" smallValue />
        <SummaryCard icon={Sprout} label="Source" value={hasSelection ? summary.dataSource : 'Waiting'} detail="OpenWeather + Open-Meteo grid" smallValue />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {metricSections.map((section) => (
          <SectionCard
            key={section.title}
            section={section}
            reading={reading}
            selectedMetricKey={selectedMetricKey}
            onMetricSelect={(metric) => {
              setSelectedMetricKey(metric.key)
              setChartModalOpen(true)
            }}
          />
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Historical table
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Nearest stored snapshots every 3 hours ending at the requested timestamp.</p>
          </div>
          {historyLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Snapshot</th>
                <th className="px-3 py-2.5 font-medium">Temp</th>
                <th className="px-3 py-2.5 font-medium">Humidity</th>
                <th className="px-3 py-2.5 font-medium">GHI</th>
                <th className="px-3 py-2.5 font-medium">Water stress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {historyRows.length === 0 ? (
                <tr><td className="px-3 py-4 text-muted-foreground" colSpan={5}>No historical snapshots loaded.</td></tr>
              ) : (
                historyRows.map((row, index) => (
                  <tr key={`${row.timestamp}-${index}`} className={index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'}>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.timestamp}</td>
                    <td className="px-3 py-2.5">{row.temperature}</td>
                    <td className="px-3 py-2.5">{row.humidity}</td>
                    <td className="px-3 py-2.5">{row.solar}</td>
                    <td className="px-3 py-2.5 text-primary">{row.stress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Grid3X3 className="h-5 w-5 text-amber-300" />
              Qatar 5 km weather grid data
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">The map points are always visible. This table loads API values for all 510 cells on demand.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">Loaded: {gridStats.loaded}/{TOTAL_QATAR_GRID_CELLS}</div>
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">OK: {gridStats.successful}</div>
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">Avg temp: {formatMetric(gridStats.averageTemperature, 1, ' C')}</div>
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">Max stress: {formatMetric(gridStats.maxWaterStress, 1, '/100')}</div>
          </div>
        </div>
        <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Grid</th>
                <th className="px-3 py-2.5 font-medium">API cell</th>
                <th className="px-3 py-2.5 font-medium">Coordinate</th>
                <th className="px-3 py-2.5 font-medium">Temp</th>
                <th className="px-3 py-2.5 font-medium">GHI</th>
                <th className="px-3 py-2.5 font-medium">Water stress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {gridCells.length === 0 ? (
                <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>Click "Load grid data" to fetch API values for all cells.</td></tr>
              ) : (
                gridCells.map((cell, index) => (
                  <tr key={cell.id} onClick={() => selectCoordinate(cell.latitude, cell.longitude, cell.id)} className={`cursor-pointer transition-colors hover:bg-primary/10 ${index % 2 === 0 ? 'bg-card/60' : 'bg-secondary/20'}`}>
                    <td className="px-3 py-2.5 font-medium text-foreground">{cell.id}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{cell.reading?.cell_id || (cell.error ? 'Error' : 'N/A')}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{cell.latitude.toFixed(4)}, {cell.longitude.toFixed(4)}</td>
                    <td className="px-3 py-2.5">{formatMetric(metricValue(cell.reading, 'temperature_c'), 1, ' C')}</td>
                    <td className="px-3 py-2.5">{formatMetric(metricValue(cell.reading, 'solar_ghi_w_m2'), 1, ' W/m2')}</td>
                    <td className="px-3 py-2.5 text-primary">{formatMetric(metricValue(cell.reading, 'water_stress_index_0_100'), 1, '/100')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {chartModalOpen && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-[#070a10] p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary">Last 90 readings</p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {selectedMetric?.label || 'Metric trend'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Historical trend for the selected cell based on the latest 90 hourly nearest snapshots.
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
            {historyLoading && <div className="mt-4 text-sm text-primary">Loading 90 readings...</div>}
            {historyError && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{historyError}</div>}
            <div className="mt-5">
              <TrendChart metric={selectedMetric} historyPoints={historyPoints} />
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
