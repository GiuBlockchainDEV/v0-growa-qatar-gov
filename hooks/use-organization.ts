'use client'

import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  type?: string | null
  organization_type?: string | null
}

const organizationRequests = new Map<string, Promise<{ organization: Organization | null; organizations: Organization[] }>>()

/** Forget cached organisation lookups (legacy callers + active-org refresh). */
export function invalidateOrganizationCache() {
  organizationRequests.clear()
}

/**
 * Organization context for the signed-in user.
 * Dashboard routes resolve the active tenant via ActiveOrganizationProvider + session API.
 */
export function useOrganization() {
  const activeOrg = useActiveOrganizationOptional()

  if (activeOrg) {
    return {
      organization: activeOrg.activeOrganization,
      organizations: activeOrg.organizations,
      loading: activeOrg.loading,
    }
  }

  return { organization: null, organizations: [], loading: false }
}
