import { createClient } from '@/lib/supabase/server'
import {
  resolveAuthorization,
  selectValidatedActiveOrganizationId,
  type AuthorizationContext,
  type MembershipRecord,
  type ResolvedAuthorization,
} from '@/lib/auth/authorization'
import type { PermissionKey } from '@/lib/auth/capabilities'
import { authorize } from '@/lib/auth/authorization'
import type { PlatformStaffTier } from '@/lib/auth/role-registry'
import { accountStatusBlocksSession, normalizeAccountStatus, type AccountStatus } from '@/lib/auth/account-status'

export interface SessionContextPayload {
  userId: string
  accountStatus: AccountStatus
  memberships: MembershipRecord[]
  activeOrganizationId: string | null
  authorization: ResolvedAuthorization
  requiresOrganizationSelection: boolean
  pendingInvitationAcceptance: boolean
}

async function loadPlatformStaffTier(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<PlatformStaffTier | null> {
  const { data, error } = await supabase.rpc('get_my_auth_capabilities')
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as
    | { is_platform_admin?: boolean; platform_staff_tier?: string | null }
    | undefined
  if (!row?.is_platform_admin) return null
  const tier = row.platform_staff_tier === 'support' ? 'support' : 'super_admin'
  return tier
}

async function loadCanonicalMemberships(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<MembershipRecord[]> {
  const { data, error } = await supabase
    .from('user_organization_members')
    .select('organization_id, role, status')
    .eq('user_id', userId)

  if (error) {
    return []
  }

  return (data || []).map((row) => ({
    organizationId: String(row.organization_id),
    role: String(row.role),
    status: row.status as string | null,
    source: 'canonical' as const,
  }))
}

async function loadLegacyMemberships(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<MembershipRecord[]> {
  const { data, error } = await supabase.rpc('list_legacy_memberships_for_user', {
    p_user_id: userId,
  })

  if (error || !data) return []

  return (data as Array<{ organization_id: string; role: string; status: string }>).map((row) => ({
    organizationId: String(row.organization_id),
    role: String(row.role),
    status: row.status,
    source: 'legacy' as const,
  }))
}

function mergeMembershipLists(
  canonical: MembershipRecord[],
  legacy: MembershipRecord[]
): MembershipRecord[] {
  const byOrg = new Map<string, MembershipRecord>()
  for (const row of canonical) {
    byOrg.set(row.organizationId, row)
  }
  for (const row of legacy) {
    if (!byOrg.has(row.organizationId)) {
      byOrg.set(row.organizationId, row)
    }
  }
  return Array.from(byOrg.values())
}

export async function buildSessionContext(options: {
  requestedOrganizationId?: string | null
  persistedOrganizationId?: string | null
}): Promise<{ payload: SessionContextPayload | null; status: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { payload: null, status: 401, error: 'Unauthorized' }
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('account_status')
    .eq('id', user.id)
    .maybeSingle()

  const accountStatus = normalizeAccountStatus(profileRow?.account_status as string | undefined)
  if (accountStatusBlocksSession(accountStatus)) {
    return { payload: null, status: 403, error: 'Account is not active' }
  }

  const canonical = await loadCanonicalMemberships(supabase, user.id)
  const legacy = await loadLegacyMemberships(supabase, user.id)
  const memberships = mergeMembershipLists(canonical, legacy)

  const platformStaffTier = await loadPlatformStaffTier(supabase)

  let previewRole: string | null = null
  let rolePreviewActive = false
  const { data: caps } = await supabase.rpc('get_my_auth_capabilities')
  const capRow = (Array.isArray(caps) ? caps[0] : caps) as
    | { role_preview_active?: boolean; preview_role?: string | null }
    | undefined
  if (capRow?.role_preview_active) {
    rolePreviewActive = true
    previewRole = capRow.preview_role ?? null
  }

  const activeOrganizationId = selectValidatedActiveOrganizationId(
    memberships,
    options.requestedOrganizationId,
    options.persistedOrganizationId
  )

  const authContext: AuthorizationContext = {
    userId: user.id,
    activeOrganizationId,
    memberships,
    platformStaffTier,
    rolePreviewActive,
    previewRole,
  }

  const authorization = resolveAuthorization(authContext)
  const activeCount = memberships.filter((m) => (m.status ?? 'active') === 'active').length
  const pendingInvitationAcceptance = memberships.some(
    (m) => (m.status ?? '').toLowerCase() === 'invited'
  )

  return {
    payload: {
      userId: user.id,
      accountStatus,
      memberships,
      activeOrganizationId,
      authorization,
      requiresOrganizationSelection: activeCount > 1 && !activeOrganizationId,
      pendingInvitationAcceptance,
    },
    status: 200,
  }
}

export async function requirePermission(
  permission: PermissionKey,
  organizationId?: string | null
): Promise<{ allowed: boolean; context: SessionContextPayload | null; status: number }> {
  const session = await buildSessionContext({
    requestedOrganizationId: organizationId ?? null,
  })

  if (!session.payload) {
    return { allowed: false, context: null, status: session.status }
  }

  if (organizationId && session.payload.activeOrganizationId !== organizationId) {
    return { allowed: false, context: session.payload, status: 403 }
  }

  const allowed = authorize(session.payload.authorization, permission)
  return { allowed, context: session.payload, status: allowed ? 200 : 403 }
}
