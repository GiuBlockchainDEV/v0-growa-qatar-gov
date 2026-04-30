'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImpersonationState {
  isGrowaAdmin: boolean
  isImpersonating: boolean
  currentRole: string | null
  currentOrgId: string | null
  currentOrgName: string | null
  currentOrgType: string | null
}

interface Organization {
  id: string
  name: string
  slug: string
  type: string
}

interface RoleOption {
  role: string
  displayName: string
  orgType: string
}

// Available roles for each org type
const ROLE_OPTIONS: Record<string, RoleOption[]> = {
  government_master: [
    { role: 'ministry_admin', displayName: 'Ministry Administrator', orgType: 'government_master' },
    { role: 'ministry_inspector', displayName: 'Ministry Inspector', orgType: 'government_master' },
    { role: 'ministry_officer', displayName: 'Ministry Officer', orgType: 'government_master' },
  ],
  government: [
    { role: 'sourcing_manager', displayName: 'Hassad - Sourcing Manager', orgType: 'government' },
    { role: 'supply_chain_officer', displayName: 'Hassad - Supply Chain', orgType: 'government' },
    { role: 'finance_officer', displayName: 'QDB - Finance Officer', orgType: 'government' },
    { role: 'credit_analyst', displayName: 'QDB - Credit Analyst', orgType: 'government' },
  ],
  farm_company: [
    { role: 'farm_manager', displayName: 'Farm Manager', orgType: 'farm_company' },
    { role: 'agronomist', displayName: 'Agronomist', orgType: 'farm_company' },
    { role: 'operator', displayName: 'Operations Operator', orgType: 'farm_company' },
    { role: 'farm_company_admin', displayName: 'Farm Company Admin', orgType: 'farm_company' },
  ],
  private: [
    { role: 'technical_support', displayName: 'Technical Support', orgType: 'private' },
  ],
}

export function useImpersonation() {
  const [state, setState] = useState<ImpersonationState>({
    isGrowaAdmin: false,
    isImpersonating: false,
    currentRole: null,
    currentOrgId: null,
    currentOrgName: null,
    currentOrgType: null,
  })
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const resolveEffectiveRoleWithFallback = useCallback(
    async (userId: string) => {
      const { data: effectiveRole, error: roleError } = await supabase.rpc('get_effective_role', {
        user_id: userId,
      })
      if (roleError) {
        console.error('Error getting effective role:', roleError)
      }

      const roleData = effectiveRole?.[0]
      if (roleData?.is_impersonating && roleData?.org_id) {
        return roleData
      }

      // Fallback for environments where RPC is missing/misaligned.
      const { data: impState, error: impError } = await supabase
        .from('user_impersonation_state')
        .select('role_name, org_id, is_impersonating')
        .eq('user_id', userId)
        .maybeSingle()

      if (impError || !impState?.is_impersonating || !impState?.org_id) {
        return roleData || null
      }

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, type, organization_type')
        .eq('id', impState.org_id)
        .maybeSingle()

      return {
        role_name: impState.role_name,
        org_id: impState.org_id,
        org_name: orgData?.name || null,
        org_type: (orgData as any)?.organization_type || (orgData as any)?.type || null,
        is_impersonating: true,
      }
    },
    [supabase]
  )

  // Check if user is growa.ai admin and get current role
  const checkStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState({
          isGrowaAdmin: false,
          isImpersonating: false,
          currentRole: null,
          currentOrgId: null,
          currentOrgName: null,
          currentOrgType: null,
        })
        setLoading(false)
        return
      }

      const isGrowaAdmin = user.email?.endsWith('@growa.ai') || false

      if (isGrowaAdmin) {
        // Baseline "normal user" role/org from memberships.
        // This is the default mode unless an explicit impersonation is active.
        const { data: memberships } = await supabase
          .from('user_organization_members')
          .select(`
            role,
            organization:organizations(id, name, type)
          `)
          .eq('user_id', user.id)
          .limit(1)

        const baselineMembership = memberships?.[0] as {
          role?: string | null
          organization?: { id?: string; name?: string; type?: string } | null
        } | undefined
        const baselineOrg = baselineMembership?.organization || null

        // Get effective role (may be impersonated)
        const roleData = await resolveEffectiveRoleWithFallback(user.id)
        const isImpersonating = Boolean(roleData?.is_impersonating)
        const metadataRole =
          typeof user.user_metadata?.role === 'string'
            ? user.user_metadata.role
            : typeof user.app_metadata?.role === 'string'
              ? user.app_metadata.role
              : null

        // In normal mode, NEVER fallback to rpc role/org payload because that can be
        // a default/effective profile unrelated to the admin's own account context.
        const resolvedRole = isImpersonating
          ? (roleData?.role_name as string | null) || null
          : baselineMembership?.role || metadataRole
        const resolvedOrgId = isImpersonating
          ? (roleData?.org_id as string | null) || null
          : baselineOrg?.id || null
        const resolvedOrgName = isImpersonating
          ? (roleData?.org_name as string | null) || null
          : baselineOrg?.name || null
        const resolvedOrgType = isImpersonating
          ? (roleData?.org_type as string | null) || null
          : baselineOrg?.type || null

        setState({
          isGrowaAdmin: true,
          isImpersonating,
          currentRole: resolvedRole,
          currentOrgId: resolvedOrgId,
          currentOrgName: resolvedOrgName,
          currentOrgType: resolvedOrgType,
        })

        // Fetch all organizations for the picker
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name, slug, type')
          .order('type', { ascending: true })
          .order('name', { ascending: true })

        setOrganizations(orgs || [])
      } else {
        // Regular user - get their actual role
        const { data: membership } = await supabase
          .from('user_organization_members')
          .select(`
            role,
            organization:organizations(id, name, type)
          `)
          .eq('user_id', user.id)
          .single()

        const org = membership?.organization as { id: string; name: string; type: string } | null

        setState({
          isGrowaAdmin: false,
          isImpersonating: false,
          currentRole: membership?.role || null,
          currentOrgId: org?.id || null,
          currentOrgName: org?.name || null,
          currentOrgType: org?.type || null,
        })
      }
    } catch (err) {
      console.error('Error checking impersonation status:', err)
      setError('Failed to check status')
    } finally {
      setLoading(false)
    }
  }, [supabase, resolveEffectiveRoleWithFallback])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Set impersonation
  const setImpersonation = useCallback(async (role: string, orgId: string) => {
    if (!state.isGrowaAdmin) {
      setError('Only growa.ai admins can impersonate')
      return false
    }

    try {
      setLoading(true)
      const { error: rpcError } = await supabase
        .rpc('set_impersonation', { p_role: role, p_org_id: orgId })

      if (rpcError) {
        setError(rpcError.message)
        return false
      }

      // Refresh status
      await checkStatus()
      
      // Reload page to apply new navigation
      window.location.reload()
      
      return true
    } catch (err) {
      console.error('Error setting impersonation:', err)
      setError('Failed to set impersonation')
      return false
    } finally {
      setLoading(false)
    }
  }, [state.isGrowaAdmin, supabase, checkStatus])

  // Clear impersonation
  const clearImpersonation = useCallback(async () => {
    try {
      setLoading(true)
      const { error: rpcError } = await supabase.rpc('clear_impersonation')

      if (rpcError) {
        setError(rpcError.message)
        return false
      }

      // Refresh status
      await checkStatus()
      
      // Reload page to apply default navigation
      window.location.reload()
      
      return true
    } catch (err) {
      console.error('Error clearing impersonation:', err)
      setError('Failed to clear impersonation')
      return false
    } finally {
      setLoading(false)
    }
  }, [supabase, checkStatus])

  // Get available roles for an organization type
  const getRolesForOrgType = useCallback((orgType: string): RoleOption[] => {
    return ROLE_OPTIONS[orgType] || []
  }, [])

  // Get all available roles
  const getAllRoles = useCallback((): RoleOption[] => {
    return Object.values(ROLE_OPTIONS).flat()
  }, [])

  return {
    ...state,
    viewMode: state.isImpersonating ? 'impersonation' as const : 'normal' as const,
    organizations,
    loading,
    error,
    setImpersonation,
    clearImpersonation,
    getRolesForOrgType,
    getAllRoles,
    refresh: checkStatus,
  }
}
