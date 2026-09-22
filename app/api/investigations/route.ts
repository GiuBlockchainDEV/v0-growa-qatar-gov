import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('operational_investigations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ investigations: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ investigations: data || [] })
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

  const { data, error } = await supabase
    .from('operational_investigations')
    .insert({
      organization_id: organizationId,
      title,
      summary: typeof body.summary === 'string' ? body.summary : null,
      priority: typeof body.priority === 'string' ? body.priority : 'medium',
      source_signal_id: typeof body.sourceSignalId === 'string' ? body.sourceSignalId : null,
      source_alert_id: typeof body.sourceAlertId === 'string' ? body.sourceAlertId : null,
      affected_farm_ids: Array.isArray(body.farmIds) ? body.farmIds : [],
      created_by: user.id,
      owner_user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ error: 'Investigations table not migrated', unavailable: true }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ investigation: data }, { status: 201 })
}
