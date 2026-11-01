'use client'

import { useCallback } from 'react'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import type { PermissionKey } from '@/lib/auth/capabilities'
import { permissionsForOrgRole, roleDisplayName } from '@/lib/auth/role-registry'
import type { OrgType, SharedLayer } from './use-governance'

export type UserRole = string

interface UserPermissions {
  canView: boolean
  canEdit: boolean
  canManageUsers: boolean
  canDeleteOrganization: boolean
  canShareData: boolean
  canViewRegulatory: boolean
  canViewCommercial: boolean
  canViewFinance: boolean
  canViewTechnical: boolean
}

function legacyPermissionsFromCapabilities(
  has: (key: PermissionKey) => boolean
): UserPermissions {
  return {
    canView: has('farms.view') || has('organizations.view'),
    canEdit: has('farms.edit') || has('supply.edit'),
    canManageUsers: has('users.manage'),
    canDeleteOrganization: has('organizations.manage'),
    canShareData: has('data_sharing.manage'),
    canViewRegulatory: has('intelligence.view'),
    canViewCommercial: has('supply.view'),
    canViewFinance: has('supply.view'),
    canViewTechnical: has('farms.view'),
  }
}

export function usePermissions() {
  const activeOrg = useActiveOrganizationOptional()

  const getUserRole = useCallback(
    async (organizationId: string): Promise<UserRole | null> => {
      if (!activeOrg) return null
      if (activeOrg.activeOrganizationId !== organizationId) {
        const membership = activeOrg.memberships.find((m) => m.organizationId === organizationId)
        return membership?.role ?? null
      }
      return activeOrg.effectiveOrgRole
    },
    [activeOrg]
  )

  const getPermissions = useCallback(
    async (organizationId: string): Promise<UserPermissions> => {
      const role = await getUserRole(organizationId)
      if (activeOrg?.activeOrganizationId === organizationId) {
        return legacyPermissionsFromCapabilities(activeOrg.hasPermission)
      }
      return legacyPermissionsFromCapabilities((key) =>
        permissionsForOrgRole(role).has(key)
      )
    },
    [activeOrg, getUserRole]
  )

  const can = useCallback(
    async (_organizationId: string, permission: keyof UserPermissions): Promise<boolean> => {
      const perms = await getPermissions(_organizationId)
      return perms[permission]
    },
    [getPermissions]
  )

  const canAccessLayer = useCallback(
    async (organizationId: string, layer: SharedLayer): Promise<boolean> => {
      const perms = await getPermissions(organizationId)
      switch (layer) {
        case 'regulatory':
          return perms.canViewRegulatory
        case 'commercial':
          return perms.canViewCommercial
        case 'finance':
          return perms.canViewFinance
        case 'technical_support':
          return perms.canViewTechnical
        default:
          return false
      }
    },
    [getPermissions]
  )

  const isAdmin = useCallback(
    async (organizationId: string): Promise<boolean> => {
      if (activeOrg?.activeOrganizationId === organizationId) {
        return activeOrg.hasPermission('users.manage')
      }
      const role = await getUserRole(organizationId)
      return permissionsForOrgRole(role).has('users.manage')
    },
    [activeOrg, getUserRole]
  )

  const hasCapability = useCallback(
    (key: PermissionKey) => activeOrg?.hasPermission(key) ?? false,
    [activeOrg]
  )

  const getRoleDisplayName = useCallback((role: UserRole): string => roleDisplayName(role), [])

  const getUserOrgType = useCallback(async (_organizationId: string): Promise<OrgType | null> => {
    const org = activeOrg?.organizations.find((o) => o.id === _organizationId)
    const value = org?.organization_type || org?.type
    return (value as OrgType) || null
  }, [activeOrg])

  return {
    getUserRole,
    getUserOrgType,
    getPermissions,
    can,
    canAccessLayer,
    isAdmin,
    hasCapability,
    getRoleDisplayName,
  }
}

export function usePermissionsOptional() {
  try {
    return usePermissions()
  } catch {
    return null
  }
}
