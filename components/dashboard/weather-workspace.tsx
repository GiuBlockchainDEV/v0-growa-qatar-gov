'use client'

import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Gauge,
  Loader2,
  MapPin,
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

const DEFAULT_LATITUDE = '25.2854'
const DEFAULT_LONGITUDE = '51.5310'
const DEFAULT_REQUESTED_AT = '2026-06-02T05:30:00Z'

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

function MetricCard({ definition, reading }: { definition: MetricDefinition; reading: WeatherReadingResponse | null }) {
  const value = metricValue(reading, definition.key)
  const completion = metricCompletion(value, definition.max)

  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{definition.label}</p>
        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{formatMetric(value, definition.decimals, definition.unit)}</p>
      {completion !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full" style={{ width: `${completion}%`, backgroundColor: definition.accent }} />
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-white/35">{definition.key}</p>
    </div>
  )
}

function SectionCard({ section, reading }: { section: MetricSection; reading: WeatherReadingResponse | null }) {
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
          Live cell
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {section.metrics.map((definition) => (
          <MetricCard key={definition.key} definition={definition} reading={reading} />
        ))}
      </div>
    </section>
  )
}

export function WeatherWorkspace() {
  const [latitude, setLatitude] = useState(DEFAULT_LATITUDE)
  const [longitude, setLongitude] = useState(DEFAULT_LONGITUDE)
  const [requestedAt, setRequestedAt] = useState(DEFAULT_REQUESTED_AT)
  const [reading, setReading] = useState<WeatherReadingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWeather = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ latitude: latitude.trim(), longitude: longitude.trim() })
      if (requestedAt.trim()) params.set('requested_at', requestedAt.trim())

      const response = await fetch(`/api/weather/by-coordinates?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = asRecord(payload)?.error
        throw new Error(typeof message === 'string' ? message : 'Failed to load weather data')
      }
      setReading(asRecord(payload) as WeatherReadingResponse | null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load weather data')
      setReading(null)
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude, requestedAt])

  useEffect(() => {
    loadWeather()
  }, [loadWeather])

  const summary = useMemo(() => {
    const displayLatitude = reading?.coordinate?.latitude ?? toNumber(latitude)
    const displayLongitude = reading?.coordinate?.longitude ?? toNumber(longitude)
    return {
      cellId: reading?.cell_id || 'N/A',
      gridSize: reading?.grid_size_m ? `${reading.grid_size_m / 1000} km` : '5 km',
      country: countryLabel(reading?.country),
      matchedTimestamp: formatTimestamp(reading?.matched_timestamp || reading?.stored_at || reading?.requested_at),
      dataSource: reading?.data_source || 'Weather API',
      coordinate:
        displayLatitude !== null && displayLongitude !== null
          ? `${displayLatitude.toFixed(4)}, ${displayLongitude.toFixed(4)}`
          : 'N/A',
    }
  }, [latitude, longitude, reading])

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
                Coordinate-based weather, light and agronomic intelligence over Qatar: 510 weather cells at 5 km
                resolution with solar radiation assigned from a 10 km light grid.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-primary">WEATHER: 5 KM</div>
              <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-200">LIGHT: 10 KM</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">CELLS: 510</div>
              <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-foreground">SOURCE: API</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Latitude</span>
            <input value={latitude} onChange={(event) => setLatitude(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" inputMode="decimal" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Longitude</span>
            <input value={longitude} onChange={(event) => setLongitude(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" inputMode="decimal" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Requested at</span>
            <input value={requestedAt} onChange={(event) => setRequestedAt(event.target.value)} className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-foreground outline-none focus:border-primary" placeholder="2026-06-02T05:30:00Z" />
          </label>
          <button type="button" onClick={loadWeather} disabled={loading} className="self-end rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading</span>
            ) : (
              <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" />Load cell</span>
            )}
          </button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={MapPin} label="Cell" value={summary.cellId} detail={summary.country} primary />
        <SummaryCard label="Coordinate" value={summary.coordinate} detail="Resolved point" />
        <SummaryCard icon={Compass} label="Grid" value={summary.gridSize} detail="Weather/agro resolution" />
        <SummaryCard icon={SunMedium} label="Solar grid" value="10 km" detail="Light radiation layer" valueClassName="text-amber-300" />
        <SummaryCard label="Snapshot" value={summary.matchedTimestamp} detail="Nearest requested time" smallValue />
        <SummaryCard icon={Sprout} label="Source" value={summary.dataSource} detail="OpenWeather + Open-Meteo grid" smallValue />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {metricSections.map((section) => (
          <SectionCard key={section.title} section={section} reading={reading} />
        ))}
        <section className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Droplets className="h-5 w-5 text-primary" />
            Operational grouping
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Raw API field names remain visible on every metric so analysts can trace each value back to the weather,
            solar or agronomy payload while reading the data in operational groups.
          </p>
        </section>
      </div>
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
