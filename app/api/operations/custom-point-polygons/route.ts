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

function normalizeScore(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(0, Math.min(100, Math.round(input)))
  }
  if (typeof input === 'string') {
    const parsed = Number(input)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)))
    }
  }
  return 0
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

function mapRowToResponse(row: Record<string, any>) {
  return {
    id: row.id,
    pointId: row.custom_point_id,
    name: row.name,
    score: normalizeScore(row.score),
    vertices: normalizeVertices(row.vertices),
    crop: {
      cropName: row.crop_name || '',
      variety: row.crop_variety || '',
      sowingDate: row.sowing_date || '',
      expectedHarvestDate: row.expected_harvest_date || '',
      notes: row.notes || '',
    },
    createdAt: row.created_at,
  }
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

  let query = supabase
    .from('custom_point_polygons')
    .select(
      'id, custom_point_id, name, score, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (pointId) {
    query = query.eq('custom_point_id', pointId)
  }

  const { data, error } = await query
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

  if (!pointId) {
    return NextResponse.json({ error: 'pointId is required' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (vertices.length < 3) {
    return NextResponse.json({ error: 'polygon requires at least 3 vertices' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_point_polygons')
    .insert({
      user_id: user.id,
      custom_point_id: pointId,
      name,
      score,
      vertices,
      crop_name: crop.cropName || null,
      crop_variety: crop.variety || null,
      sowing_date: crop.sowingDate || null,
      expected_harvest_date: crop.expectedHarvestDate || null,
      notes: crop.notes || null,
    })
    .select(
      'id, custom_point_id, name, score, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, created_at'
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(mapRowToResponse(data), { status: 201 })
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

  if (!polygonId) {
    return NextResponse.json({ error: 'polygonId is required' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_point_polygons')
    .update({
      name,
      score,
      crop_name: crop.cropName || null,
      crop_variety: crop.variety || null,
      sowing_date: crop.sowingDate || null,
      expected_harvest_date: crop.expectedHarvestDate || null,
      notes: crop.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', polygonId)
    .eq('user_id', user.id)
    .select(
      'id, custom_point_id, name, score, vertices, crop_name, crop_variety, sowing_date, expected_harvest_date, notes, created_at'
    )
    .maybeSingle()

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
