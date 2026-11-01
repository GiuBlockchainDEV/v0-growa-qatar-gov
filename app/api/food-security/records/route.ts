import { NextResponse } from 'next/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { resolveCommodity } from '@/lib/platform/commodity-catalog'
import {
  FOOD_SOURCE_TABLES, foodSourceInsertPayload, validFoodUuid,
  validateFoodSourceSubmission,
} from '@/lib/food-security/ingestion'

export const dynamic = 'force-dynamic'

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

/** Read organization-scoped source records, including their review state. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const organizationId = query.get('organizationId')?.trim()
  const commodityId = query.get('commodityId')?.trim().toLowerCase()
  if (!validFoodUuid(organizationId) || !resolveCommodity(commodityId)) {
    return reply({ error: 'Valid organizationId and commodityId are required' }, 400)
  }

  const gate = await requireCapability('supply.view', organizationId)
  if (!gate.ok) return reply({ error: gate.error }, gate.status)

  const supabase = await createClient()
  const [stock, flow, coverage] = await Promise.all([
    supabase.from(FOOD_SOURCE_TABLES.stock)
      .select('id, source_ref, source_kind, data_mode, verification_status, submitted_by, created_at, as_of_date, usable_tonnes')
      .eq('organization_id', organizationId).eq('commodity_code', commodityId)
      .order('created_at', { ascending: false }).limit(40),
    supabase.from(FOOD_SOURCE_TABLES.flow)
      .select('id, source_ref, source_kind, data_mode, verification_status, submitted_by, created_at, external_key, flow_type, effective_date, quantity_tonnes')
      .eq('organization_id', organizationId).eq('commodity_code', commodityId)
      .order('created_at', { ascending: false }).limit(40),
    supabase.from(FOOD_SOURCE_TABLES.coverage)
      .select('id, source_ref, source_kind, data_mode, verification_status, submitted_by, created_at, flow_type, start_date, end_date, status')
      .eq('organization_id', organizationId).eq('commodity_code', commodityId)
      .order('created_at', { ascending: false }).limit(40),
  ])

  if (stock.error || flow.error || coverage.error) {
    console.error('[food-source] read failed', [stock.error?.code, flow.error?.code, coverage.error?.code])
    return reply({ error: 'Source records unavailable. Check that migration 00040 has been applied.' }, 503)
  }

  const normalize = (kind: 'stock' | 'flow' | 'coverage', rows: Record<string, unknown>[]) => rows.map(row => ({
    id: String(row.id),
    kind,
    sourceRef: String(row.source_ref),
    sourceKind: String(row.source_kind),
    dataMode: String(row.data_mode),
    verificationStatus: String(row.verification_status),
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    createdAt: String(row.created_at),
    dateLabel: kind === 'stock' ? String(row.as_of_date)
      : kind === 'flow' ? String(row.effective_date)
      : `${row.start_date} – ${row.end_date}`,
    detail: kind === 'stock' ? `${row.usable_tonnes} t usable stock`
      : kind === 'flow' ? `${row.flow_type}: ${row.quantity_tonnes} t`
      : `${row.flow_type}: ${row.status}`,
  }))

  const records = [
    ...normalize('stock', (stock.data ?? []) as Record<string, unknown>[]),
    ...normalize('flow', (flow.data ?? []) as Record<string, unknown>[]),
    ...normalize('coverage', (coverage.data ?? []) as Record<string, unknown>[]),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return reply({ records, limitPerKind: 40, organizationId, commodityId })
}

/** Intake is immutable and pending review. The caller cannot set verification fields. */
export async function POST(request: Request) {
  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > 6_000) return reply({ error: 'Source record too large' }, 413)
    raw = JSON.parse(text)
  } catch {
    return reply({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = validateFoodSourceSubmission(raw)
  if (!parsed.ok) return reply({ error: parsed.error }, 400)
  const record = parsed.value
  if (!resolveCommodity(record.commodityId)) {
    return reply({ error: 'Unknown commodityId' }, 400)
  }

  const gate = await requireCapability('supply.edit', record.organizationId)
  if (!gate.ok) return reply({ error: gate.error }, gate.status)
  if (!isAdminClientConfigured()) {
    return reply({ error: 'Server-side food source ingestion is not configured' }, 503)
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from(FOOD_SOURCE_TABLES[record.kind])
    .insert(foodSourceInsertPayload(record, gate.context.userId) as never)
    .select('id, verification_status')
    .single()

  if (error) {
    if (error.code === '23505') {
      return reply({ error: 'This source record already exists. Use a new external ID only for a different real event.' }, 409)
    }
    console.error('[food-source] insert failed', error.code)
    return reply({ error: 'Source submission failed. Check migration 00040 and source constraints.' }, 503)
  }

  return reply({
    id: data.id,
    kind: record.kind,
    verificationStatus: 'pending_review',
    notice: 'Submitted for independent review. This record does not affect the verified balance yet.',
  }, 201)
}
