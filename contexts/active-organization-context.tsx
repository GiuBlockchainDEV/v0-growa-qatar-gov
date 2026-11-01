'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { invalidateOrganizationCache } from '@/hooks/use-organization'
import type { PermissionKey } from '@/lib/auth/capabilities'
import { buildOperationalContextParams } from '@/lib/domain/operational-context'
import type { Organization } from '@/hooks/use-organization'

const ACTIVE_ORG_STORAGE_KEY = 'growa:active-organization-id'

export interface SessionMembership {
  organizationId: string
  role: string
  status?: string | null
  source?: 'canonical' | 'legacy'
}

interface ActiveOrganizationContextValue {
  loading: boolean
  organizations: Organization[]
  activeOrganization: Organization | null
  activeOrganizationId: string | null
  memberships: SessionMembership[]
  permissions: ReadonlySet<PermissionKey>
  effectiveOrgRole: string | null
  platformStaffTier: string | null
  requiresOrganizationSelection: boolean
  hasPermission: (key: PermissionKey) => boolean
  switchOrganization: (organizationId: string) => Promise<boolean>
  refreshSession: () => Promise<void>
}

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | null>(null)

async function fetchSessionContext(organizationId: string | null) {
  const params = new URLSearchParams()
  if (organizationId) params.set('organizationId', organizationId)
  const persisted =
    typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) : null

  const res = await fetch(`/api/auth/session-context?${params.toString()}`, {
    cache: 'no-store',
    headers: persisted ? { 'x-growa-active-organization-id': persisted } : undefined,
  })
  const payload = await res.json()
  if (!res.ok) {
    throw new Error(payload.error || 'Failed to load session context')
  }
  return payload as {
    memberships: SessionMembership[]
    activeOrganizationId: string | null
    permissions: PermissionKey[]
    effectiveOrgRole: string | null
    platformStaffTier: string | null
    requiresOrganizationSelection: boolean
  }
}

export function ActiveOrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlOrganizationId = searchParams.get('organizationId')

  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<SessionMembership[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<ReadonlySet<PermissionKey>>(new Set())
  const [effectiveOrgRole, setEffectiveOrgRole] = useState<string | null>(null)
  const [platformStaffTier, setPlatformStaffTier] = useState<string | null>(null)
  const [requiresOrganizationSelection, setRequiresOrganizationSelection] = useState(false)

  const loadOrganizationsForIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setOrganizations([])
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.from('organizations').select('*').in('id', ids)
    setOrganizations((data as Organization[]) || [])
  }, [])

  const refreshSession = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const session = await fetchSessionContext(urlOrganizationId)
      setMemberships(session.memberships)
      setPermissions(new Set(session.permissions))
      setEffectiveOrgRole(session.effectiveOrgRole)
      setPlatformStaffTier(session.platformStaffTier)
      setRequiresOrganizationSelection(session.requiresOrganizationSelection)

      let resolvedActiveId = session.activeOrganizationId

      if (resolvedActiveId) {
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, resolvedActiveId)
      } else {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: caps } = await supabase.rpc('get_my_auth_capabilities')
        const capRow = (Array.isArray(caps) ? caps[0] : caps) as
          | { role_preview_active?: boolean; preview_org_id?: string | null }
          | undefined
        if (capRow?.role_preview_active && capRow.preview_org_id) {
          resolvedActiveId = capRow.preview_org_id
        }
      }

      setActiveOrganizationId(resolvedActiveId)

      const orgIds = Array.from(
        new Set([
          ...session.memberships.map((m) => m.organizationId),
          ...(resolvedActiveId ? [resolvedActiveId] : []),
        ])
      )
      await loadOrganizationsForIds(orgIds)
      invalidateOrganizationCache()
    } catch (error) {
      console.error('[active-org] session refresh failed', error)
    } finally {
      setLoading(false)
    }
  }, [user, urlOrganizationId, loadOrganizationsForIds])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const res = await fetch('/api/auth/active-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })
      const payload = await res.json()
      if (!res.ok) {
        console.error('[active-org] switch failed', payload.error)
        return false
      }

      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId)
      invalidateOrganizationCache()

      const params = buildOperationalContextParams(searchParams, { organizationId })
      router.replace(`/dashboard?${params.toString()}`, { scroll: false })
      await refreshSession()
      return true
    },
    [router, searchParams, refreshSession]
  )

  const activeOrganization = useMemo(
    () => organizations.find((org) => org.id === activeOrganizationId) ?? null,
    [organizations, activeOrganizationId]
  )

  const value = useMemo<ActiveOrganizationContextValue>(
    () => ({
      loading,
      organizations,
      activeOrganization,
      activeOrganizationId,
      memberships,
      permissions,
      effectiveOrgRole,
      platformStaffTier,
      requiresOrganizationSelection,
      hasPermission: (key) => permissions.has(key),
      switchOrganization,
      refreshSession,
    }),
    [
      loading,
      organizations,
      activeOrganization,
      activeOrganizationId,
      memberships,
      permissions,
      effectiveOrgRole,
      platformStaffTier,
      requiresOrganizationSelection,
      switchOrganization,
      refreshSession,
    ]
  )

  return (
    <ActiveOrganizationContext.Provider value={value}>{children}</ActiveOrganizationContext.Provider>
  )
}

export function useActiveOrganization() {
  const ctx = useContext(ActiveOrganizationContext)
  if (!ctx) {
    throw new Error('useActiveOrganization must be used within ActiveOrganizationProvider')
  }
  return ctx
}

export function useActiveOrganizationOptional() {
  return useContext(ActiveOrganizationContext)
}
