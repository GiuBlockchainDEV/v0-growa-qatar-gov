import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface CropTypePayload {
  code: string
  name: string
}

function normalizeCode(input: unknown) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function normalizeName(input: unknown) {
  return typeof input === 'string' ? input.trim() : ''
}

function normalizePayload(input: unknown): CropTypePayload | null {
  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const fallbackName = normalizeName(row.nameEn ?? row.name_en ?? row.name)
  const code = normalizeCode(row.code ?? fallbackName)
  const name = fallbackName || normalizeName(row.label)
  if (!code || !name) return null
  return { code, name }
}

function mapRow(row: Record<string, any>) {
  return {
    id: row.id,
    code: row.normalized_name || '',
    name: row.name || '',
    nameEn: row.name || '',
    varieties:
      Array.isArray(row.varieties) && row.varieties.length > 0
        ? row.varieties
            .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
            .filter((value: string) => Boolean(value))
        : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
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
    .from('custom_crop_types')
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data || []).map((row) => mapRow(row)))
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
  const payload = normalizePayload(body)
  if (!payload) {
    return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_crop_types')
    .upsert(
      {
        user_id: user.id,
        name: payload.name,
        normalized_name: payload.code,
      },
      { onConflict: 'user_id,normalized_name' }
    )
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(mapRow(data), { status: 201 })
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
  const code = normalizeCode(body?.code)
  const varieties = Array.isArray(body?.varieties)
    ? body.varieties
        .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value: string) => Boolean(value))
    : []
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  const uniqueVarieties = Array.from(new Set(varieties)).slice(0, 100)

  const { data, error } = await supabase
    .from('custom_crop_types')
    .update({
      varieties: uniqueVarieties,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('normalized_name', code)
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Crop type not found' }, { status: 404 })
  }
  return NextResponse.json(mapRow(data))
}
