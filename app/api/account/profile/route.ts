import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { buildSessionContext } from '@/lib/auth/authorization-service'

export async function GET() {
  const session = await buildSessionContext({})
  if (!session.payload) {
    return jsonError('Unauthorized', session.status)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, account_status, department_scope, preferred_locale')
    .eq('id', session.payload.userId)
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return jsonOk({
    profile: data,
    accountStatus: session.payload.accountStatus,
    memberships: session.payload.memberships,
    pendingInvitationAcceptance: session.payload.pendingInvitationAcceptance,
  })
}

export async function PATCH(request: NextRequest) {
  const session = await buildSessionContext({})
  if (!session.payload) {
    return jsonError('Unauthorized', session.status)
  }

  const body = (await request.json()) as {
    fullName?: string
    preferredLocale?: string
  }

  const updates: Record<string, string> = {}
  if (body.fullName !== undefined) {
    updates.full_name = body.fullName.trim()
  }
  if (body.preferredLocale !== undefined) {
    updates.preferred_locale = body.preferredLocale.trim()
  }

  if (Object.keys(updates).length === 0) {
    return jsonError('No updates provided', 400)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update(updates).eq('id', session.payload.userId)

  if (error) {
    return jsonError(error.message, 500)
  }

  return jsonOk({ updated: true })
}
