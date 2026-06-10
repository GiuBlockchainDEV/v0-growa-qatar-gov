import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface PolygonVertex {
  lat: number
  lng: number
}

interface PolygonCropData {
  cropName: string
  variety: string
  sowingDate: string
  expectedHarvestDate: string
  notes: string
}

interface PolygonMetricsData {
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
}

const SELECT_WITH_SCORE_AND_METRICS =
  'id, custom_point_id, name, score, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, estimated_production_tons, energy_consumption_kwh, water_consumption_m3, created_at'
const SELECT_WITH_SCORE =
  'id, custom_point_id, name, score, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, created_at'
const SELECT_WITH_METRICS =
  'id, custom_point_id, name, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, estimated_production_tons, energy_consumption_kwh, water_consumption_m3, created_at'
const SELECT_BASE =
  'id, custom_point_id, name, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, created_at'

function isMissingScoreColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return (
    message.includes('column') &&
    message.includes('score') &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  const message = error?.message?.toLowerCase() || ''
  return (
    message.includes('column') &&
    message.includes(columnName.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

function normalizeScore(input: unknown, fallback = 50): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(0, Math.min(100, Math.round(input)))
  }
  if (typeof input === 'string') {
    const parsed = Number(input)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)))
    }
  }
  return fallback
}

function toPositiveNumber(input: unknown): number {
  const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100) / 100
}

function normalizeVertices(input: unknown): PolygonVertex[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
      const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng }
    })
    .filter((vertex): vertex is PolygonVertex => Boolean(vertex))
}

function normalizeCrop(input: unknown): PolygonCropData {
  if (!input || typeof input !== 'object') {
    return {
      cropName: '',
      variety: '',
      sowingDate: '',
      expectedHarvestDate: '',
      notes: '',
    }
  }
  const row = input as Record<string, unknown>
  return {
    cropName: typeof row.cropName === 'string' ? row.cropName : '',
    variety: typeof row.variety === 'string' ? row.variety : '',
    sowingDate: typeof row.sowingDate === 'string' ? row.sowingDate : '',
    expectedHarvestDate: typeof row.expectedHarvestDate === 'string' ? row.expectedHarvestDate : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
  }
}

function normalizeMetrics(input: unknown): PolygonMetricsData {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    estimatedProductionTons: toPositiveNumber(
      row.estimatedProductionTons ?? row.estimated_production_tons ?? row.estimated_production
    ),
    energyConsumptionKwh: toPositiveNumber(
      row.energyConsumptionKwh ?? row.energy_consumption_kwh ?? row.energy_consumption
    ),
    waterConsumptionM3: toPositiveNumber(
      row.waterConsumptionM3 ?? row.water_consumption_m3 ?? row.water_consumption
    ),
  }
}

function mapRowToResponse(row: Record<string, any>) {
  const metrics = normalizeMetrics(row)
  return {
    id: row.id,
    pointId: row.custom_point_id,
    name: row.name,
    score: normalizeScore(row.score, 50),
    vertices: normalizeVertices(row.vertices),
    crop: {
      cropName: row.crop_name || '',
      variety: row.crop_variety || '',
      sowingDate: row.sowing_date || '',
      expectedHarvestDate: row.expected_harvest_date || '',
      notes: row.notes || '',
    },
    metrics,
    estimatedProductionTons: metrics.estimatedProductionTons,
    energyConsumptionKwh: metrics.energyConsumptionKwh,
    waterConsumptionM3: metrics.waterConsumptionM3,
    createdAt: row.created_at,
  }
}

async function selectPolygons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pointId?: string
) {
  const attempts = [
    SELECT_WITH_SCORE_AND_METRICS,
    SELECT_WITH_SCORE,
    SELECT_WITH_METRICS,
    SELECT_BASE,
  ]

  for (const selectClause of attempts) {
    let query = supabase
      .from('custom_point_polygons')
      .select(selectClause)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (pointId) {
      query = query.eq('custom_point_id', pointId)
    }

    const { data, error } = await query
    if (!error) {
      return { data: data || [], error: null as null }
    }

    const retryable =
      isMissingScoreColumnError(error) ||
      isMissingColumnError(error, 'estimated_production_tons') ||
      isMissingColumnError(error, 'energy_consumption_kwh') ||
      isMissingColumnError(error, 'water_consumption_m3')
    if (!retryable) {
      return { data: [] as any[], error }
    }
  }

  return { data: [] as any[], error: null }
}

async function insertPolygon(
  supabase: Awaited<ReturnType<typeof createClient>>,
  basePayload: Record<string, unknown>,
  score: number,
  metrics: PolygonMetricsData
) {
  const metricPayload = {
    estimated_production_tons: metrics.estimatedProductionTons,
    energy_consumption_kwh: metrics.energyConsumptionKwh,
    water_consumption_m3: metrics.waterConsumptionM3,
  }
  const attempts: Array<{ payload: Record<string, unknown>; select: string }> = [
    { payload: { ...basePayload, score, ...metricPayload }, select: SELECT_WITH_SCORE_AND_METRICS },
    { payload: { ...basePayload, score }, select: SELECT_WITH_SCORE },
    { payload: { ...basePayload, ...metricPayload }, select: SELECT_WITH_METRICS },
    { payload: basePayload, select: SELECT_BASE },
  ]

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('custom_point_polygons')
      .insert(attempt.payload)
      .select(attempt.select)
      .single()

    if (!error) return { data, error: null as null }

    const retryable =
      isMissingScoreColumnError(error) ||
      isMissingColumnError(error, 'estimated_production_tons') ||
      isMissingColumnError(error, 'energy_consumption_kwh') ||
      isMissingColumnError(error, 'water_consumption_m3')
    if (!retryable) return { data: null, error }
  }

  return { data: null, error: new Error('Failed to save polygon') }
}

async function updatePolygon(
  supabase: Awaited<ReturnType<typeof createClient>>,
  polygonId: string,
  userId: string,
  basePayload: Record<string, unknown>,
  score: number,
  metrics: PolygonMetricsData
) {
  const metricPayload = {
    estimated_production_tons: metrics.estimatedProductionTons,
    energy_consumption_kwh: metrics.energyConsumptionKwh,
    water_consumption_m3: metrics.waterConsumptionM3,
  }
  const attempts: Array<{ payload: Record<string, unknown>; select: string }> = [
    { payload: { ...basePayload, score, ...metricPayload }, select: SELECT_WITH_SCORE_AND_METRICS },
    { payload: { ...basePayload, score }, select: SELECT_WITH_SCORE },
    { payload: { ...basePayload, ...metricPayload }, select: SELECT_WITH_METRICS },
    { payload: basePayload, select: SELECT_BASE },
  ]

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('custom_point_polygons')
      .update(attempt.payload)
      .eq('id', polygonId)
      .eq('user_id', userId)
      .select(attempt.select)
      .maybeSingle()

    if (!error) return { data, error: null as null }

    const retryable =
      isMissingScoreColumnError(error) ||
      isMissingColumnError(error, 'estimated_production_tons') ||
      isMissingColumnError(error, 'energy_consumption_kwh') ||
      isMissingColumnError(error, 'water_consumption_m3')
    if (!retryable) return { data: null, error }
  }

  return { data: null, error: new Error('Failed to update polygon') }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const pointId = searchParams.get('pointId')?.trim() || ''

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await selectPolygons(supabase, user.id, pointId || undefined)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data || []).map((row) => mapRowToResponse(row)))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const pointId = typeof body?.pointId === 'string' ? body.pointId.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const score = normalizeScore(body?.score)
  const vertices = normalizeVertices(body?.vertices)
  const crop = normalizeCrop(body?.crop)
  const metrics = normalizeMetrics(body?.metrics ?? body)

  if (!pointId) {
    return NextResponse.json({ error: 'pointId is required' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (vertices.length < 3) {
    return NextResponse.json({ error: 'polygon requires at least 3 vertices' }, { status: 400 })
  }

  const basePayload = {
    user_id: user.id,
    custom_point_id: pointId,
    name,
    vertices,
    crop_name: crop.cropName || null,
    crop_variety: crop.variety || null,
    sowing_date: crop.sowingDate || null,
    expected_harvest_date: crop.expectedHarvestDate || null,
    notes: crop.notes || null,
  }

  const { data, error } = await insertPolygon(supabase, basePayload, score, metrics)
  if (!error && data) {
    return NextResponse.json(mapRowToResponse(data), { status: 201 })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Failed to save polygon' }, { status: 500 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const polygonId = typeof body?.polygonId === 'string' ? body.polygonId.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const score = normalizeScore(body?.score)
  const crop = normalizeCrop(body?.crop)
  const metrics = normalizeMetrics(body?.metrics ?? body)

  if (!polygonId) {
    return NextResponse.json({ error: 'polygonId is required' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const basePayload = {
    name,
    crop_name: crop.cropName || null,
    crop_variety: crop.variety || null,
    sowing_date: crop.sowingDate || null,
    expected_harvest_date: crop.expectedHarvestDate || null,
    notes: crop.notes || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await updatePolygon(supabase, polygonId, user.id, basePayload, score, metrics)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Polygon not found' }, { status: 404 })
  }
  return NextResponse.json(mapRowToResponse(data))
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const polygonId = searchParams.get('polygonId')?.trim() || ''
  const pointId = searchParams.get('pointId')?.trim() || ''

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!polygonId && !pointId) {
    return NextResponse.json({ error: 'polygonId or pointId is required' }, { status: 400 })
  }

  let query = supabase.from('custom_point_polygons').delete().eq('user_id', user.id)
  if (polygonId) {
    query = query.eq('id', polygonId)
  } else {
    query = query.eq('custom_point_id', pointId)
  }

  const { error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
