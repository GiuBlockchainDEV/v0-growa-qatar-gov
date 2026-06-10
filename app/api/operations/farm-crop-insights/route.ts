import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface FarmCropInsightPayload {
  pointId: string
  cropName: string
  estimatedProductionTons: number
  energyConsumptionKwh: number
  waterConsumptionM3: number
  externalUrl: string
}

const SELECT_WITH_ALL_FIELDS =
  'id, user_id, custom_point_id, crop_name, estimated_production_tons, energy_consumption_kwh, water_consumption_m3, external_url, created_at'

const SELECT_WITHOUT_EXTERNAL_URL =
  'id, user_id, custom_point_id, crop_name, estimated_production_tons, energy_consumption_kwh, water_consumption_m3, created_at'

const SELECT_WITHOUT_METRICS =
  'id, user_id, custom_point_id, crop_name, estimated_production, energy_consumption, water_consumption, external_url, created_at'

const SELECT_LEGACY_MIN =
  'id, user_id, custom_point_id, crop_name, created_at'

const SELECT_POLYGON_METRICS =
  'id, custom_point_id, crop_name, estimated_production_tons, energy_consumption_kwh, water_consumption_m3, created_at'

const SELECT_POLYGON_CROPS =
  'id, custom_point_id, crop_name, created_at'

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  const message = error?.message?.toLowerCase() || ''
  const normalizedColumn = columnName.toLowerCase()
  return (
    message.includes('column') &&
    message.includes(normalizedColumn) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

function isMissingRelationError(error: { message?: string } | null | undefined, relationName: string) {
  const message = error?.message?.toLowerCase() || ''
  const normalizedRelation = relationName.toLowerCase()
  return (
    message.includes('relation') &&
    message.includes(normalizedRelation) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
}

function toPositiveNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return Math.round(numeric * 100) / 100
}

function sanitizeExternalUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function normalizePayload(body: unknown): FarmCropInsightPayload | null {
  if (!body || typeof body !== 'object') return null
  const row = body as Record<string, unknown>
  const pointId = typeof row.pointId === 'string' ? row.pointId.trim() : ''
  const cropName = typeof row.cropName === 'string' ? row.cropName.trim() : ''
  if (!pointId || !cropName) return null
  return {
    pointId,
    cropName,
    estimatedProductionTons: toPositiveNumber(row.estimatedProductionTons),
    energyConsumptionKwh: toPositiveNumber(row.energyConsumptionKwh),
    waterConsumptionM3: toPositiveNumber(row.waterConsumptionM3),
    externalUrl: sanitizeExternalUrl(row.externalUrl),
  }
}

function mapRowForResponse(row: Record<string, any>) {
  return {
    id: row.id,
    userId: row.user_id,
    pointId: row.custom_point_id,
    cropName: row.crop_name || '',
    estimatedProductionTons: toPositiveNumber(
      row.estimated_production_tons ?? row.estimated_production ?? 0
    ),
    energyConsumptionKwh: toPositiveNumber(row.energy_consumption_kwh ?? row.energy_consumption ?? 0),
    waterConsumptionM3: toPositiveNumber(row.water_consumption_m3 ?? row.water_consumption ?? 0),
    externalUrl: typeof row.external_url === 'string' ? row.external_url : '',
    createdAt: row.created_at || new Date().toISOString(),
  }
}

async function selectInsights(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pointId?: string
) {
  const attempts = [
    SELECT_WITH_ALL_FIELDS,
    SELECT_WITHOUT_EXTERNAL_URL,
    SELECT_WITHOUT_METRICS,
    SELECT_LEGACY_MIN,
  ]

  for (const selectClause of attempts) {
    let query = supabase
      .from('farm_crop_insights')
      .select(selectClause)
      .eq('user_id', userId)
      .order('crop_name', { ascending: true })

    if (pointId) {
      query = query.eq('custom_point_id', pointId)
    }

    const { data, error } = await query
    if (!error) {
      return { data: data || [], error: null as null }
    }

    const retryable =
      isMissingColumnError(error, 'external_url') ||
      isMissingColumnError(error, 'estimated_production_tons') ||
      isMissingColumnError(error, 'energy_consumption_kwh') ||
      isMissingColumnError(error, 'water_consumption_m3')
    if (!retryable) {
      return { data: [] as any[], error }
    }
  }

  return { data: [] as any[], error: null }
}

async function selectPolygonMetricRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pointId?: string
) {
  const attempts = [SELECT_POLYGON_METRICS, SELECT_POLYGON_CROPS]

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
      isMissingColumnError(error, 'estimated_production_tons') ||
      isMissingColumnError(error, 'energy_consumption_kwh') ||
      isMissingColumnError(error, 'water_consumption_m3')
    if (retryable) continue
    if (isMissingRelationError(error, 'custom_point_polygons')) {
      return { data: [] as any[], error: null as null }
    }
    return { data: [] as any[], error }
  }

  return { data: [] as any[], error: null as null }
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

  const { data, error } = await selectInsights(supabase, user.id, pointId || undefined)
  if (error && !isMissingRelationError(error, 'farm_crop_insights')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const legacyInsightRows = (data || []).map((row) => mapRowForResponse(row))
  const legacyRowsByCropKey = new Map(
    legacyInsightRows.map((row) => [
      `${row.pointId}::${row.cropName.toLowerCase().trim()}`,
      row,
    ])
  )

  const {
    data: polygonMetricRows,
    error: polygonMetricError,
  } = await selectPolygonMetricRows(supabase, user.id, pointId || undefined)
  if (polygonMetricError) {
    return NextResponse.json({ error: polygonMetricError.message }, { status: 500 })
  }

  const aggregateRowsByCropKey = new Map<string, ReturnType<typeof mapRowForResponse>>()
  for (const polygonRow of polygonMetricRows || []) {
    const row = polygonRow as Record<string, unknown>
    const polygonPointId =
      typeof row.custom_point_id === 'string' ? row.custom_point_id.trim() : ''
    const polygonCropName =
      typeof row.crop_name === 'string' ? row.crop_name.trim() : ''
    if (!polygonPointId || !polygonCropName) continue
    const cropKey = `${polygonPointId}::${polygonCropName.toLowerCase()}`
    const legacyRow = legacyRowsByCropKey.get(cropKey)
    const current = aggregateRowsByCropKey.get(cropKey) || {
      id: `aggregate-${polygonPointId}-${polygonCropName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      userId: user.id,
      pointId: polygonPointId,
      cropName: polygonCropName,
      estimatedProductionTons: 0,
      energyConsumptionKwh: 0,
      waterConsumptionM3: 0,
      externalUrl: legacyRow?.externalUrl || '',
      createdAt:
        typeof row.created_at === 'string' && row.created_at.trim()
          ? row.created_at
          : new Date().toISOString(),
    }
    current.estimatedProductionTons += toPositiveNumber(row.estimated_production_tons)
    current.energyConsumptionKwh += toPositiveNumber(row.energy_consumption_kwh)
    current.waterConsumptionM3 += toPositiveNumber(row.water_consumption_m3)
    aggregateRowsByCropKey.set(cropKey, current)
  }

  const mergedRows = Array.from(aggregateRowsByCropKey.values())
  for (const legacyRow of legacyInsightRows) {
    const cropKey = `${legacyRow.pointId}::${legacyRow.cropName.toLowerCase().trim()}`
    if (aggregateRowsByCropKey.has(cropKey)) continue
    mergedRows.push(legacyRow)
  }

  mergedRows.sort((a, b) => {
    if (a.pointId !== b.pointId) return a.pointId.localeCompare(b.pointId)
    return a.cropName.localeCompare(b.cropName)
  })

  return NextResponse.json(mergedRows)
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
  const payload = normalizePayload(body)
  if (!payload) {
    return NextResponse.json(
      { error: 'pointId and cropName are required' },
      { status: 400 }
    )
  }

  let insertBody: Record<string, unknown> = {
    user_id: user.id,
    custom_point_id: payload.pointId,
    crop_name: payload.cropName,
    estimated_production_tons: payload.estimatedProductionTons,
    energy_consumption_kwh: payload.energyConsumptionKwh,
    water_consumption_m3: payload.waterConsumptionM3,
    external_url: payload.externalUrl || null,
  }

  let { data, error } = await supabase
    .from('farm_crop_insights')
    .insert(insertBody)
    .select(SELECT_WITH_ALL_FIELDS)
    .single()

  if (error && isMissingColumnError(error, 'external_url')) {
    delete insertBody.external_url
    ;({ data, error } = await supabase
      .from('farm_crop_insights')
      .insert(insertBody)
      .select(SELECT_WITHOUT_EXTERNAL_URL)
      .single())
  }

  if (error && isMissingColumnError(error, 'estimated_production_tons')) {
    insertBody = {
      user_id: user.id,
      custom_point_id: payload.pointId,
      crop_name: payload.cropName,
      estimated_production: payload.estimatedProductionTons,
      energy_consumption: payload.energyConsumptionKwh,
      water_consumption: payload.waterConsumptionM3,
      external_url: payload.externalUrl || null,
    }
    ;({ data, error } = await supabase
      .from('farm_crop_insights')
      .insert(insertBody)
      .select(SELECT_WITHOUT_METRICS)
      .single())
  }

  if (error && isMissingColumnError(error, 'external_url')) {
    const fallbackBody = { ...insertBody }
    delete fallbackBody.external_url
    ;({ data, error } = await supabase
      .from('farm_crop_insights')
      .insert(fallbackBody)
      .select(SELECT_LEGACY_MIN)
      .single())
  }

  if (error) {
    if (isMissingRelationError(error, 'farm_crop_insights')) {
      return NextResponse.json(
        { error: 'farm_crop_insights table is missing. Run migration 00023_farm_crop_insights.sql first.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Failed to create farm crop insight' }, { status: 500 })
  }

  return NextResponse.json(mapRowForResponse(data), { status: 201 })
}
