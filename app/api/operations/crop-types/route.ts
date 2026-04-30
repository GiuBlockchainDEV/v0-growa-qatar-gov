import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function isMissingRelationError(error: { code?: string } | null) {
  return Boolean(error?.code === '42P01')
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
    const gccRows = await loadGccCropTypes(supabase)
    const responseRows = gccRows.sort((a, b) => {
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

export async function POST() {
  return NextResponse.json(
    { error: 'Crop catalog is read-only. custom_crop_types is not used.' },
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Crop catalog is read-only. custom_crop_types is not used.' },
    { status: 405 }
  )
}
