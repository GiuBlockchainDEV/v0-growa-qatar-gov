import { createClient } from '@/lib/supabase/server'
import { harvestGetAnalytics } from '@/lib/harvest/client'
import { getDemoAnalytics } from '@/lib/harvest/demo-data'
import { normalizeAnalyticsResponse } from '@/lib/harvest/normalize'
import { resolveHarvestDemoMode } from '@/lib/harvest/resolve'
import { fetchWeatherByCoordinates, getWeatherApiKey } from '@/app/api/weather/_shared'
import {
  normalizeInsightRows,
  normalizePolygonRows,
  type InsightRow,
  type PolygonRow,
} from '@/lib/operations/intelligence-normalize'

export interface FarmRecord {
  id: string
  name: string
  location?: string
  gps_latitude?: number | null
  gps_longitude?: number | null
}

export interface SupplySnapshotRecord {
  available_contract_volume_tons: number | null
  at_risk_deliveries_count: number | null
  in_transit_tons: number | null
}

export interface WeatherSample {
  lat: number
  lng: number
  label: string
  temperature?: number
  vpd?: number
  et0?: number
  humidity?: number
  available: boolean
}

export interface HarvestFieldRecord {
  parcel_id: string
  name: string
  crop: string
  metrics?: {
    aeti?: number
    bwp?: number
    rwd?: number
    tbp?: number
  }
}

export interface WatchtowerRawData {
  farms: FarmRecord[]
  insights: InsightRow[]
  polygons: PolygonRow[]
  harvestFields: HarvestFieldRecord[]
  harvestDemo: boolean
  harvestAvailable: boolean
  weatherSamples: WeatherSample[]
  weatherAvailable: boolean
  supply: SupplySnapshotRecord | null
  supplyAvailable: boolean
  fetchedAt: string
}

const WEATHER_SAMPLE_POINTS = [
  { lat: 25.3548, lng: 51.1839, label: 'Doha' },
  { lat: 26.13, lng: 51.215, label: 'Al Shamal' },
  { lat: 25.17, lng: 51.61, label: 'Al Wakrah' },
  { lat: 25.42, lng: 51.4, label: 'Umm Salal' },
  { lat: 25.68, lng: 51.5, label: 'Al Khor' },
]

function toPositiveNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return Math.round(numeric * 100) / 100
}

async function fetchFarms(supabase: Awaited<ReturnType<typeof createClient>>): Promise<FarmRecord[]> {
  const selectAttempts = [
    'id, name, name_en, name_ar, location, gps_latitude, gps_longitude',
    'id, name_en, name_ar, location, gps_latitude, gps_longitude',
    'id, name, location',
  ]

  for (const select of selectAttempts) {
    const { data, error } = await supabase.from('farms').select(select).limit(500)
    if (!error && data) {
      return data.map((row) => {
        const record = row as Record<string, unknown>
        const name =
          (typeof record.name === 'string' && record.name) ||
          (typeof record.name_en === 'string' && record.name_en) ||
          (typeof record.id === 'string' && record.id) ||
          'Farm'
        return {
          id: String(record.id),
          name,
          location: typeof record.location === 'string' ? record.location : undefined,
          gps_latitude:
            typeof record.gps_latitude === 'number' ? record.gps_latitude : Number(record.gps_latitude) || null,
          gps_longitude:
            typeof record.gps_longitude === 'number' ? record.gps_longitude : Number(record.gps_longitude) || null,
        }
      })
    }
  }

  return []
}

async function fetchInsightsAndPolygons(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [insightsResult, polygonsResult] = await Promise.all([
    supabase.from('farm_crop_insights').select('*').limit(1000),
    supabase.from('custom_point_polygons').select('*').limit(1000),
  ])

  return {
    insights: normalizeInsightRows(insightsResult.data),
    polygons: normalizePolygonRows(polygonsResult.data),
  }
}

async function fetchHarvestFields(): Promise<{ fields: HarvestFieldRecord[]; demo: boolean; available: boolean }> {
  const demoMode = resolveHarvestDemoMode()
  try {
    if (demoMode) {
      const demo = getDemoAnalytics('predict')
      return {
        fields: (demo.fields || []).map((field) => ({
          parcel_id: field.parcel_id,
          name: field.name,
          crop: field.crop,
          metrics: field.metrics,
        })),
        demo: true,
        available: true,
      }
    }

    const live = normalizeAnalyticsResponse(await harvestGetAnalytics({ mode: 'predict' }))
    return {
      fields: (live.fields || []).map((field) => ({
        parcel_id: field.parcel_id,
        name: field.name,
        crop: field.crop,
        metrics: field.metrics,
      })),
      demo: false,
      available: true,
    }
  } catch {
    if (!demoMode) {
      try {
        const demo = getDemoAnalytics('predict')
        return {
          fields: (demo.fields || []).map((field) => ({
            parcel_id: field.parcel_id,
            name: field.name,
            crop: field.crop,
            metrics: field.metrics,
          })),
          demo: true,
          available: true,
        }
      } catch {
        return { fields: [], demo: false, available: false }
      }
    }
    return { fields: [], demo: false, available: false }
  }
}

async function fetchWeatherSamples(): Promise<{ samples: WeatherSample[]; available: boolean }> {
  if (!getWeatherApiKey()) {
    return {
      samples: WEATHER_SAMPLE_POINTS.map((point) => ({ ...point, available: false })),
      available: false,
    }
  }

  const samples = await Promise.all(
    WEATHER_SAMPLE_POINTS.map(async (point) => {
      try {
        const reading = await fetchWeatherByCoordinates({
          latitude: point.lat,
          longitude: point.lng,
        })
        const payload = reading as Record<string, unknown>
        const agronomic =
          payload.agronomic && typeof payload.agronomic === 'object'
            ? (payload.agronomic as Record<string, unknown>)
            : {}
        const current =
          payload.current && typeof payload.current === 'object'
            ? (payload.current as Record<string, unknown>)
            : payload

        return {
          ...point,
          temperature: toPositiveNumber(current.temperature ?? current.temp),
          vpd: toPositiveNumber(agronomic.vpd ?? current.vpd),
          et0: toPositiveNumber(agronomic.et0 ?? current.et0),
          humidity: toPositiveNumber(current.humidity),
          available: true,
        }
      } catch {
        return { ...point, available: false }
      }
    })
  )

  const available = samples.some((sample) => sample.available)
  return { samples, available }
}

async function fetchSupplySnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ snapshot: SupplySnapshotRecord | null; available: boolean }> {
  const { data, error } = await supabase
    .from('supply_overview_snapshots')
    .select('available_contract_volume_tons, at_risk_deliveries_count, in_transit_tons')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return { snapshot: null, available: false }
  }

  return {
    snapshot: {
      available_contract_volume_tons: data.available_contract_volume_tons,
      at_risk_deliveries_count: data.at_risk_deliveries_count,
      in_transit_tons: data.in_transit_tons,
    },
    available: true,
  }
}

export async function fetchWatchtowerRawData(): Promise<WatchtowerRawData> {
  const supabase = await createClient()
  const [farms, operations, harvest, weather, supply] = await Promise.all([
    fetchFarms(supabase),
    fetchInsightsAndPolygons(supabase),
    fetchHarvestFields(),
    fetchWeatherSamples(),
    fetchSupplySnapshot(supabase),
  ])

  return {
    farms,
    insights: operations.insights,
    polygons: operations.polygons,
    harvestFields: harvest.fields,
    harvestDemo: harvest.demo,
    harvestAvailable: harvest.available,
    weatherSamples: weather.samples,
    weatherAvailable: weather.available,
    supply: supply.snapshot,
    supplyAvailable: supply.available,
    fetchedAt: new Date().toISOString(),
  }
}
