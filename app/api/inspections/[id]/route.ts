import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const INSPECTION_STATUSES = [
  'assigned',
  'preparing',
  'on_site',
  'evidence',
  'findings',
  'verification',
  'closed',
] as const

const NEXT_STATUS: Record<string, string> = {
  assigned: 'preparing',
  preparing: 'on_site',
  on_site: 'evidence',
  evidence: 'findings',
  findings: 'verification',
  verification: 'closed',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.status === 'string' && INSPECTION_STATUSES.includes(body.status as typeof INSPECTION_STATUSES[number])) {
    updates.status = body.status
    if (body.status === 'closed') updates.closed_at = new Date().toISOString()
  }

  if (body.advance === true) {
    const { data: current } = await supabase
      .from('operational_inspections')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (current?.status && NEXT_STATUS[current.status]) {
      updates.status = NEXT_STATUS[current.status]
      if (updates.status === 'closed') updates.closed_at = new Date().toISOString()
    }
  }

  if (typeof body.findings === 'string') updates.findings = body.findings
  if (typeof body.evidenceNotes === 'string') updates.evidence_notes = body.evidenceNotes
  if (typeof body.summary === 'string') updates.summary = body.summary

  const { data, error } = await supabase
    .from('operational_inspections')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ error: 'Inspections table not migrated', unavailable: true }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inspection: data })
}
