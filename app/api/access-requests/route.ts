import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { writeSecurityAudit } from '@/lib/auth/audit-server'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    note?: string
    requestedRole?: string
    targetOrganizationId?: string | null
  }

  const note = body.note?.trim() ?? ''
  const requestedRole = body.requestedRole?.trim() || 'viewer'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonOk({
      submitted: true,
      message:
        'If your request is valid, an administrator will contact you. Public signup is invitation-only.',
    })
  }

  const { error } = await supabase.from('organization_invite_requests').insert({
    requester_user_id: user.id,
    target_organization_id: body.targetOrganizationId ?? null,
    requested_role: requestedRole,
    status: 'pending',
    note: note || null,
  })

  if (error) {
    if (error.code === '23505') {
      return jsonError('You already have a pending access request', 409)
    }
    return jsonError(error.message, 500)
  }

  await writeSecurityAudit({
    actorId: user.id,
    action: 'access_request_submitted',
    resourceType: 'organization_invite_request',
    metadata: { requestedRole },
  })

  return jsonOk({ submitted: true })
}
