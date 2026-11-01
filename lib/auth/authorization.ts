import type { PermissionKey } from '@/lib/auth/capabilities'
import { hasPermission, type PermissionSet } from '@/lib/auth/capabilities'
import {
  mergePermissionSets,
  normalizeOrgRole,
  permissionsForOrgRole,
  permissionsForPlatformStaff,
  type PlatformStaffTier,
} from '@/lib/auth/role-registry'
import { isActiveMembershipStatus } from '@/lib/auth/membership-status'

export interface MembershipRecord {
  organizationId: string
  role: string
  status?: string | null
  source?: 'canonical' | 'legacy'
}

export interface AuthorizationContext {
  userId: string
  activeOrganizationId: string | null
  memberships: MembershipRecord[]
  platformStaffTier: PlatformStaffTier | null
  rolePreviewActive?: boolean
  previewRole?: string | null
}

export interface ResolvedAuthorization {
  activeOrganizationId: string | null
  activeMembership: MembershipRecord | null
  effectiveOrgRole: string | null
  permissions: ReadonlySet<PermissionKey>
  platformStaffTier: PlatformStaffTier | null
}

export function resolveActiveMembership(
  memberships: MembershipRecord[],
  activeOrganizationId: string | null
): MembershipRecord | null {
  if (!activeOrganizationId) return null
  return (
    memberships.find(
      (m) => m.organizationId === activeOrganizationId && isActiveMembershipStatus(m.status)
    ) ?? null
  )
}

export function resolveAuthorization(input: AuthorizationContext): ResolvedAuthorization {
  const activeMembership = resolveActiveMembership(input.memberships, input.activeOrganizationId)

  let orgPermissions: PermissionSet = permissionsForOrgRole(null)
  let effectiveOrgRole: string | null = null

  if (activeMembership) {
    effectiveOrgRole = normalizeOrgRole(activeMembership.role)
    orgPermissions = permissionsForOrgRole(activeMembership.role)
  } else if (input.rolePreviewActive && input.previewRole && input.platformStaffTier) {
    // UI preview only — does not grant data permissions without membership.
    effectiveOrgRole = normalizeOrgRole(input.previewRole)
  }

  const platformPermissions = permissionsForPlatformStaff(input.platformStaffTier)
  const permissions = mergePermissionSets(orgPermissions, platformPermissions)

  return {
    activeOrganizationId: input.activeOrganizationId,
    activeMembership,
    effectiveOrgRole,
    permissions,
    platformStaffTier: input.platformStaffTier,
  }
}

export function authorize(
  resolved: ResolvedAuthorization,
  permission: PermissionKey
): boolean {
  return hasPermission(resolved.permissions, permission)
}

/** Pick a validated active organization id (never implicit first row). */
export function selectValidatedActiveOrganizationId(
  memberships: MembershipRecord[],
  requestedOrganizationId: string | null | undefined,
  persistedOrganizationId: string | null | undefined
): string | null {
  const active = memberships.filter((m) => isActiveMembershipStatus(m.status))
  const ids = new Set(active.map((m) => m.organizationId))

  if (requestedOrganizationId && ids.has(requestedOrganizationId)) {
    return requestedOrganizationId
  }
  if (persistedOrganizationId && ids.has(persistedOrganizationId)) {
    return persistedOrganizationId
  }
  if (active.length === 1) {
    return active[0].organizationId
  }
  return null
}
