import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

type UpdatableField =
  | 'farm_id'
  | 'entry_date'
  | 'activity_category'
  | 'operation_title'
  | 'crop_name'
  | 'product_name'
  | 'active_substance'
  | 'quantity'
  | 'unit'
  | 'treated_area'
  | 'area_unit'
  | 'weather_conditions'
  | 'operator_name'
  | 'notes'
  | 'status'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { entryId } = await params
  if (!entryId) {
    return NextResponse.json({ error: 'entryId is required.' }, { status: 400 })
  }

  const body = (await request.json()) as Record<string, unknown>
  const allowedFields: UpdatableField[] = [
    'farm_id',
    'entry_date',
    'activity_category',
    'operation_title',
    'crop_name',
    'product_name',
    'active_substance',
    'quantity',
    'unit',
    'treated_area',
    'area_unit',
    'weather_conditions',
    'operator_name',
    'notes',
    'status',
  ]

  const updatePayload: Record<string, unknown> = {}

  if (allowedFields.includes('farm_id') && Object.prototype.hasOwnProperty.call(body, 'farm_id')) {
    updatePayload.farm_id = toNullableString(body.farm_id)
  }
  if (allowedFields.includes('entry_date') && Object.prototype.hasOwnProperty.call(body, 'entry_date')) {
    updatePayload.entry_date = normalizeDate(body.entry_date)
  }
  if (
    allowedFields.includes('activity_category') &&
    Object.prototype.hasOwnProperty.call(body, 'activity_category')
  ) {
    updatePayload.activity_category = toNullableString(body.activity_category) || 'Monitoring'
  }
  if (
    allowedFields.includes('operation_title') &&
    Object.prototype.hasOwnProperty.call(body, 'operation_title')
  ) {
    const value = toNullableString(body.operation_title)
    if (!value) {
      return NextResponse.json({ error: 'operation_title cannot be empty.' }, { status: 400 })
    }
    updatePayload.operation_title = value
  }
  if (allowedFields.includes('crop_name') && Object.prototype.hasOwnProperty.call(body, 'crop_name')) {
    updatePayload.crop_name = toNullableString(body.crop_name)
  }
  if (
    allowedFields.includes('product_name') &&
    Object.prototype.hasOwnProperty.call(body, 'product_name')
  ) {
    updatePayload.product_name = toNullableString(body.product_name)
  }
  if (
    allowedFields.includes('active_substance') &&
    Object.prototype.hasOwnProperty.call(body, 'active_substance')
  ) {
    updatePayload.active_substance = toNullableString(body.active_substance)
  }
  if (allowedFields.includes('quantity') && Object.prototype.hasOwnProperty.call(body, 'quantity')) {
    updatePayload.quantity = toNullableNumber(body.quantity)
  }
  if (allowedFields.includes('unit') && Object.prototype.hasOwnProperty.call(body, 'unit')) {
    updatePayload.unit = toNullableString(body.unit)
  }
  if (
    allowedFields.includes('treated_area') &&
    Object.prototype.hasOwnProperty.call(body, 'treated_area')
  ) {
    updatePayload.treated_area = toNullableNumber(body.treated_area)
  }
  if (allowedFields.includes('area_unit') && Object.prototype.hasOwnProperty.call(body, 'area_unit')) {
    updatePayload.area_unit = toNullableString(body.area_unit) || 'ha'
  }
  if (
    allowedFields.includes('weather_conditions') &&
    Object.prototype.hasOwnProperty.call(body, 'weather_conditions')
  ) {
    updatePayload.weather_conditions = toNullableString(body.weather_conditions)
  }
  if (
    allowedFields.includes('operator_name') &&
    Object.prototype.hasOwnProperty.call(body, 'operator_name')
  ) {
    updatePayload.operator_name = toNullableString(body.operator_name)
  }
  if (allowedFields.includes('notes') && Object.prototype.hasOwnProperty.call(body, 'notes')) {
    updatePayload.notes = toNullableString(body.notes)
  }
  if (allowedFields.includes('status') && Object.prototype.hasOwnProperty.call(body, 'status')) {
    updatePayload.status = body.status === 'completed' ? 'completed' : 'draft'
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 400 })
  }

  updatePayload.updated_by = user.id

  const { data, error } = await supabase
    .from('farm_logbook_entries')
    .update(updatePayload)
    .eq('id', entryId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
