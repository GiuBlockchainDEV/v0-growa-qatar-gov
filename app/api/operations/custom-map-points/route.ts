import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface PointTypePayload {
  pointType: 'custom' | 'farm' | 'facility' | 'sensor'
}

const SELECT_WITH_EXTERNAL_URL =
  'id, user_id, label, lat, lng, point_type, external_url, created_at, updated_at'
const SELECT_BASE =
  'id, user_id, label, lat, lng, point_type, created_at, updated_at'

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  const message = error?.message?.toLowerCase() || ''
  return (
    message.includes('column') &&
    message.includes(columnName.toLowerCase()) &&
    (message.includes('does not exist') || message.includes('schema cache'))
  )
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

function normalizeExternalUrl(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
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
    externalUrl: typeof row.external_url === 'string' ? row.external_url : '',
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

  let { data, error } = await supabase
    .from('custom_map_points')
    .select(SELECT_WITH_EXTERNAL_URL)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error && isMissingColumnError(error, 'external_url')) {
    ;({ data, error } = await supabase
      .from('custom_map_points')
      .select(SELECT_BASE)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }))
  }

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
  const externalUrl = normalizeExternalUrl(body?.externalUrl ?? body?.external_url)
  const hasExternalUrlInput =
    typeof body?.externalUrl === 'string' || typeof body?.external_url === 'string'

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const pointPayload = {
    id,
    user_id: user.id,
    label,
    lat,
    lng,
    point_type: pointType,
    ...(hasExternalUrlInput ? { external_url: externalUrl || null } : {}),
  }

  let { data, error } = await supabase
    .from('custom_map_points')
    .upsert(pointPayload, { onConflict: 'id' })
    .select(SELECT_WITH_EXTERNAL_URL)
    .single()

  if (error && isMissingColumnError(error, 'external_url')) {
    if (hasExternalUrlInput && externalUrl) {
      return NextResponse.json(
        { error: 'custom_map_points.external_url is missing. Run migration 00027_custom_map_point_external_url.sql first.' },
        { status: 400 }
      )
    }
    const fallbackPayload = { ...pointPayload }
    delete (fallbackPayload as { external_url?: string | null }).external_url
    ;({ data, error } = await supabase
      .from('custom_map_points')
      .upsert(fallbackPayload, { onConflict: 'id' })
      .select(SELECT_BASE)
      .single())
  }

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
  const externalUrl = normalizeExternalUrl(body?.externalUrl ?? body?.external_url)
  const hasExternalUrlInput =
    typeof body?.externalUrl === 'string' || typeof body?.external_url === 'string'

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }

  const pointPayload = {
    label,
    point_type: pointType,
    ...(hasExternalUrlInput ? { external_url: externalUrl || null } : {}),
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('custom_map_points')
    .update(pointPayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(SELECT_WITH_EXTERNAL_URL)
    .maybeSingle()

  if (error && isMissingColumnError(error, 'external_url')) {
    if (hasExternalUrlInput && externalUrl) {
      return NextResponse.json(
        { error: 'custom_map_points.external_url is missing. Run migration 00027_custom_map_point_external_url.sql first.' },
        { status: 400 }
      )
    }
    const fallbackPayload = { ...pointPayload }
    delete (fallbackPayload as { external_url?: string | null }).external_url
    ;({ data, error } = await supabase
      .from('custom_map_points')
      .update(fallbackPayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(SELECT_BASE)
      .maybeSingle())
  }

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
