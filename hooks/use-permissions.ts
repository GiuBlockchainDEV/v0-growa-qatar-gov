'use client'

import { useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import type { OrgType, SharedLayer, VisibilityLevel } from './use-governance'
import { resolveOrgTypeForRow } from '@/lib/supabase/schema-compat'

// All possible roles across organization types
export type UserRole = 
  // Legacy roles
  | 'viewer' | 'editor' | 'admin' | 'super_admin' | 'member' | 'owner'
  // Ministry roles
  | 'ministry_officer' | 'ministry_admin' | 'ministry_super_admin'
  // Hassad roles
  | 'sourcing_manager' | 'supply_chain_officer' | 'hassad_admin'
  // QDB roles
  | 'finance_officer' | 'credit_analyst' | 'qdb_admin'
  // Farm Company roles
  | 'farm_manager' | 'agronomist' | 'farm_company_admin'

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

// Permission mappings for each role
const ROLE_PERMISSIONS: Record<string, UserPermissions> = {
  // Legacy roles
  viewer: {
    canView: true, canEdit: false, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: false,
  },
  editor: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: false,
  },
  admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: false,
  },
  super_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: true,
    canShareData: true, canViewRegulatory: true, canViewCommercial: true, canViewFinance: true, canViewTechnical: true,
  },
  member: {
    canView: true, canEdit: false, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: false,
  },
  owner: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: false,
  },

  // Ministry roles - Full access to all layers
  ministry_officer: {
    canView: true, canEdit: false, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: true, canViewCommercial: true, canViewFinance: true, canViewTechnical: true,
  },
  ministry_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: true, canViewCommercial: true, canViewFinance: true, canViewTechnical: true,
  },
  ministry_super_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: true,
    canShareData: true, canViewRegulatory: true, canViewCommercial: true, canViewFinance: true, canViewTechnical: true,
  },

  // Hassad roles - Commercial focus
  sourcing_manager: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: true, canViewFinance: false, canViewTechnical: false,
  },
  supply_chain_officer: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: true, canViewFinance: false, canViewTechnical: false,
  },
  hassad_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: false, canViewCommercial: true, canViewFinance: false, canViewTechnical: false,
  },

  // QDB roles - Finance focus
  finance_officer: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: true, canViewTechnical: false,
  },
  credit_analyst: {
    canView: true, canEdit: false, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: true, canViewTechnical: false,
  },
  qdb_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: false, canViewCommercial: false, canViewFinance: true, canViewTechnical: false,
  },

  // Farm Company roles - Technical/Operational focus
  farm_manager: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: true,
  },
  agronomist: {
    canView: true, canEdit: true, canManageUsers: false, canDeleteOrganization: false,
    canShareData: false, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: true,
  },
  farm_company_admin: {
    canView: true, canEdit: true, canManageUsers: true, canDeleteOrganization: false,
    canShareData: true, canViewRegulatory: false, canViewCommercial: false, canViewFinance: false, canViewTechnical: true,
  },
}

export function usePermissions() {
  const { user } = useAuth()
  const supabase = createClient()

  // Get user's role in an organization
  const getUserRole = useCallback(
    async (organizationId: string): Promise<UserRole | null> => {
      if (!user) return null

      const { data, error } = await supabase
        .from('user_organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .single()

      if (error) return null
      return data?.role as UserRole
    },
    [user, supabase]
  )

  // Get user's organization type
  const getUserOrgType = useCallback(
    async (organizationId: string): Promise<OrgType | null> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('type, organization_type')
        .eq('id', organizationId)
        .single()

      if (error) return null
      return resolveOrgTypeForRow(data) as OrgType | null
    },
    [supabase]
  )

  // Get permissions for a specific role
  const getPermissions = useCallback(
    async (organizationId: string): Promise<UserPermissions> => {
      const role = await getUserRole(organizationId)
      return role ? (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer) : ROLE_PERMISSIONS.viewer
    },
    [getUserRole]
  )

  // Check if user has a specific permission
  const can = useCallback(
    async (organizationId: string, permission: keyof UserPermissions): Promise<boolean> => {
      const perms = await getPermissions(organizationId)
      return perms[permission]
    },
    [getPermissions]
  )

  // Check if user can access a specific shared layer
  const canAccessLayer = useCallback(
    async (organizationId: string, layer: SharedLayer): Promise<boolean> => {
      const perms = await getPermissions(organizationId)
      switch (layer) {
        case 'regulatory': return perms.canViewRegulatory
        case 'commercial': return perms.canViewCommercial
        case 'finance': return perms.canViewFinance
        case 'technical_support': return perms.canViewTechnical
        default: return false
      }
    },
    [getPermissions]
  )

  // Check if user is admin-level (can manage users)
  const isAdmin = useCallback(
    async (organizationId: string): Promise<boolean> => {
      const role = await getUserRole(organizationId)
      if (!role) return false
      
      const adminRoles = [
        'owner', 'admin', 'super_admin',
        'ministry_admin', 'ministry_super_admin',
        'hassad_admin', 'qdb_admin', 'farm_company_admin'
      ]
      return adminRoles.includes(role)
    },
    [getUserRole]
  )

  // Get role display name
  const getRoleDisplayName = useCallback((role: UserRole): string => {
    const displayNames: Record<string, string> = {
      viewer: 'Viewer',
      editor: 'Editor',
      admin: 'Administrator',
      super_admin: 'Super Administrator',
      member: 'Member',
      owner: 'Owner',
      ministry_officer: 'Ministry Officer',
      ministry_admin: 'Ministry Administrator',
      ministry_super_admin: 'Ministry Super Admin',
      sourcing_manager: 'Sourcing Manager',
      supply_chain_officer: 'Supply Chain Officer',
      hassad_admin: 'Hassad Administrator',
      finance_officer: 'Finance Officer',
      credit_analyst: 'Credit Analyst',
      qdb_admin: 'QDB Administrator',
      farm_manager: 'Farm Manager',
      agronomist: 'Agronomist',
      farm_company_admin: 'Farm Company Administrator',
    }
    return displayNames[role] || role
  }, [])

  return {
    getUserRole,
    getUserOrgType,
    getPermissions,
    can,
    canAccessLayer,
    isAdmin,
    getRoleDisplayName,
    ROLE_PERMISSIONS,
  }
}
