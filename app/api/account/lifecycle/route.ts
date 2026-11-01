import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/authorization-service'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { writeSecurityAudit } from '@/lib/auth/audit-server'
import type { AccountStatus } from '@/lib/auth/account-status'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string
    action?: 'suspend' | 'reactivate'
    organizationId?: string
  }

  const userId = body.userId?.trim()
  const action = body.action
  const organizationId = body.organizationId?.trim()

  if (!userId || !action || !organizationId) {
    return jsonError('userId, organizationId, and action are required', 400)
  }

  const gate = await requirePermission('users.manage', organizationId)
  if (!gate.allowed || !gate.context) {
    return jsonError('Forbidden', gate.status === 401 ? 401 : 403)
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Account lifecycle service not configured', 503)
  }

  const nextStatus: AccountStatus = action === 'suspend' ? 'suspended' : 'active'
  const admin = createAdminClient()

  const { error } = await admin.from('profiles').update({ account_status: nextStatus }).eq('id', userId)

  if (error) {
    return jsonError(error.message, 500)
  }

  await writeSecurityAudit({
    actorId: gate.context.userId,
    organizationId,
    action: action === 'suspend' ? 'account_suspended' : 'account_reactivated',
    resourceType: 'profile',
    resourceId: userId,
  })

  return jsonOk({ userId, accountStatus: nextStatus })
}
