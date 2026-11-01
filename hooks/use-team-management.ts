'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/* Rows as PostgREST returns them; every column optional because the
   schema differs between migrations. */
interface MemberRow {
  id: string
  user_id: string
  role: string
  status?: TeamMember['status']
  joined_at?: string
  invited_at?: string
  created_at?: string
}
interface ProfileRow {
  id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

export interface TeamMember {
  id: string
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  status?: 'active' | 'inactive' | 'invited'
  joined_at?: string
  invited_at?: string
  created_at?: string
}

export function useTeamManagement() {
  const supabase = createClient()

  /* `user_organization_members.user_id` references auth.users, not
     profiles: PostgREST has no relationship to follow, so the embedded
     `profiles:user_id (...)` select failed on every call (PGRST200, logged as
     `{}`). Two plain queries instead, joined here. `*` on both tables so a
     database that has not run every migration (status / joined_at /
     first_name) still answers. */
  const getTeamMembers = useCallback(
    async (organizationId: string): Promise<TeamMember[]> => {
      const { data: rows, error } = await supabase
        .from('user_organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[team] Error fetching team members:', error.code, error.message, error.details ?? '')
        return []
      }

      const members = (rows ?? []) as MemberRow[]
      const userIds = Array.from(new Set(members.map((member) => member.user_id).filter(Boolean)))

      // Profiles are best effort: RLS may only expose the caller's own row.
      const profilesById = new Map<string, ProfileRow>()
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)
        if (profileError) {
          console.warn('[team] Profiles unavailable for members:', profileError.code, profileError.message)
        }
        for (const profile of (profiles ?? []) as ProfileRow[]) {
          profilesById.set(profile.id, profile)
        }
      }

      return members.map((member) => {
        const profile = profilesById.get(member.user_id)
        const [firstFromFull, ...restFromFull] = String(profile?.full_name || '').split(' ')
        return {
          id: member.id,
          user_id: member.user_id,
          email: profile?.email || '',
          first_name: profile?.first_name || firstFromFull || undefined,
          last_name: profile?.last_name || restFromFull.join(' ') || undefined,
          role: member.role,
          status: member.status,
          joined_at: member.joined_at ?? member.created_at,
          invited_at: member.invited_at,
          created_at: member.created_at,
        }
      })
    },
    [supabase]
  )

  const updateMemberRole = useCallback(async (organizationId: string, memberId: string, newRole: string) => {
    const res = await fetch(`/api/memberships/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, role: newRole }),
    })
    if (!res.ok) {
      console.error('[team] role update failed:', await res.text())
      return false
    }
    return true
  }, [])

  const addMemberByEmail = useCallback(async (organizationId: string, email: string, role: string) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, email, role }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      return { success: false as const, error: data.error ?? 'Invitation failed' }
    }
    return { success: true as const }
  }, [])

  const removeMember = useCallback(async (organizationId: string, memberId: string) => {
    const res = await fetch(
      `/api/memberships/${encodeURIComponent(memberId)}?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      console.error('[team] member removal failed:', await res.text())
      return false
    }
    return true
  }, [])

  const inviteMember = addMemberByEmail

  return {
    getTeamMembers,
    updateMemberRole,
    removeMember,
    addMemberByEmail,
    inviteMember,
  }
}
