import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface CropTypePayload {
  code: string
  name: string
  varieties: string[]
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

function normalizeVarieties(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(
    new Set(
      input
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => Boolean(entry))
    )
  ).slice(0, 200)
}

function isMissingColumnError(error: { code?: string; message?: string } | null, columnName: string) {
  if (!error) return false
  if (error.code === '42703') return true
  const message = (error.message || '').toLowerCase()
  return message.includes(columnName.toLowerCase()) && message.includes('column')
}

function isMissingRelationError(error: { code?: string } | null) {
  return Boolean(error?.code === '42P01')
}

function normalizePayload(input: unknown): CropTypePayload | null {
  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const fallbackName = normalizeName(row.nameEn ?? row.name_en ?? row.name)
  const code = normalizeCode(row.code ?? fallbackName)
  const name = fallbackName || normalizeName(row.label)
  const varieties = normalizeVarieties(row.varieties)
  if (!code || !name) return null
  return { code, name, varieties }
}

function mapCustomRow(row: Record<string, any>) {
  return {
    id: row.id,
    code: row.normalized_name || '',
    name: row.name || '',
    nameEn: row.name || '',
    nameAr: '',
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

function mapGccRow(
  row: Record<string, any>,
  varietiesByCode: Map<string, string[]>
): {
  id: string
  code: string
  name: string
  nameEn: string
  nameAr: string
  varieties: string[]
  createdAt: string | null
  updatedAt: string | null
} | null {
  const code = typeof row.code === 'string' ? row.code.trim().toLowerCase() : ''
  const nameEn = typeof row.name_en === 'string' ? row.name_en.trim() : ''
  if (!code || !nameEn) return null
  return {
    id: `gcc-${code}`,
    code,
    name: nameEn,
    nameEn,
    nameAr: typeof row.name_ar === 'string' ? row.name_ar.trim() : '',
    varieties: varietiesByCode.get(code) || [],
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

async function loadCustomCropTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Record<string, any>[]> {
  const primaryQuery = await supabase
    .from('custom_crop_types')
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (!primaryQuery.error) {
    return primaryQuery.data || []
  }
  if (isMissingRelationError(primaryQuery.error)) {
    return []
  }
  if (!isMissingColumnError(primaryQuery.error, 'varieties')) {
    throw new Error(primaryQuery.error.message)
  }

  const fallbackQuery = await supabase
    .from('custom_crop_types')
    .select('id, name, normalized_name, created_at, updated_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (fallbackQuery.error) {
    if (isMissingRelationError(fallbackQuery.error)) return []
    throw new Error(fallbackQuery.error.message)
  }
  return (fallbackQuery.data || []).map((row) => ({ ...row, varieties: [] }))
}

async function loadGccCropTypes(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<
  Array<{
    id: string
    code: string
    name: string
    nameEn: string
    nameAr: string
    varieties: string[]
    createdAt: string | null
    updatedAt: string | null
  }>
> {
  const cropTypesQuery = await supabase
    .from('gcc_crop_types')
    .select('code, name_en, name_ar, created_at, updated_at, is_active')
    .eq('is_active', true)
    .order('name_en', { ascending: true })

  if (cropTypesQuery.error) {
    if (isMissingRelationError(cropTypesQuery.error)) return []
    throw new Error(cropTypesQuery.error.message)
  }

  const cropVarietiesQuery = await supabase
    .from('gcc_crop_varieties')
    .select('crop_code, variety_name, is_active')
    .eq('is_active', true)
    .order('variety_name', { ascending: true })

  const varietiesByCode = new Map<string, string[]>()
  if (cropVarietiesQuery.error) {
    if (!isMissingRelationError(cropVarietiesQuery.error)) {
      throw new Error(cropVarietiesQuery.error.message)
    }
  } else {
    for (const row of cropVarietiesQuery.data || []) {
      const cropCode = typeof row.crop_code === 'string' ? row.crop_code.trim().toLowerCase() : ''
      const varietyName = typeof row.variety_name === 'string' ? row.variety_name.trim() : ''
      if (!cropCode || !varietyName) continue
      const existing = varietiesByCode.get(cropCode) || []
      if (!existing.includes(varietyName)) {
        varietiesByCode.set(cropCode, [...existing, varietyName])
      }
    }
  }

  return (cropTypesQuery.data || [])
    .map((row) => mapGccRow(row, varietiesByCode))
    .filter((row): row is NonNullable<ReturnType<typeof mapGccRow>> => Boolean(row))
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

  try {
    const [customRows, gccRows] = await Promise.all([
      loadCustomCropTypes(supabase, user.id),
      loadGccCropTypes(supabase),
    ])
    const merged = new Map<string, ReturnType<typeof mapCustomRow>>()

    for (const row of gccRows) {
      merged.set(row.code, {
        id: row.id,
        code: row.code,
        name: row.nameEn,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        varieties: row.varieties,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    }

    for (const row of customRows) {
      const normalized = mapCustomRow(row)
      if (!normalized.code) continue
      const current = merged.get(normalized.code)
      if (!current) {
        merged.set(normalized.code, normalized)
        continue
      }
      merged.set(normalized.code, {
        ...current,
        ...normalized,
        varieties: Array.from(new Set([...(current.varieties || []), ...(normalized.varieties || [])])),
      })
    }

    const responseRows = Array.from(merged.values()).sort((a, b) => {
      const aName = (a.nameEn || a.name || '').toLowerCase()
      const bName = (b.nameEn || b.name || '').toLowerCase()
      return aName.localeCompare(bName)
    })
    return NextResponse.json(responseRows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load crop types'
    return NextResponse.json({ error: message }, { status: 500 })
  }
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

  const basePayload = {
    user_id: user.id,
    name: payload.name,
    normalized_name: payload.code,
    updated_at: new Date().toISOString(),
  }

  const primaryResult = await supabase
    .from('custom_crop_types')
    .upsert(
      {
        ...basePayload,
        varieties: payload.varieties,
      },
      { onConflict: 'user_id,normalized_name' }
    )
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .single()

  if (!primaryResult.error) {
    return NextResponse.json(mapCustomRow(primaryResult.data as Record<string, any>), { status: 201 })
  }

  if (!isMissingColumnError(primaryResult.error, 'varieties')) {
    return NextResponse.json({ error: primaryResult.error.message }, { status: 500 })
  }

  const fallbackResult = await supabase
    .from('custom_crop_types')
    .upsert(basePayload, { onConflict: 'user_id,normalized_name' })
    .select('id, name, normalized_name, created_at, updated_at')
    .single()

  if (fallbackResult.error) {
    return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 })
  }

  const fallbackRow = fallbackResult.data
    ? ({ ...fallbackResult.data, varieties: [] } as Record<string, any>)
    : null
  if (!fallbackRow) {
    return NextResponse.json({ error: 'Failed to save crop type' }, { status: 500 })
  }

  return NextResponse.json(mapCustomRow(fallbackRow), { status: 201 })
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

  const uniqueVarieties = Array.from(new Set(varieties)).slice(0, 200)

  let updateResult = await supabase
    .from('custom_crop_types')
    .update({
      varieties: uniqueVarieties,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('normalized_name', code)
    .select('id, name, normalized_name, varieties, created_at, updated_at')
    .maybeSingle()

  if (updateResult.error && isMissingColumnError(updateResult.error, 'varieties')) {
    return NextResponse.json(
      { error: 'custom_crop_types.varieties column is missing. Apply latest migrations.' },
      { status: 409 }
    )
  }

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
  }
  if (!updateResult.data) {
    return NextResponse.json({ error: 'Crop type not found' }, { status: 404 })
  }
  return NextResponse.json(mapCustomRow(updateResult.data as Record<string, any>))
}
