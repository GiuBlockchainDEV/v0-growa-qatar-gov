'use client'

import { useCallback } from 'react'

export interface AdminUserRow {
  membershipId: string
  userId: string
  organizationId: string
  role: string
  status: string
  email: string
  fullName: string
  accountStatus: string
  departmentScope: string | null
  invitedAt?: string | null
  joinedAt?: string | null
}

export interface OrganizationInvitation {
  id: string
  email: string
  role: string
  status: string
  department_scope?: string | null
  created_at: string
  expires_at: string
  last_sent_at?: string | null
  message?: string | null
}

async function parseJson<T>(res: Response): Promise<T & { error?: string }> {
  return res.json() as Promise<T & { error?: string }>
}

export function useUserAdmin() {
  const listUsers = useCallback(
    async (organizationId: string, filters?: { q?: string; role?: string; status?: string }) => {
      const params = new URLSearchParams({ organizationId })
      if (filters?.q) params.set('q', filters.q)
      if (filters?.role) params.set('role', filters.role)
      if (filters?.status) params.set('status', filters.status)
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await parseJson<{ users: AdminUserRow[] }>(res)
      if (!res.ok) {
        return { ok: false as const, error: data.error ?? 'Failed to load users' }
      }
      return { ok: true as const, users: data.users ?? [] }
    },
    []
  )

  const listInvitations = useCallback(async (organizationId: string) => {
    const res = await fetch(`/api/invitations?organizationId=${encodeURIComponent(organizationId)}`)
    const data = await parseJson<{ invitations: OrganizationInvitation[] }>(res)
    if (!res.ok) {
      return { ok: false as const, error: data.error ?? 'Failed to load invitations' }
    }
    return { ok: true as const, invitations: data.invitations ?? [] }
  }, [])

  const resendInvitation = useCallback(async (organizationId: string, invitationId: string) => {
    const res = await fetch(`/api/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    })
    const data = await parseJson<{ devInviteUrl?: string; delivery?: { sent: boolean; devMessage?: string } }>(res)
    if (!res.ok) {
      return { ok: false as const, error: data.error ?? 'Resend failed' }
    }
    return { ok: true as const, devInviteUrl: data.devInviteUrl, delivery: data.delivery }
  }, [])

  const revokeInvitation = useCallback(async (organizationId: string, invitationId: string) => {
    const res = await fetch(`/api/invitations/${invitationId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    })
    const data = await parseJson<Record<string, never>>(res)
    if (!res.ok) {
      return { ok: false as const, error: data.error ?? 'Revoke failed' }
    }
    return { ok: true as const }
  }, [])

  const updateMemberRole = useCallback(
    async (organizationId: string, membershipId: string, role: string) => {
      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, role }),
      })
      const data = await parseJson<Record<string, never>>(res)
      if (!res.ok) {
        return { ok: false as const, error: data.error ?? 'Role update failed' }
      }
      return { ok: true as const }
    },
    []
  )

  const removeMember = useCallback(async (organizationId: string, membershipId: string) => {
    const res = await fetch(
      `/api/memberships/${membershipId}?organizationId=${encodeURIComponent(organizationId)}`,
      { method: 'DELETE' }
    )
    const data = await parseJson<Record<string, never>>(res)
    if (!res.ok) {
      return { ok: false as const, error: data.error ?? 'Remove failed' }
    }
    return { ok: true as const }
  }, [])

  const setAccountStatus = useCallback(
    async (organizationId: string, userId: string, action: 'suspend' | 'reactivate') => {
      const res = await fetch('/api/account/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, userId, action }),
      })
      const data = await parseJson<Record<string, never>>(res)
      if (!res.ok) {
        return { ok: false as const, error: data.error ?? 'Account update failed' }
      }
      return { ok: true as const }
    },
    []
  )

  const fetchUserDetail = useCallback(async (organizationId: string, userId: string) => {
    const res = await fetch(
      `/api/admin/users/${userId}?organizationId=${encodeURIComponent(organizationId)}`
    )
    const data = await parseJson<Record<string, unknown>>(res)
    if (!res.ok) {
      return { ok: false as const, error: (data.error as string) ?? 'Failed to load user' }
    }
    return { ok: true as const, detail: data }
  }, [])

  const fetchAudit = useCallback(async (organizationId: string, limit = 50) => {
    const res = await fetch(
      `/api/audit?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`
    )
    const data = await parseJson<{ events: unknown[] }>(res)
    if (!res.ok) {
      return { ok: false as const, error: data.error ?? 'Failed to load audit' }
    }
    return { ok: true as const, events: data.events ?? [] }
  }, [])

  return {
    listUsers,
    listInvitations,
    resendInvitation,
    revokeInvitation,
    updateMemberRole,
    removeMember,
    setAccountStatus,
    fetchUserDetail,
    fetchAudit,
  }
}
