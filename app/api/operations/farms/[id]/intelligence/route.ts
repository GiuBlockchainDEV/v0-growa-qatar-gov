import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeInsightRows, normalizePolygonRows } from '@/lib/operations/intelligence-normalize'
import { fetchWeatherByCoordinates, getWeatherApiKey } from '@/app/api/weather/_shared'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: farmId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const farmSelectAttempts = [
    'id, name, name_en, name_ar, location, gps_latitude, gps_longitude, area_hectares, organization_id',
    'id, name, name_en, location, gps_latitude, gps_longitude',
    'id, name, location',
  ]

  let farm: Record<string, unknown> | null = null
  for (const select of farmSelectAttempts) {
    const { data, error } = await supabase.from('farms').select(select).eq('id', farmId).maybeSingle()
    if (!error && data) {
      farm = data as Record<string, unknown>
      break
    }
  }

  if (!farm) {
    return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
  }

  const lat = Number(farm.gps_latitude)
  const lng = Number(farm.gps_longitude)

  const [insightsResult, polygonsResult] = await Promise.all([
    supabase.from('farm_crop_insights').select('*').limit(500),
    supabase.from('custom_point_polygons').select('*').limit(500),
  ])

  const insights = normalizeInsightRows(insightsResult.data)
  const polygons = normalizePolygonRows(polygonsResult.data)

  const totalProduction = insights.reduce((s, r) => s + r.estimatedProductionTons, 0)
  const totalWater = insights.reduce((s, r) => s + r.waterConsumptionM3, 0)
  const totalEnergy = insights.reduce((s, r) => s + r.energyConsumptionKwh, 0)
  const avgScore =
    polygons.length > 0 ? polygons.reduce((s, p) => s + p.score, 0) / polygons.length : null

  const crops = [...new Set(insights.map((i) => i.cropName))]

  let weather: Record<string, unknown> | null = null
  if (Number.isFinite(lat) && Number.isFinite(lng) && getWeatherApiKey()) {
    try {
      weather = await fetchWeatherByCoordinates({ latitude: lat, longitude: lng }) as Record<string, unknown>
    } catch {
      weather = null
    }
  }

  return NextResponse.json({
    farm: {
      id: String(farm.id),
      name: String(farm.name || farm.name_en || farm.id),
      location: farm.location ? String(farm.location) : null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      areaHectares: farm.area_hectares ? Number(farm.area_hectares) : null,
      organizationId: farm.organization_id ? String(farm.organization_id) : null,
    },
    production: {
      totalProductionTons: totalProduction,
      crops,
      insightCount: insights.length,
    },
    water: { totalM3: totalWater, intensityM3PerTon: totalProduction > 0 ? totalWater / totalProduction : null },
    energy: { totalKwh: totalEnergy, intensityKwhPerTon: totalProduction > 0 ? totalEnergy / totalProduction : null },
    cropHealth: { averagePolygonScore: avgScore, polygonCount: polygons.length },
    weather,
    dataQuality: {
      hasGps: Number.isFinite(lat) && Number.isFinite(lng),
      hasProductionData: insights.length > 0,
      hasWeatherData: weather !== null,
      lastUpdated: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
  })
}
