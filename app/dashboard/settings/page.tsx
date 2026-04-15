'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, type Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
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
type OrgOption = { id: string; name: string; slug: string }
type ProfileRecord = Record<string, unknown>

const SELECT_STYLE = { backgroundColor: '#0f1115', color: '#f8fafc' }
const OPTION_STYLE = { backgroundColor: '#0f1115', color: '#f8fafc' }
const SELECT_CLASS =
  'rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-[#07f880]/40 focus:outline-none'

function hasColumn(row: ProfileRecord | null, key: string) {
  return Boolean(row && Object.prototype.hasOwnProperty.call(row, key))
}

function isMissingColumnError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('could not find') ||
    normalized.includes('schema cache') ||
    normalized.includes('column') ||
    normalized.includes('does not exist')
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const { locale, setLocale } = useLocale()
  const { organization } = useOrganization()
  const { getUserRole } = usePermissions()
  const { menuItems } = useRoleNavigation()
  const { getTeamMembers, addMemberByEmail, updateMemberRole, removeMember } = useTeamManagement()

  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AssignableRole>('member')
  const [notificationEmail, setNotificationEmail] = useState(true)
  const [notificationInApp, setNotificationInApp] = useState(true)
  const [notificationCriticalOnly, setNotificationCriticalOnly] = useState(false)
  const [languageChoice, setLanguageChoice] = useState<Locale>(locale)
  const [profileRecord, setProfileRecord] = useState<ProfileRecord | null>(null)
  const [availableOrganizations, setAvailableOrganizations] = useState<OrgOption[]>([])
  const [inviteRequestOrgId, setInviteRequestOrgId] = useState('')
  const [inviteRequestMessage, setInviteRequestMessage] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData.user?.id

        const rolePromise = organization?.id ? getUserRole(organization.id) : Promise.resolve(null)
        const teamPromise = organization?.id ? getTeamMembers(organization.id) : Promise.resolve([])
        const profilePromise = userId
          ? supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
          : Promise.resolve({ data: null, error: null })

        const [role, team, profileData, organizationsData] = await Promise.all([
          rolePromise,
          teamPromise,
          profilePromise,
          supabase.from('organizations').select('id, name, slug').order('name', { ascending: true }),
        ])

        setCurrentRole(role)
        setMembers(team)
        setAvailableOrganizations(organizationsData.data || [])

        const row = (profileData.data as ProfileRecord | null) || null
        setProfileRecord(row)

        if (row) {
          const rowPrefs =
            (typeof row.notification_preferences === 'object' &&
            row.notification_preferences !== null
              ? (row.notification_preferences as Record<string, unknown>)
              : null) ||
            (typeof row.metadata === 'object' &&
            row.metadata !== null &&
            typeof (row.metadata as Record<string, unknown>).notification_preferences === 'object'
              ? ((row.metadata as Record<string, unknown>)
                  .notification_preferences as Record<string, unknown>)
              : null)

          const nextNotificationEmail =
            typeof rowPrefs?.email === 'boolean'
              ? rowPrefs.email
              : typeof row.notifications_email === 'boolean'
                ? row.notifications_email
                : true
          const nextNotificationInApp =
            typeof rowPrefs?.inApp === 'boolean'
              ? rowPrefs.inApp
              : typeof row.notifications_inapp === 'boolean'
                ? row.notifications_inapp
                : true
          const nextNotificationCriticalOnly =
            typeof rowPrefs?.criticalOnly === 'boolean'
              ? rowPrefs.criticalOnly
              : typeof row.notifications_critical_only === 'boolean'
                ? row.notifications_critical_only
                : false

          setNotificationEmail(nextNotificationEmail)
          setNotificationInApp(nextNotificationInApp)
          setNotificationCriticalOnly(nextNotificationCriticalOnly)

          const preferredLocale =
            (typeof row.preferred_locale === 'string' ? row.preferred_locale : null) ||
            (typeof row.locale === 'string' ? row.locale : null) ||
            (typeof row.metadata === 'object' &&
            row.metadata !== null &&
            typeof (row.metadata as Record<string, unknown>).preferred_locale === 'string'
              ? ((row.metadata as Record<string, unknown>).preferred_locale as string)
              : null)

          if (preferredLocale === 'ar' || preferredLocale === 'en') {
            setLanguageChoice(preferredLocale)
            setLocale(preferredLocale)
          }
        }
      } catch (loadError) {
        console.error('[settings] Failed to load settings data', loadError)
        setError('Unable to load settings data.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [organization?.id, getUserRole, getTeamMembers, setLocale])

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
    const result = await addMemberByEmail(organization.id, inviteEmail.trim(), inviteRole)
    if (!result.success) {
      setError(result.error || 'Unable to add member. Ensure the user has already registered.')
    } else {
      setMessage('Member added successfully.')
      setInviteEmail('')
      setInviteRole('member')
      await refreshMembers()
    }
    setSaving(false)
  }

  const handleSavePreferences = async () => {
    setSavingPreferences(true)
    setError(null)
    setMessage(null)

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) {
      setError('Unable to save preferences: no authenticated user.')
      setSavingPreferences(false)
      return
    }

    const updatedAt = new Date().toISOString()
    const payloads: Record<string, unknown>[] = []

    if (hasColumn(profileRecord, 'notification_preferences')) {
      payloads.push({
        notification_preferences: {
          email: notificationEmail,
          inApp: notificationInApp,
          criticalOnly: notificationCriticalOnly,
        },
        ...(hasColumn(profileRecord, 'preferred_locale') ? { preferred_locale: languageChoice } : {}),
        updated_at: updatedAt,
      })
    }

    if (
      hasColumn(profileRecord, 'notifications_email') ||
      hasColumn(profileRecord, 'notifications_inapp') ||
      hasColumn(profileRecord, 'notifications_critical_only')
    ) {
      payloads.push({
        ...(hasColumn(profileRecord, 'notifications_email')
          ? { notifications_email: notificationEmail }
          : {}),
        ...(hasColumn(profileRecord, 'notifications_inapp')
          ? { notifications_inapp: notificationInApp }
          : {}),
        ...(hasColumn(profileRecord, 'notifications_critical_only')
          ? { notifications_critical_only: notificationCriticalOnly }
          : {}),
        ...(hasColumn(profileRecord, 'preferred_locale') ? { preferred_locale: languageChoice } : {}),
        updated_at: updatedAt,
      })
    }

    if (hasColumn(profileRecord, 'metadata')) {
      const metadata =
        typeof profileRecord?.metadata === 'object' && profileRecord?.metadata !== null
          ? (profileRecord.metadata as Record<string, unknown>)
          : {}
      payloads.push({
        metadata: {
          ...metadata,
          preferred_locale: languageChoice,
          notification_preferences: {
            email: notificationEmail,
            inApp: notificationInApp,
            criticalOnly: notificationCriticalOnly,
          },
        },
        ...(hasColumn(profileRecord, 'preferred_locale') ? { preferred_locale: languageChoice } : {}),
        updated_at: updatedAt,
      })
    }

    if (hasColumn(profileRecord, 'preferred_locale')) {
      payloads.push({
        preferred_locale: languageChoice,
        updated_at: updatedAt,
      })
    }

    if (payloads.length === 0) {
      payloads.push({ preferred_locale: languageChoice, updated_at: updatedAt })
    }

    let saved = false
    let lastErrorMessage = 'Unknown error'

    for (const payload of payloads) {
      const { error: saveError } = await supabase.from('profiles').update(payload).eq('id', userId)
      if (!saveError) {
        saved = true
        break
      }
      lastErrorMessage = saveError.message
      if (!isMissingColumnError(saveError.message)) {
        break
      }
    }

    if (!saved) {
      setError(`Unable to save preferences: ${lastErrorMessage}`)
      setSavingPreferences(false)
      return
    }

    setLocale(languageChoice)
    setMessage('Preferences saved successfully.')
    setSavingPreferences(false)
  }

  const handleInviteRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteRequestOrgId) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user?.id || !user.email) {
      setError('You must be authenticated to request an invitation.')
      setSaving(false)
      return
    }

    let reqError: { message: string } | null = null
    const basePayload = {
      requester_user_id: user.id,
      requester_email: user.email,
      requested_role: 'member',
      note: inviteRequestMessage || null,
      status: 'pending',
    }

    const firstAttempt = await supabase.from('organization_invite_requests').insert({
      ...basePayload,
      target_organization_id: inviteRequestOrgId,
    })
    reqError = firstAttempt.error

    if (reqError && isMissingColumnError(reqError.message)) {
      const secondAttempt = await supabase.from('organization_invite_requests').insert({
        ...basePayload,
        organization_id: inviteRequestOrgId,
      })
      reqError = secondAttempt.error
    }

    if (reqError) {
      setError(`Unable to submit invite request: ${reqError.message}`)
    } else {
      setMessage('Invitation request submitted successfully.')
      setInviteRequestOrgId('')
      setInviteRequestMessage('')
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
              className={`h-10 ${SELECT_CLASS}`}
              style={SELECT_STYLE}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value} style={OPTION_STYLE}>
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
                        style={SELECT_STYLE}
                      >
                        {!ROLE_OPTIONS.some((role) => role.value === member.role) && (
                          <option value={member.role} style={OPTION_STYLE}>
                            {String(member.role)}
                          </option>
                        )}
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value} style={OPTION_STYLE}>
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
        <div className="rounded-lg border border-white/10 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Notification Rules</h2>
          </div>
          <label className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Email notifications</span>
            <input
              type="checkbox"
              checked={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.checked)}
              className="h-4 w-4 accent-[#07f880]"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-muted-foreground">
            <span>In-app notifications</span>
            <input
              type="checkbox"
              checked={notificationInApp}
              onChange={(e) => setNotificationInApp(e.target.checked)}
              className="h-4 w-4 accent-[#07f880]"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Critical alerts only</span>
            <input
              type="checkbox"
              checked={notificationCriticalOnly}
              onChange={(e) => setNotificationCriticalOnly(e.target.checked)}
              className="h-4 w-4 accent-[#07f880]"
            />
          </label>
        </div>
        <div className="rounded-lg border border-white/10 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="h-4 w-4 text-[#07f880]" />
            <h2 className="font-semibold text-foreground">Language & Region</h2>
          </div>
          <label className="text-xs uppercase tracking-wide text-white/50">Language</label>
          <select
            value={languageChoice}
            onChange={(e) => setLanguageChoice(e.target.value as Locale)}
            className={`h-10 w-full ${SELECT_CLASS}`}
            style={SELECT_STYLE}
          >
            <option value="en" style={OPTION_STYLE}>
              English
            </option>
            <option value="ar" style={OPTION_STYLE}>
              Arabic
            </option>
          </select>
          <p className="text-xs text-muted-foreground">
            The selected language is applied immediately after saving.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-card p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Request Organization Invitation</h2>
        <p className="text-sm text-muted-foreground">
          If you are not yet part of an organization, submit a request and administrators can approve your access.
        </p>
        <form onSubmit={handleInviteRequest} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
          <select
            value={inviteRequestOrgId}
            onChange={(e) => setInviteRequestOrgId(e.target.value)}
            className={`h-10 ${SELECT_CLASS}`}
            style={SELECT_STYLE}
            required
          >
            <option value="" style={OPTION_STYLE}>
              Select organization
            </option>
            {availableOrganizations.map((org) => (
              <option key={org.id} value={org.id} style={OPTION_STYLE}>
                {org.name} ({org.slug})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={inviteRequestMessage}
            onChange={(e) => setInviteRequestMessage(e.target.value)}
            placeholder="Optional note"
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-white/40 focus:border-[#07f880]/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20 disabled:opacity-50"
          >
            Request Invite
          </button>
        </form>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSavePreferences}
          disabled={savingPreferences}
          className="inline-flex items-center gap-2 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 py-2 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20"
        >
          <Save className="h-4 w-4" />
          {savingPreferences ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
