import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_STATUSES = new Set([
  'new', 'acknowledged', 'investigating', 'action_required', 'monitoring', 'resolved', 'dismissed',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
    updates.status = body.status
    if (body.status === 'resolved') updates.resolved_at = new Date().toISOString()
  }
  if (typeof body.ownerUserId === 'string') updates.owner_user_id = body.ownerUserId

  const { data, error } = await supabase
    .from('operational_alerts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alert: data })
}
