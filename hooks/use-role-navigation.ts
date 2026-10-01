'use client'

/*
 * Resolves who the user is for navigation purposes — the effective role and,
 * for ministry roles, the ministry profile — and hands back the menu built
 * by the registry (`lib/navigation/registry.ts`).
 *
 * It used to build a second, permission-filtered menu that no screen showed
 * (layer visibility, permissions and org type fetched on every mount, plus a
 * `role_navigation` table fallback and `ensure*` patches). The rail has been
 * driven by the registry all along; that dead path is gone.
 *
 * Use it through `useSharedRoleNavigation()` (one instance per dashboard).
 */

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { usePermissions } from '@/hooks/use-permissions'
import {
  buildNavigation,
  ministryProfileForRole,
  type MinistryRoleProfile,
} from '@/lib/navigation/registry'

interface RoleState {
  effectiveRole: string | null
  roleProfile: MinistryRoleProfile | null
}

/** Growa staff may be "viewing as" another role through the effective-role RPC. */
async function resolveImpersonatedRole(userId: string): Promise<{ impersonating: boolean; role: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_effective_role', { user_id: userId })
  // Disambiguate overloaded RPC signatures in mixed database states.
  const fallback =
    error?.code === 'PGRST202' || error?.code === 'PGRST203' ? (await supabase.rpc('get_effective_role')).data : null
  let row = (data?.[0] || fallback?.[0] || null) as { is_impersonating?: boolean; role_name?: string } | null

  if (!row?.is_impersonating) {
    const { data: state } = await supabase
      .from('user_impersonation_state')
      .select('role_name, is_impersonating')
      .eq('user_id', userId)
      .maybeSingle()
    if (state?.is_impersonating) row = { is_impersonating: true, role_name: state.role_name }
  }

  return { impersonating: Boolean(row?.is_impersonating), role: row?.role_name ?? null }
}

export function useRoleNavigation() {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const { getUserRole } = usePermissions()
  const [role, setRole] = useState<RoleState>({ effectiveRole: null, roleProfile: null })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveRole(): Promise<RoleState> {
      if (!user) return { effectiveRole: null, roleProfile: null }

      // Organisation role is the baseline.
      let currentRole: string | null = organization?.id ? await getUserRole(organization.id) : null

      // growa.ai staff: the RPC role only while impersonating; otherwise the
      // minimal "normal user" menu, whatever their membership says.
      if (user.email?.endsWith('@growa.ai')) {
        const impersonation = await resolveImpersonatedRole(user.id)
        if (!impersonation.impersonating) return { effectiveRole: 'normal_user', roleProfile: null }
        if (impersonation.role) currentRole = impersonation.role
      }

      // Metadata role is accepted only when the user belongs to an organisation.
      if (!currentRole && organization?.id) {
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role
        currentRole = typeof metadataRole === 'string' ? metadataRole : null
      }

      return { effectiveRole: currentRole, roleProfile: ministryProfileForRole(currentRole) }
    }

    setIsLoading(true)
    resolveRole()
      .then((next) => {
        if (cancelled) return
        setRole(next)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[navigation] role resolution failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to resolve role')
        setRole({ effectiveRole: null, roleProfile: null })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, organization?.id, getUserRole])

  return useMemo(() => {
    const navigation = buildNavigation(role.effectiveRole, role.roleProfile)
    return {
      ...role,
      navigation,
      landingPage: navigation.landing,
      isLoading,
      error,
      isMinistryWorkspace: role.roleProfile !== null,
    }
  }, [role, isLoading, error])
}
