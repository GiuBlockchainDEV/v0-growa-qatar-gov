'use client'

import { useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

interface TeamMember {
  id: string
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  role: 'viewer' | 'editor' | 'admin' | 'super_admin'
  status: 'active' | 'inactive' | 'invited'
  joined_at: string
  invited_at?: string
}

export function useTeamManagement() {
  const { user } = useAuth()
  const supabase = createClient()

  const getTeamMembers = useCallback(
    async (organizationId: string): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('user_organization_members')
        .select(
          `
          id,
          user_id,
          role,
          status,
          joined_at,
          invited_at,
          profiles:user_id (
            first_name,
            last_name
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('joined_at', { ascending: false })

      if (error) {
        console.error('[v0] Error fetching team members:', error)
        return []
      }

      // Flatten the structure and add user email
      return data.map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        email: member.email || '',
        first_name: member.profiles?.first_name,
        last_name: member.profiles?.last_name,
        role: member.role,
        status: member.status,
        joined_at: member.joined_at,
        invited_at: member.invited_at,
      }))
    },
    [supabase]
  )

  const updateMemberRole = useCallback(
    async (
      organizationId: string,
      memberId: string,
      newRole: 'viewer' | 'editor' | 'admin' | 'super_admin'
    ) => {
      const { error } = await supabase
        .from('user_organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('organization_id', organizationId)

      if (error) {
        console.error('[v0] Error updating member role:', error)
        return false
      }
      return true
    },
    [supabase]
  )

  const removeMember = useCallback(
    async (organizationId: string, memberId: string) => {
      const { error } = await supabase
        .from('user_organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', organizationId)

      if (error) {
        console.error('[v0] Error removing member:', error)
        return false
      }
      return true
    },
    [supabase]
  )

  const inviteMember = useCallback(
    async (organizationId: string, email: string, role: string = 'viewer') => {
      const { error } = await supabase.from('user_organization_members').insert({
        organization_id: organizationId,
        email,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[v0] Error inviting member:', error)
        return false
      }
      return true
    },
    [supabase]
  )

  return {
    getTeamMembers,
    updateMemberRole,
    removeMember,
    inviteMember,
  }
}
