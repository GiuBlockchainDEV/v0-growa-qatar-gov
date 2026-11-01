import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/authorization-service'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { getRequestOrigin } from '@/lib/api/request-origin'
import { createOrganizationInvitation } from '@/lib/invitations/server'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return jsonError('organizationId is required', 400)
  }

  const gate = await requirePermission('users.invite', organizationId)
  if (!gate.allowed || !gate.context) {
    return jsonError('Forbidden', gate.status === 401 ? 401 : 403)
  }

  if (!isAdminClientConfigured()) {
    return jsonOk({ invitations: [], devNote: 'Service role not configured' })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_invitations')
    .select('id, email, role, status, department_scope, created_at, expires_at, last_sent_at, message')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return jsonError(error.message, 500)
  }

  return jsonOk({ invitations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    organizationId?: string
    email?: string
    role?: string
    departmentScope?: string | null
    message?: string | null
  }

  const organizationId = body.organizationId?.trim()
  const email = body.email?.trim()
  const role = body.role?.trim() || 'viewer'

  if (!organizationId || !email) {
    return jsonError('organizationId and email are required', 400)
  }

  const gate = await requirePermission('users.invite', organizationId)
  if (!gate.allowed || !gate.context) {
    return jsonError('Forbidden', gate.status === 401 ? 401 : 403)
  }

  const actorRole = gate.context.authorization.effectiveOrgRole ?? 'viewer'
  const origin = await getRequestOrigin()

  const result = await createOrganizationInvitation({
    actorId: gate.context.userId,
    actorRole,
    isPlatformAdmin: Boolean(gate.context.authorization.platformStaffTier),
    organizationId,
    email,
    role,
    departmentScope: body.departmentScope,
    message: body.message,
    origin,
  })

  if (!result.ok) {
    return jsonError(result.error, result.status)
  }

  return jsonOk({
    invitation: result.invitation,
    delivery: result.delivery,
    ...(result.delivery.devInviteUrl && result.token
      ? { devInviteUrl: result.delivery.devInviteUrl }
      : {}),
  })
}
