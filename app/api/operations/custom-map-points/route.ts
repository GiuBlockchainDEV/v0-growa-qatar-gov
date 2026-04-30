import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface PointTypePayload {
  pointType: 'custom' | 'farm' | 'facility' | 'sensor'
}

function normalizePointType(input: unknown): PointTypePayload['pointType'] {
  if (typeof input !== 'string') return 'custom'
  const normalized = input.trim().toLowerCase()
  if (normalized === 'farm' || normalized === 'facility' || normalized === 'sensor' || normalized === 'custom') {
    return normalized
  }
  return 'custom'
}

function normalizeLabel(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim()
}

function normalizeCoordinate(input: unknown): number | null {
  const value =
    typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN
  return Number.isFinite(value) ? value : null
}

function mapRowToResponse(row: Record<string, unknown>) {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    lat: typeof row.lat === 'number' ? row.lat : Number(row.lat) || 0,
    lng: typeof row.lng === 'number' ? row.lng : Number(row.lng) || 0,
    label: typeof row.label === 'string' ? row.label : 'Custom Point',
    pointType: normalizePointType(row.point_type),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('custom_map_points')
    .select('id, user_id, label, lat, lng, point_type, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

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

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const label = normalizeLabel(body?.label)
  const lat = normalizeCoordinate(body?.lat)
  const lng = normalizeCoordinate(body?.lng)
  const pointType = normalizePointType(body?.pointType)

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_map_points')
    .upsert(
      {
        id,
        user_id: user.id,
        label,
        lat,
        lng,
        point_type: pointType,
      },
      { onConflict: 'id' }
    )
    .select('id, user_id, label, lat, lng, point_type, created_at, updated_at')
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

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const label = normalizeLabel(body?.label)
  const pointType = normalizePointType(body?.pointType)

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_map_points')
    .update({
      label,
      point_type: pointType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, user_id, label, lat, lng, point_type, created_at, updated_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Point not found' }, { status: 404 })
  }

  return NextResponse.json(mapRowToResponse(data))
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim() || ''
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('custom_map_points')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
