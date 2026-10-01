'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './use-auth'
import { createClient } from '@/lib/supabase/client'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  type?: string | null
  organization_type?: string | null
}

type OrganizationState = { organization: Organization | null; organizations: Organization[] }

/* One lookup per signed-in user, shared by every caller. The hook runs in the
   rail, the header, the map and most screens: each instance used to run the
   same one-to-four Supabase queries on its own. */
const organizationRequests = new Map<string, Promise<OrganizationState>>()

/** Forget the cached organisation (after creating one or switching context). */
export function invalidateOrganizationCache() {
  organizationRequests.clear()
}

async function loadOrganizations(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null }
): Promise<OrganizationState> {
  const isGrowaAdmin = user.email?.endsWith('@growa.ai') || false

  // In impersonation mode, organization context comes from effective role RPC.
  // This keeps dashboard modules (e.g. Supply Overview) scoped to impersonated org.
  if (isGrowaAdmin) {
    let roleData: { org_id?: string; is_impersonating?: boolean } | null = null
    const { data: effectiveRoleData } = await supabase.rpc('get_effective_role', {
      user_id: user.id,
    })
    roleData = effectiveRoleData?.[0] || null

    if (!roleData?.is_impersonating) {
      const { data: impersonationState } = await supabase
        .from('user_impersonation_state')
        .select('org_id, is_impersonating')
        .eq('user_id', user.id)
        .maybeSingle()
      if (impersonationState?.is_impersonating && impersonationState?.org_id) {
        roleData = { org_id: impersonationState.org_id, is_impersonating: true }
      }
    }

    if (roleData?.is_impersonating && roleData?.org_id) {
      const { data: impersonatedOrg, error: impersonatedOrgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', roleData.org_id)
        .maybeSingle()

      if (!impersonatedOrgError && impersonatedOrg) {
        return { organization: impersonatedOrg as Organization, organizations: [impersonatedOrg as Organization] }
      }
    }
  }

  // Get organizations where user is a member
  const { data: memberships, error: memberError } = await supabase
    .from('user_organization_members')
    .select('organization_id')
    .eq('user_id', user.id)

  if (memberError) throw memberError
  if (!memberships || memberships.length === 0) return { organization: null, organizations: [] }

  const orgIds = memberships.map((m) => m.organization_id)
  const { data: orgs, error: orgsError } = await supabase.from('organizations').select('*').in('id', orgIds)
  if (orgsError) throw orgsError

  return { organization: orgs?.[0] ?? null, organizations: orgs || [] }
}

export function useOrganization() {
  const { user } = useAuth()
  const [state, setState] = useState<OrganizationState>({ organization: null, organizations: [] })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false
    let request = organizationRequests.get(user.id)
    if (!request) {
      request = loadOrganizations(supabase, user)
      organizationRequests.set(user.id, request)
      // A failure is not remembered: the next caller tries again.
      request.catch(() => organizationRequests.delete(user.id))
    }

    request
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch((error) => {
        console.error('[organization] Error fetching organizations:', error?.code ?? '', error?.message ?? error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, supabase])

  return { organization: state.organization, organizations: state.organizations, loading }
}
