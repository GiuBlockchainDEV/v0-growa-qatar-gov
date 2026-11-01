import { NextRequest } from 'next/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { writeSecurityAudit } from '@/lib/auth/audit-server'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const gate = await requireCapability('organizations.manage', id)
  if (!gate.ok) {
    const viewGate = await requireCapability('organizations.view', id)
    if (!viewGate.ok) {
      return jsonError(viewGate.error, viewGate.status)
    }
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Organizations API not configured', 503)
  }

  const admin = createAdminClient()
  const { data: org, error } = await admin
    .from('organizations')
    .select('id, name, slug, description, organization_type, type, created_at, is_active')
    .eq('id', id)
    .maybeSingle()

  if (error || !org) {
    return jsonError('Organization not found', 404)
  }

  const { count } = await admin
    .from('user_organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', id)
    .neq('status', 'inactive')

  return jsonOk({ organization: org, activeMemberCount: count ?? 0 })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = (await request.json()) as {
    name?: string
    description?: string
    isActive?: boolean
  }

  const gate = await requireCapability('organizations.manage', id)
  if (!gate.ok) {
    return jsonError(gate.error, gate.status)
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Organizations API not configured', 503)
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description.trim()
  if (body.isActive !== undefined) updates.is_active = body.isActive

  if (Object.keys(updates).length === 0) {
    return jsonError('No updates provided', 400)
  }

  const admin = createAdminClient()
  const { error } = await admin.from('organizations').update(updates).eq('id', id)
  if (error) {
    return jsonError(error.message, 500)
  }

  await writeSecurityAudit({
    actorId: gate.context.userId,
    organizationId: id,
    action: body.isActive === false ? 'account_suspended' : 'account_reactivated',
    resourceType: 'organization',
    resourceId: id,
    metadata: updates,
  })

  return jsonOk({ updated: true })
}
