import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { acceptOrganizationInvitation, lookupInvitationByToken } from '@/lib/invitations/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return jsonError('Invalid invitation', 400)
  }

  const lookup = await lookupInvitationByToken(token)
  if (!lookup.ok) {
    return jsonError('Invalid or expired invitation', 404)
  }

  const inv = lookup.invitation
  return jsonOk({
    organizationName: inv.organization_name,
    email: inv.email,
    role: inv.role,
    message: inv.message,
    canAccept: inv.canAccept,
    expired: inv.expired,
    status: inv.status,
  })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { token?: string }
  const token = body.token?.trim()
  if (!token) {
    return jsonError('Invalid invitation', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return jsonError('Authentication required', 401)
  }

  const result = await acceptOrganizationInvitation({
    token,
    userId: user.id,
    userEmail: user.email,
  })

  if (!result.ok) {
    return jsonError(result.error, result.status)
  }

  return jsonOk({ organizationId: result.organizationId, accepted: true })
}
