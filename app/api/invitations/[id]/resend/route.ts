import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/authorization-service'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { getRequestOrigin } from '@/lib/api/request-origin'
import { resendOrganizationInvitation } from '@/lib/invitations/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = (await request.json()) as { organizationId?: string }
  const organizationId = body.organizationId?.trim()

  if (!organizationId) {
    return jsonError('organizationId is required', 400)
  }

  const gate = await requirePermission('users.invite', organizationId)
  if (!gate.allowed || !gate.context) {
    return jsonError('Forbidden', gate.status === 401 ? 401 : 403)
  }

  const origin = await getRequestOrigin()
  const result = await resendOrganizationInvitation({
    actorId: gate.context.userId,
    organizationId,
    invitationId: id,
    origin,
  })

  if (!result.ok) {
    return jsonError(result.error, result.status)
  }

  return jsonOk({
    delivery: result.delivery,
    ...(result.delivery.devInviteUrl && result.token
      ? { devInviteUrl: result.delivery.devInviteUrl }
      : {}),
  })
}
