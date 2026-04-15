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
  role: string
  status?: 'active' | 'inactive' | 'invited'
  joined_at?: string
  invited_at?: string
  created_at?: string
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
          created_at,
          profiles:user_id (
            email,
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
        email: member.profiles?.email || '',
        first_name: member.profiles?.first_name,
        last_name: member.profiles?.last_name,
        role: member.role,
        status: member.status,
        joined_at: member.joined_at,
        invited_at: member.invited_at,
        created_at: member.created_at,
      }))
    },
    [supabase]
  )

  const updateMemberRole = useCallback(
    async (
      organizationId: string,
      memberId: string,
      newRole: string
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

  const addMemberByEmail = useCallback(
    async (organizationId: string, email: string, role: string) => {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        return { success: false, error: 'Email is required' }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .single()

      if (profileError || !profile?.id) {
        return {
          success: false,
          error:
            'User not found. Ask the user to sign up first, then add them to this organization.',
        }
      }

      const { error: insertError } = await supabase
        .from('user_organization_members')
        .insert({
          user_id: profile.id,
          organization_id: organizationId,
          role,
        })

      if (insertError) {
        if (insertError.code === '23505') {
          return { success: false, error: 'User is already a member of this organization.' }
        }
        return { success: false, error: insertError.message }
      }

      return { success: true as const }
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
      const result = await addMemberByEmail(organizationId, email, role)
      if (!result.success) {
        console.error('[v0] Error inviting member:', result.error)
      }
      return result.success
    },
    [addMemberByEmail]
  )

  return {
    getTeamMembers,
    updateMemberRole,
    removeMember,
    addMemberByEmail,
    inviteMember,
  }
}
