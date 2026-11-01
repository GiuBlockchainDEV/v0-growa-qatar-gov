import { NextResponse } from 'next/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { FOOD_SOURCE_TABLES, validFoodUuid } from '@/lib/food-security/ingestion'

export const dynamic = 'force-dynamic'

function reply(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

/**
 * A separate authorized reviewer attests/rejects the immutable source entry.
 * The database trigger rejects self-review and records an atomic audit event.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 4_000) return reply({ error: 'Review payload too large' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body')
    body = parsed as Record<string, unknown>
  } catch {
    return reply({ error: 'Invalid JSON body' }, 400)
  }

  const { organizationId, recordId, kind, decision, reason } = body
  if (!validFoodUuid(organizationId) || !validFoodUuid(recordId)) {
    return reply({ error: 'Valid organizationId and recordId are required' }, 400)
  }
  if (kind !== 'stock' && kind !== 'flow' && kind !== 'coverage') {
    return reply({ error: 'Invalid source kind' }, 400)
  }
  if (decision !== 'verify' && decision !== 'reject') {
    return reply({ error: 'decision must be verify or reject' }, 400)
  }
  const reviewNote = typeof reason === 'string' ? reason.trim() : ''
  if (reviewNote.length < 8 || reviewNote.length > 2000) {
    return reply({ error: 'Review reason must contain 8-2000 characters' }, 400)
  }
  if (Object.keys(body).some(key => !['organizationId', 'recordId', 'kind', 'decision', 'reason'].includes(key))) {
    return reply({ error: 'Unexpected review field' }, 400)
  }

  const gate = await requireCapability('decisions.approve', organizationId)
  if (!gate.ok) return reply({ error: gate.error }, gate.status)
  if (!isAdminClientConfigured()) return reply({ error: 'Review service is not configured' }, 503)

  const admin = createAdminClient()
  const table = FOOD_SOURCE_TABLES[kind]
  const { data: existing, error: readError } = await admin.from(table)
    .select('id, organization_id, submitted_by, verification_status')
    .eq('id', recordId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (readError) {
    console.error('[food-review] lookup failed', readError.code)
    return reply({ error: 'Source record lookup failed' }, 503)
  }
  if (!existing) return reply({ error: 'Source record not found in this organization' }, 404)
  if (existing.verification_status !== 'pending_review') {
    return reply({ error: 'Source record has already been reviewed' }, 409)
  }
  if (existing.submitted_by === gate.context.userId) {
    return reply({ error: 'Independent reviewer required; self-review is prohibited' }, 403)
  }

  const status = decision === 'verify' ? 'verified' : 'rejected'
  const { data, error } = await admin.from(table)
    .update({
      verification_status: status,
      reviewed_by: gate.context.userId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq('id', recordId)
    .eq('organization_id', organizationId)
    .eq('verification_status', 'pending_review')
    .select('id, verification_status')
    .maybeSingle()

  if (error) {
    console.error('[food-review] transition failed', error.code)
    return reply({ error: 'Could not review this source record' }, 503)
  }
  if (!data) return reply({ error: 'Review already processed by another reviewer' }, 409)

  return reply({
    id: data.id,
    verificationStatus: status,
    notice: status === 'verified'
      ? 'Verified source is now eligible for the organizational balance.'
      : 'Rejected source is excluded from the organizational balance.',
  })
}
