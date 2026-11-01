import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/authorization-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authz = await requirePermission('intelligence.view')
  if (!authz.context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authz.status })
  }
  if (!authz.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

  let query = supabase
    .from('operational_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ alerts: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alerts: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
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

  const payload = {
    organization_id: organizationId,
    source_signal_id: typeof body.sourceSignalId === 'string' ? body.sourceSignalId : null,
    title,
    summary: typeof body.summary === 'string' ? body.summary : null,
    severity: typeof body.severity === 'string' ? body.severity : 'attention',
    status: 'new',
    alert_type: typeof body.alertType === 'string' ? body.alertType : null,
    affected_farm_ids: Array.isArray(body.farmIds) ? body.farmIds : [],
    affected_parcel_ids: Array.isArray(body.parcelIds) ? body.parcelIds : [],
    affected_point_ids: Array.isArray(body.pointIds) ? body.pointIds : [],
    created_by: user.id,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }

  const { data, error } = await supabase.from('operational_alerts').insert(payload).select().single()

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ error: 'Alerts table not migrated yet', unavailable: true }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alert: data }, { status: 201 })
}
