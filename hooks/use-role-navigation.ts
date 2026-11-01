'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { usePlatformCapabilities } from '@/hooks/use-platform-capabilities'
import {
  buildNavigation,
  ministryProfileForRole,
  type MinistryRoleProfile,
} from '@/lib/navigation/registry'
import { filterNavByPermissions } from '@/lib/navigation/admin-nav-filter'

interface RoleState {
  effectiveRole: string | null
  roleProfile: MinistryRoleProfile | null
}

export function useRoleNavigation() {
  const { user } = useAuth()
  const activeOrg = useActiveOrganizationOptional()
  const { isPlatformAdmin, rolePreviewActive, previewRole } = usePlatformCapabilities()
  const [role, setRole] = useState<RoleState>({ effectiveRole: null, roleProfile: null })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setRole({ effectiveRole: null, roleProfile: null })
      setIsLoading(false)
      return
    }

    let cancelled = false

    try {
      let effectiveRole: string | null = null

      if (isPlatformAdmin && rolePreviewActive && previewRole) {
        effectiveRole = previewRole
      } else if (isPlatformAdmin && !rolePreviewActive) {
        effectiveRole = 'normal_user'
      } else if (activeOrg?.effectiveOrgRole) {
        effectiveRole = activeOrg.effectiveOrgRole
      } else if (activeOrg?.requiresOrganizationSelection) {
        effectiveRole = 'viewer'
      }

      const next = {
        effectiveRole,
        roleProfile: ministryProfileForRole(effectiveRole),
      }
      if (!cancelled) {
        setRole(next)
        setError(null)
        setIsLoading(false)
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to resolve role')
        setRole({ effectiveRole: null, roleProfile: null })
        setIsLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
  }, [
    user,
    activeOrg?.effectiveOrgRole,
    activeOrg?.requiresOrganizationSelection,
    isPlatformAdmin,
    rolePreviewActive,
    previewRole,
  ])

  return useMemo(() => {
    const base = buildNavigation(role.effectiveRole, role.roleProfile)
    const hasPermission = activeOrg?.hasPermission ?? (() => false)
    const filteredItems = filterNavByPermissions(base.items, hasPermission, {
      isPlatformStaff: Boolean(activeOrg?.platformStaffTier),
    })
    const grouped = base.areas
      .map((area) => ({
        area,
        items: filteredItems.filter((item) => item.area === area.id),
      }))
      .filter((g) => g.items.length > 0)

    const navigation = {
      ...base,
      items: filteredItems,
      grouped,
    }

    return {
      ...role,
      navigation,
      landingPage: navigation.landing,
      isLoading: isLoading || Boolean(activeOrg?.loading),
      error,
      isMinistryWorkspace: role.roleProfile !== null,
    }
  }, [role, isLoading, activeOrg?.loading, activeOrg?.hasPermission, activeOrg?.platformStaffTier, error])
}
