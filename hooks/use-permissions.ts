'use client'

import { useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'viewer' | 'editor' | 'admin' | 'super_admin'

interface UserPermissions {
  canView: boolean
  canEdit: boolean
  canManageUsers: boolean
  canDeleteOrganization: boolean
}

const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  viewer: {
    canView: true,
    canEdit: false,
    canManageUsers: false,
    canDeleteOrganization: false,
  },
  editor: {
    canView: true,
    canEdit: true,
    canManageUsers: false,
    canDeleteOrganization: false,
  },
  admin: {
    canView: true,
    canEdit: true,
    canManageUsers: true,
    canDeleteOrganization: false,
  },
  super_admin: {
    canView: true,
    canEdit: true,
    canManageUsers: true,
    canDeleteOrganization: true,
  },
}

export function usePermissions() {
  const { user } = useAuth()
  const supabase = createClient()

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

  const getPermissions = useCallback(
    async (organizationId: string): Promise<UserPermissions> => {
      const role = await getUserRole(organizationId)
      return role ? ROLE_PERMISSIONS[role] : ROLE_PERMISSIONS.viewer
    },
    [getUserRole]
  )

  const can = useCallback(
    async (
      organizationId: string,
      permission: keyof UserPermissions
    ): Promise<boolean> => {
      const perms = await getPermissions(organizationId)
      return perms[permission]
    },
    [getPermissions]
  )

  return {
    getUserRole,
    getPermissions,
    can,
    ROLE_PERMISSIONS,
  }
}
