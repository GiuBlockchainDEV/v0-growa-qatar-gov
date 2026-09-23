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

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const farmId = searchParams.get('farmId')

  let query = supabase
    .from('operational_inspections')
    .select('*')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)
  if (farmId) query = query.eq('farm_id', farmId)

  const { data, error } = await query

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ inspections: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inspections: data || [] })
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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('user_organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const organizationId = membership?.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'No organization membership' }, { status: 403 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const status =
    typeof body.status === 'string' && INSPECTION_STATUSES.includes(body.status as typeof INSPECTION_STATUSES[number])
      ? body.status
      : 'assigned'

  const { data, error } = await supabase
    .from('operational_inspections')
    .insert({
      organization_id: organizationId,
      title,
      summary: typeof body.summary === 'string' ? body.summary : null,
      status,
      priority: typeof body.priority === 'string' ? body.priority : 'medium',
      farm_id: typeof body.farmId === 'string' ? body.farmId : null,
      scheduled_at: typeof body.scheduledAt === 'string' ? body.scheduledAt : null,
      due_at: typeof body.dueAt === 'string' ? body.dueAt : null,
      findings: typeof body.findings === 'string' ? body.findings : null,
      evidence_notes: typeof body.evidenceNotes === 'string' ? body.evidenceNotes : null,
      source_investigation_id:
        typeof body.sourceInvestigationId === 'string' ? body.sourceInvestigationId : null,
      assigned_to: user.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ error: 'Inspections table not migrated', unavailable: true }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inspection: data }, { status: 201 })
}
