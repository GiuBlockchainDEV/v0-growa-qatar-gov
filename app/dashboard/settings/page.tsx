'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOrganization } from '@/hooks/use-organization'
import { usePermissions } from '@/hooks/use-permissions'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { useTeamManagement } from '@/hooks/use-team-management'
import { Bell, Globe2, Settings2, UserPlus, Users, ShieldCheck, Save } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
] as const

type AssignableRole = (typeof ROLE_OPTIONS)[number]['value']

export default function SettingsPage() {
  const { organization } = useOrganization()
  const { getUserRole } = usePermissions()
  const { menuItems } = useRoleNavigation()
  const { getTeamMembers, addMemberByEmailAndRole, updateMemberRole, removeMember } = useTeamManagement()

  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AssignableRole>('member')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!organization?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      const [role, team] = await Promise.all([
        getUserRole(organization.id),
        getTeamMembers(organization.id),
      ])
      setCurrentRole(role)
      setMembers(team)
      setLoading(false)
    }

    load()
  }, [organization?.id, getUserRole, getTeamMembers])

  const canManageUsers = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'super_admin'
  const supportItem = menuItems.find((item) => item.key === 'support')
  const settingsItem = menuItems.find((item) => item.key === 'settings')

  const roleScopeDescription = useMemo(() => {
    if (!currentRole) return 'No organization role assigned'
    return currentRole.replace(/_/g, ' ')
  }, [currentRole])

  const refreshMembers = async () => {
    if (!organization?.id) return
    const refreshed = await getTeamMembers(organization.id)
    setMembers(refreshed)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !inviteEmail.trim()) return

    setSaving(true)
    setError(null)
    setMessage(null)
    const ok = await addMemberByEmailAndRole(organization.id, inviteEmail.trim(), inviteRole)
    if (!ok) {
      setError('Unable to add member. Ensure the user has already registered.')
    } else {
      setMessage('Member added successfully.')
      setInviteEmail('')
      setInviteRole('member')
      await refreshMembers()
    }
    setSaving(false)
  }

  const handleRoleChange = async (memberId: string, role: AssignableRole) => {
    if (!organization?.id) return
    setSaving(true)
    const ok = await updateMemberRole(organization.id, memberId, role)
    if (!ok) {
      setError('Unable to update role.')
    } else {
      setError(null)
      await refreshMembers()
    }
    setSaving(false)
  }

  const handleRemove = async (memberId: string) => {
    if (!organization?.id) return
    if (!confirm('Remove this member from organization?')) return
    setSaving(true)
    const ok = await removeMember(organization.id, memberId)
    if (!ok) {
      setError('Unable to remove member.')
    } else {
      setError(null)
      await refreshMembers()
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Workspace Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure support preferences and organization membership controls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Access Scope</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Active role: <span className="text-foreground font-medium">{roleScopeDescription}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Organization: {organization?.name || 'Unassigned'}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Role-Aware Menu Snapshot</h2>
          </div>
          <p className="text-xs text-muted-foreground">Support submenu</p>
          <p className="text-sm text-foreground mt-1">
            {(supportItem?.submenu || []).map((item) => item.label).join(' • ') || 'No support menu'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Settings submenu</p>
          <p className="text-sm text-foreground mt-1">
            {(settingsItem?.submenu || []).map((item) => item.label).join(' • ') || 'No settings menu'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#07f880]" />
          <h2 className="font-semibold text-foreground">Organization Members</h2>
        </div>

        {canManageUsers ? (
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@domain.com"
              className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-white/40 focus:border-[#07f880]/40 focus:outline-none"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
              className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-[#07f880]/40 focus:outline-none"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Member
              </span>
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to manage organization members.
          </p>
        )}

        {message && <p className="text-sm text-[#07f880]">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">User</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">Role</th>
                <th className="text-right px-3 py-2 text-xs uppercase tracking-wide text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-white/5">
                  <td className="px-3 py-2">
                    <p className="text-foreground">{member.email || member.user_id}</p>
                  </td>
                  <td className="px-3 py-2">
                    {canManageUsers ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as AssignableRole)}
                        className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white focus:border-[#07f880]/40 focus:outline-none"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-white/80 capitalize">{member.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManageUsers ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(member.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-white/30">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No organization members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Notification Rules</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure alert delivery preferences for support and operational events.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Language & Region</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Set workspace language and region formatting defaults.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 py-2 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20"
        >
          <Save className="h-4 w-4" />
          Save Preferences
        </button>
      </div>
    </div>
  )
}
