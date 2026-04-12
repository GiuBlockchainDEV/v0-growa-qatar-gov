'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// Organization types
export type OrgType = 'government_master' | 'government' | 'farm_company' | 'private' | 'public'

// Shared layers from governance doc
export type SharedLayer = 'regulatory' | 'commercial' | 'finance' | 'technical_support'

// Visibility levels
export type VisibilityLevel = 'FULL' | 'SUMMARY' | 'APPROVAL' | 'NO'

// Role definitions by org type
export const ROLE_DEFINITIONS = {
  government_master: [
    { role: 'ministry_officer', display: 'Ministry Officer', description: 'Government oversight and compliance' },
    { role: 'ministry_admin', display: 'Ministry Administrator', description: 'Full ministry access' },
    { role: 'ministry_super_admin', display: 'Ministry Super Admin', description: 'Ministry master control' },
  ],
  government: [
    // Hassad Food
    { role: 'sourcing_manager', display: 'Sourcing Manager', description: 'Manages supplier eligibility and sourcing' },
    { role: 'supply_chain_officer', display: 'Supply Chain Officer', description: 'Supply chain and traceability' },
    { role: 'hassad_admin', display: 'Hassad Administrator', description: 'Full Hassad access' },
    // QDB
    { role: 'finance_officer', display: 'Finance Officer', description: 'Financial management and KPIs' },
    { role: 'credit_analyst', display: 'Credit Analyst', description: 'Financial eligibility assessment' },
    { role: 'qdb_admin', display: 'QDB Administrator', description: 'Full QDB access' },
  ],
  farm_company: [
    { role: 'farm_manager', display: 'Farm Manager', description: 'Individual farm operations' },
    { role: 'agronomist', display: 'Agronomist', description: 'Technical agricultural support' },
    { role: 'farm_company_admin', display: 'Farm Company Administrator', description: 'Full Farm Company access' },
  ],
  private: [
    { role: 'viewer', display: 'Viewer', description: 'View-only access' },
    { role: 'editor', display: 'Editor', description: 'Can edit operations' },
    { role: 'admin', display: 'Administrator', description: 'Full organization control' },
  ],
  public: [
    { role: 'viewer', display: 'Public Viewer', description: 'Limited public access' },
  ],
}

// Shared layer descriptions
export const SHARED_LAYERS = {
  regulatory: {
    name: 'Regulatory',
    description: 'Compliance, inspection, water/food security',
    icon: 'Shield',
  },
  commercial: {
    name: 'Commercial',
    description: 'Harvest forecast, traceability, supplier eligibility',
    icon: 'ShoppingCart',
  },
  finance: {
    name: 'Finance',
    description: 'Digital farm dossier, KPIs, financial eligibility',
    icon: 'DollarSign',
  },
  technical_support: {
    name: 'Technical Support',
    description: 'Device health, diagnostics, support',
    icon: 'Wrench',
  },
}

export function useGovernance() {
  const supabase = createClient()

  // Get user's visibility level for a specific shared layer
  const getUserVisibility = useCallback(async (
    userId: string,
    sharedLayer: SharedLayer
  ): Promise<VisibilityLevel> => {
    const { data, error } = await supabase
      .rpc('get_user_visibility', {
        p_user_id: userId,
        p_shared_layer: sharedLayer,
      })

    if (error) {
      console.error('Error getting visibility:', error)
      return 'NO'
    }

    return (data as VisibilityLevel) || 'NO'
  }, [supabase])

  // Check if user can access specific resource
  const canUserAccess = useCallback(async (
    userId: string,
    resourceType: string,
    resourceOrgId: string
  ): Promise<boolean> => {
    const { data, error } = await supabase
      .rpc('can_user_access', {
        p_user_id: userId,
        p_resource_type: resourceType,
        p_resource_org_id: resourceOrgId,
      })

    if (error) {
      console.error('Error checking access:', error)
      return false
    }

    return data || false
  }, [supabase])

  // Get organization type
  const getOrgType = useCallback(async (orgId: string): Promise<OrgType | null> => {
    const { data, error } = await supabase
      .from('organizations')
      .select('type')
      .eq('id', orgId)
      .single()

    if (error) {
      console.error('Error getting org type:', error)
      return null
    }

    return data?.type as OrgType
  }, [supabase])

  // Get roles available for an organization type
  const getRolesForOrgType = useCallback((orgType: OrgType) => {
    return ROLE_DEFINITIONS[orgType] || ROLE_DEFINITIONS.private
  }, [])

  // Get all top-level organizations (tier 1)
  const getTopLevelOrganizations = useCallback(async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('tier', 1)
      .order('name')

    if (error) {
      console.error('Error getting top-level orgs:', error)
      return []
    }

    return data || []
  }, [supabase])

  // Delegate role to another user
  const delegateRole = useCallback(async (
    userId: string,
    delegatedToUserId: string,
    organizationId: string,
    role: string,
    reason?: string,
    expiresAt?: Date
  ) => {
    const { data, error } = await supabase
      .from('role_delegations')
      .insert({
        user_id: userId,
        delegated_to_user_id: delegatedToUserId,
        organization_id: organizationId,
        delegated_role: role,
        delegation_reason: reason,
        expires_at: expiresAt?.toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error delegating role:', error)
      return null
    }

    return data
  }, [supabase])

  // Get user's delegated roles
  const getUserDelegations = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('role_delegations')
      .select(`
        *,
        delegated_by:user_id(id, email),
        organization:organization_id(id, name, slug)
      `)
      .eq('delegated_to_user_id', userId)
      .eq('is_active', true)

    if (error) {
      console.error('Error getting delegations:', error)
      return []
    }

    return data || []
  }, [supabase])

  // Log audit event
  const logAuditEvent = useCallback(async (
    userId: string,
    organizationId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    changes?: Record<string, unknown>
  ) => {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        changes,
      })

    if (error) {
      console.error('Error logging audit event:', error)
    }
  }, [supabase])

  return {
    getUserVisibility,
    canUserAccess,
    getOrgType,
    getRolesForOrgType,
    getTopLevelOrganizations,
    delegateRole,
    getUserDelegations,
    logAuditEvent,
    ROLE_DEFINITIONS,
    SHARED_LAYERS,
  }
}
