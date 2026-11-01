import { NextRequest } from 'next/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { permissionsForOrgRole, roleDisplayName } from '@/lib/auth/role-registry'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return jsonError('organizationId is required', 400)
  }

  const gate = await requireCapability('users.view', organizationId)
  if (!gate.ok) {
    return jsonError(gate.error, gate.status)
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Admin API not configured', 503)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, full_name, avatar_url, account_status, department_scope, preferred_locale, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return jsonError('User not found', 404)
  }

  const { data: memberships } = await admin
    .from('user_organization_members')
    .select('id, organization_id, role, status, invited_at, joined_at, created_at')
    .eq('user_id', userId)

  const { data: invitations } = await admin
    .from('organization_invitations')
    .select('id, organization_id, email, role, status, created_at, expires_at, accepted_at, revoked_at, department_scope, message')
    .eq('email', String(profile.email).toLowerCase())
    .order('created_at', { ascending: false })
    .limit(20)

  const orgMembership = (memberships ?? []).find((m) => m.organization_id === organizationId)

  const role = orgMembership?.role ?? null
  const permissions = role ? Array.from(permissionsForOrgRole(role)) : []

  const { data: auditRows } = await admin
    .from('audit_logs')
    .select('id, action, resource_type, resource_id, organization_id, created_at, changes')
    .or(`user_id.eq.${userId},resource_id.eq.${userId}`)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(30)

  return jsonOk({
    profile,
    memberships: memberships ?? [],
    activeMembership: orgMembership ?? null,
    invitations: invitations ?? [],
    permissions: permissions.map((key) => ({
      key,
      label: roleDisplayName(role ?? 'viewer'),
    })),
    permissionKeys: permissions,
    audit: auditRows ?? [],
  })
}
