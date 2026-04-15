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

export function useOrganization() {
  const { user } = useAuth()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fetchOrganizations = async () => {
      try {
        const isGrowaAdmin = user.email?.endsWith('@growa.ai') || false

        // In impersonation mode, organization context comes from effective role RPC.
        // This keeps dashboard modules (e.g. Supply Overview) scoped to impersonated org.
        if (isGrowaAdmin) {
          const { data: effectiveRoleData } = await supabase.rpc('get_effective_role')
          const roleData = effectiveRoleData?.[0]

          if (roleData?.is_impersonating && roleData?.org_id) {
            const { data: impersonatedOrg, error: impersonatedOrgError } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', roleData.org_id)
              .maybeSingle()

            if (!impersonatedOrgError && impersonatedOrg) {
              setOrganizations([impersonatedOrg as Organization])
              setOrganization(impersonatedOrg as Organization)
              setLoading(false)
              return
            }
          }
        }

        // Get organizations where user is a member
        const { data: memberships, error: memberError } = await supabase
          .from('user_organization_members')
          .select('organization_id')
          .eq('user_id', user.id)

        if (memberError) throw memberError

        if (!memberships || memberships.length === 0) {
          setLoading(false)
          return
        }

        const orgIds = memberships.map((m) => m.organization_id)

        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .in('id', orgIds)

        if (orgsError) throw orgsError

        setOrganizations(orgs || [])
        if (orgs && orgs.length > 0) {
          setOrganization(orgs[0])
        }
      } catch (error) {
        console.error('[v0] Error fetching organizations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [user, supabase])

  return { organization, organizations, loading }
}
