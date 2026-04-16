import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type LogbookEntryInsertPayload = {
  organization_id: string
  farm_id?: string | null
  entry_date: string
  activity_category: string
  operation_title: string
  crop_name?: string | null
  product_name?: string | null
  active_substance?: string | null
  quantity?: number | null
  unit?: string | null
  treated_area?: number | null
  area_unit?: string | null
  weather_conditions?: string | null
  operator_name?: string | null
  notes?: string | null
  status?: 'draft' | 'completed'
}

function toNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function normalizeStatus(value: unknown): 'draft' | 'completed' {
  return value === 'completed' ? 'completed' : 'draft'
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const organizationId = url.searchParams.get('organizationId')
  const farmId = url.searchParams.get('farmId')
  const fromDate = url.searchParams.get('fromDate')
  const toDate = url.searchParams.get('toDate')

  let query = supabase
    .from('farm_logbook_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (organizationId) query = query.eq('organization_id', organizationId)
  if (farmId) query = query.eq('farm_id', farmId)
  if (fromDate) query = query.gte('entry_date', fromDate)
  if (toDate) query = query.lte('entry_date', toDate)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
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

  const body = (await request.json()) as Partial<LogbookEntryInsertPayload>
  const organizationId = toNullableString(body.organization_id)
  const operationTitle = toNullableString(body.operation_title)
  const entryDate = normalizeDate(body.entry_date) || new Date().toISOString().slice(0, 10)

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required.' }, { status: 400 })
  }

  if (!operationTitle) {
    return NextResponse.json({ error: 'operation_title is required.' }, { status: 400 })
  }

  const payload = {
    organization_id: organizationId,
    farm_id: toNullableString(body.farm_id),
    entry_date: entryDate,
    activity_category: toNullableString(body.activity_category) || 'Monitoring',
    operation_title: operationTitle,
    crop_name: toNullableString(body.crop_name),
    product_name: toNullableString(body.product_name),
    active_substance: toNullableString(body.active_substance),
    quantity: toNullableNumber(body.quantity),
    unit: toNullableString(body.unit),
    treated_area: toNullableNumber(body.treated_area),
    area_unit: toNullableString(body.area_unit) || 'ha',
    weather_conditions: toNullableString(body.weather_conditions),
    operator_name: toNullableString(body.operator_name),
    notes: toNullableString(body.notes),
    status: normalizeStatus(body.status),
    created_by: user.id,
    updated_by: user.id,
  }

  const { data, error } = await supabase
    .from('farm_logbook_entries')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
