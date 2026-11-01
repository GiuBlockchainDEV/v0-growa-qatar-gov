import { NextResponse } from 'next/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { resolveCommodity } from '@/lib/platform/commodity-catalog'
import { FOOD_SOURCE_TABLES, foodSourceInsertPayload, type FoodSourceKind } from '@/lib/food-security/ingestion'
import { prepareFoodCsvImport, FOOD_CSV_MAX_RECORDS } from '@/lib/food-security/csv-import'

export const dynamic = 'force-dynamic'

function respond(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status, headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

/**
 * Preview (no write) or transactionally insert one CSV batch in pending_review.
 * Supabase PostgREST bulk insert is one SQL statement; DB uniqueness constraints
 * and the 00040 audit trigger protect the entire batch from partial writes.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 350_000) return respond({ error: 'CSV request body exceeds size limit' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return respond({ error: 'Expected JSON object' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return respond({ error: 'Invalid JSON request' }, 400)
  }
  if (Object.keys(body).some(key => !['mode', 'organizationId', 'commodityId', 'kind', 'csv'].includes(key))) {
    return respond({ error: 'Unexpected or privileged CSV request field' }, 400)
  }
  if (body.mode !== 'preview' && body.mode !== 'commit') {
    return respond({ error: 'mode must be preview or commit' }, 400)
  }
  const { kind, organizationId, commodityId, csv } = body
  const preparation = prepareFoodCsvImport({
    kind: kind as FoodSourceKind,
    organizationId: organizationId as string,
    commodityId: commodityId as string,
    csv: csv as string,
  })
  if (!preparation.ok) return respond({ error: preparation.error }, 400)

  const batch = preparation.batch
  if (!resolveCommodity(batch.commodityId)) {
    return respond({ error: 'Unknown commodity' }, 400)
  }
  const gate = await requireCapability('supply.edit', batch.organizationId)
  if (!gate.ok) return respond({ error: gate.error }, gate.status)
  if (!isAdminClientConfigured()) {
    return respond({ error: 'Privileged source intake is not configured' }, 503)
  }

  const admin = createAdminClient()
  const table = FOOD_SOURCE_TABLES[batch.kind]

  // Preflight conflicts are advisory; the SQL uniqueness constraint remains final.
  let conflictKeys: string[] = []
  if (batch.kind === 'stock') {
    const dates = batch.records.filter((r) => r.kind === 'stock').map((r) => r.kind === 'stock' ? r.asOfDate : '')
    const { data, error } = await admin.from(table).select('as_of_date')
      .eq('organization_id', batch.organizationId).eq('commodity_code', batch.commodityId)
      .in('as_of_date', dates)
    if (error) return respond({ error: 'Unable to validate existing stock records' }, 503)
    conflictKeys = (data ?? []).map(r => String(r.as_of_date))
  } else if (batch.kind === 'flow') {
    const keys = batch.records.filter((r) => r.kind === 'flow').map(r => r.kind === 'flow' ? r.externalKey : '')
    const { data, error } = await admin.from(table).select('external_key')
      .eq('organization_id', batch.organizationId).in('external_key', keys)
    if (error) return respond({ error: 'Unable to validate existing movement records' }, 503)
    conflictKeys = (data ?? []).map(r => String(r.external_key))
  } else {
    const { data, error } = await admin.from(table)
      .select('flow_type, start_date, end_date, source_ref')
      .eq('organization_id', batch.organizationId).eq('commodity_code', batch.commodityId)
      .in('source_ref', batch.records.map(r => r.sourceRef)).limit(1000)
    if (error) return respond({ error: 'Unable to validate existing coverage declarations' }, 503)
    const incoming = new Set(batch.records
      .filter((r) => r.kind === 'coverage')
      .map(r => r.kind === 'coverage'
        ? [r.flowType, r.startDate, r.endDate, r.sourceRef].join('|') : ''))
    conflictKeys = (data ?? []).filter(r => incoming.has(
      [r.flow_type, r.start_date, r.end_date, r.source_ref].join('|'),
    )).map(r => String(r.source_ref))
  }

  if (conflictKeys.length) {
    return respond({
      error: 'CSV contains source identities already present in this organization; nothing was imported.',
      conflictCount: conflictKeys.length,
    }, 409)
  }

  if (body.mode === 'preview') {
    const sample = batch.records.slice(0, 5).map(r => ({
      sourceRef: r.sourceRef,
      dataMode: r.dataMode,
      detail: r.kind === 'stock' ? 'stock ' + r.usableTonnes + ' t'
        : r.kind === 'flow' ? r.flowType + ' ' + r.quantityTonnes + ' t'
        : 'coverage ' + r.flowType + ' ' + r.status,
    }))
    return respond({
      mode: 'preview',
      preview: {
        count: batch.records.length,
        kind: batch.kind,
        commodityId: batch.commodityId,
        sample,
      },
      notice: 'Validation only. No database records created.',
    })
  }

  const payloads = batch.records.map(record =>
    foodSourceInsertPayload(record, gate.context.userId, 'csv'))
  if (payloads.length < 1 || payloads.length > FOOD_CSV_MAX_RECORDS) {
    return respond({ error: 'Invalid batch size' }, 400)
  }
  // A SINGLE insert statement: if one violates constraints, no rows commit.
  const { data, error } = await admin.from(table).insert(payloads as never).select('id')
  if (error) {
    if (error.code === '23505') return respond({
      error: 'Duplicate source identity; no records were imported. Refresh and preview again.',
    }, 409)
    console.error('[food-csv] transactional insert failed', error.code)
    return respond({ error: 'CSV import failed. No partial result was accepted.' }, 503)
  }
  if (!data || data.length !== payloads.length) {
    console.error('[food-csv] unexpected returned row count')
    return respond({ error: 'Import result must be reconciled by an administrator.' }, 503)
  }

  return respond({
    mode: 'commit',
    imported: data.length,
    verificationStatus: 'pending_review',
    notice: 'All imported records are pending independent review; none are included in verified balances.',
  }, 201)
}
