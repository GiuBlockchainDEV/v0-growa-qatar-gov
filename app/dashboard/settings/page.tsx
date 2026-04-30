'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
type OrganizationType = 'government_master' | 'government' | 'farm_company' | 'public' | 'private'
type OrgOption = { id: string; name: string; slug: string; organizationType: OrganizationType | null }
type FarmOption = { id: string; organizationId: string; name: string }
type ProfileRecord = Record<string, unknown>
type InviteRequest = {
  id: string
  organizationId: string
  requestedFarmId: string | null
  requestedRole: string
  status: string
  createdAt: string
  note: string | null
}

const ORGANIZATION_TYPE_OPTIONS: Array<{ value: OrganizationType; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'farm_company', label: 'Farm Company' },
  { value: 'government', label: 'Government' },
  { value: 'government_master', label: 'Government Master' },
]

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
  const [availableFarms, setAvailableFarms] = useState<FarmOption[]>([])
  const [sentInviteRequests, setSentInviteRequests] = useState<InviteRequest[]>([])
  const [inviteRequestOrgId, setInviteRequestOrgId] = useState('')
  const [inviteRequestFarmId, setInviteRequestFarmId] = useState('')
  const [inviteRequestMessage, setInviteRequestMessage] = useState('')
  const [createOrgName, setCreateOrgName] = useState('')
  const [createOrgSlug, setCreateOrgSlug] = useState('')
  const [createOrgDescription, setCreateOrgDescription] = useState('')
  const [createOrgType, setCreateOrgType] = useState<OrganizationType>('private')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDeletingRequest, setIsDeletingRequest] = useState(false)
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)
  const inviteRequestInFlightRef = useRef(false)

  const loadOrganizationOptions = async () => {
    const firstAttempt = await supabase
      .from('organizations')
      .select('id, name, slug, organization_type')
      .order('name', { ascending: true })

    if (!firstAttempt.error) {
      const rows = (firstAttempt.data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        organizationType: (row.organization_type || null) as OrganizationType | null,
      }))
      setAvailableOrganizations(rows)
      return rows
    }

    if (!isMissingColumnError(firstAttempt.error.message)) {
      console.error('[settings] Unable to load organizations', firstAttempt.error)
      setAvailableOrganizations([])
      return []
    }

    const secondAttempt = await supabase
      .from('organizations')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (!secondAttempt.error) {
      const rows = (secondAttempt.data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        organizationType: null,
      }))
      setAvailableOrganizations(rows)
      return rows
    }

    console.error('[settings] Unable to load organizations', secondAttempt.error)
    setAvailableOrganizations([])
    return []
  }

  const loadFarmsForOrganization = async (organizationId: string) => {
    const { data, error: farmsError } = await supabase
      .from('farms')
      .select('*')
      .eq('organization_id', organizationId)

    if (farmsError) {
      console.error('[settings] Unable to load farms for organization', farmsError)
      setAvailableFarms([])
      return
    }

    const farms = (data || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name_en || row.name || row.code || row.id,
    }))
    setAvailableFarms(farms)
  }

  const loadSentInviteRequests = async (userId: string) => {
    const mapRows = (rows: any[], organizationKey: 'target_organization_id' | 'organization_id') =>
      rows.map((row: any) => ({
        id: row.id,
        organizationId: row[organizationKey],
        requestedFarmId: row.requested_farm_id || null,
        requestedRole: row.requested_role,
        status: String(row.status || '').toLowerCase(),
        createdAt: row.created_at,
        note: row.note ?? null,
      }))

    const attempts: Array<{
      select: string
      organizationKey: 'target_organization_id' | 'organization_id'
    }> = [
      {
        select: 'id, target_organization_id, requested_farm_id, requested_role, status, created_at, note',
        organizationKey: 'target_organization_id',
      },
      {
        select: 'id, target_organization_id, requested_role, status, created_at, note',
        organizationKey: 'target_organization_id',
      },
      {
        select: 'id, organization_id, requested_farm_id, requested_role, status, created_at, note',
        organizationKey: 'organization_id',
      },
      {
        select: 'id, organization_id, requested_role, status, created_at, note',
        organizationKey: 'organization_id',
      },
    ]

    for (const attempt of attempts) {
      const result = await supabase
        .from('organization_invite_requests')
        .select(attempt.select)
        .eq('requester_user_id', userId)
        .order('created_at', { ascending: false })

      if (!result.error) {
        setSentInviteRequests(mapRows(result.data || [], attempt.organizationKey))
        return
      }

      if (!isMissingColumnError(result.error.message)) {
        console.error('[settings] Unable to load invite requests', result.error)
        setSentInviteRequests([])
        return
      }
    }

    setSentInviteRequests([])
  }

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

        const [role, team, profileData] = await Promise.all([
          rolePromise,
          teamPromise,
          profilePromise,
        ])

        setCurrentRole(role)
        setMembers(team)
        await loadOrganizationOptions()

        const row = (profileData.data as ProfileRecord | null) || null
        setProfileRecord(row)

        if (row) {
          const rowPrefs =
            typeof row.notification_preferences === 'object' && row.notification_preferences !== null
              ? (row.notification_preferences as Record<string, unknown>)
              : null

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
            (typeof row.locale === 'string' ? row.locale : null)

          if (preferredLocale === 'ar' || preferredLocale === 'en') {
            setLanguageChoice(preferredLocale)
            setLocale(preferredLocale)
          }
        }

        if (userId) {
          await loadSentInviteRequests(userId)
        } else {
          setSentInviteRequests([])
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
    const userEmail = authData.user?.email || null
    if (!userId) {
      setError('Unable to save preferences: no authenticated user.')
      setSavingPreferences(false)
      return
    }

    let workingProfileRecord = profileRecord
    if (!workingProfileRecord) {
      const profileSeed: Record<string, unknown> = { id: userId }
      if (userEmail) profileSeed.email = userEmail
      const { error: profileSeedError } = await supabase
        .from('profiles')
        .upsert(profileSeed, { onConflict: 'id' })
      if (profileSeedError && !isMissingColumnError(profileSeedError.message)) {
        setError(`Unable to save preferences: ${profileSeedError.message}`)
        setSavingPreferences(false)
        return
      }
      const { data: reloadedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      workingProfileRecord = (reloadedProfile as ProfileRecord | null) || null
      setProfileRecord(workingProfileRecord)
    }

    const updatedAt = new Date().toISOString()
    const withUpdatedAt = hasColumn(workingProfileRecord, 'updated_at') ? { updated_at: updatedAt } : {}
    const preferencePayloadCandidates: Record<string, unknown>[] = [
      {
        notification_preferences: {
          email: notificationEmail,
          inApp: notificationInApp,
          criticalOnly: notificationCriticalOnly,
        },
        ...withUpdatedAt,
      },
      {
        notifications_email: notificationEmail,
        notifications_inapp: notificationInApp,
        notifications_critical_only: notificationCriticalOnly,
        ...withUpdatedAt,
      },
    ]
    const localePayloadCandidates: Record<string, unknown>[] = [
      { locale: languageChoice, ...withUpdatedAt },
      { preferred_locale: languageChoice, ...withUpdatedAt },
    ]

    const tryPayload = async (payload: Record<string, unknown>) => {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('id')
      if (updateError) {
        return { ok: false, missingColumn: isMissingColumnError(updateError.message), message: updateError.message }
      }
      if (!data || data.length === 0) {
        return { ok: false, missingColumn: false, message: 'Profile row not found for current user.' }
      }
      setProfileRecord((prev) => ({ ...(prev || {}), ...payload }))
      return { ok: true, missingColumn: false, message: '' }
    }

    let preferencesSaved = false
    let localeSaved = false
    let lastErrorMessage = 'Unknown error'

    for (const payload of preferencePayloadCandidates) {
      const result = await tryPayload(payload)
      if (result.ok) {
        preferencesSaved = true
        break
      }
      lastErrorMessage = result.message
      if (!result.missingColumn) {
        break
      }
    }

    for (const payload of localePayloadCandidates) {
      const result = await tryPayload(payload)
      if (result.ok) {
        localeSaved = true
        break
      }
      lastErrorMessage = result.message
      if (!result.missingColumn) {
        break
      }
    }

    if (!preferencesSaved && !localeSaved) {
      setError(`Unable to save preferences: ${lastErrorMessage}`)
      setSavingPreferences(false)
      return
    }

    setLocale(languageChoice)
    setMessage(
      preferencesSaved
        ? 'Preferences saved successfully.'
        : 'Language saved successfully. Notification columns are not available in profile schema.'
    )
    setSavingPreferences(false)
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCreatingOrganization) return

    const normalizedName = createOrgName.trim()
    const normalizedSlug = createOrgSlug.trim().toLowerCase().replace(/\s+/g, '-')
    if (!normalizedName || !normalizedSlug) {
      setError('Organization name and slug are required.')
      return
    }

    setIsCreatingOrganization(true)
    setError(null)
    setMessage(null)

    const { data, error: createError } = await supabase.rpc('create_organization_with_owner', {
      org_name: normalizedName,
      org_slug: normalizedSlug,
      org_description: createOrgDescription.trim() || null,
      org_type: createOrgType,
    })

    if (createError) {
      setError(`Unable to create organization: ${createError.message}`)
      setIsCreatingOrganization(false)
      return
    }

    await loadOrganizationOptions()
    setCreateOrgName('')
    setCreateOrgSlug('')
    setCreateOrgDescription('')
    setCreateOrgType('private')

    const createdId =
      Array.isArray(data) && data.length > 0
        ? data[0]?.organization_id || data[0]?.id || null
        : (data as { organization_id?: string } | null)?.organization_id || null

    setMessage(
      createdId
        ? 'Organization created successfully. You are now owner of the new organization.'
        : 'Organization created successfully. You are now owner.'
    )
    setIsCreatingOrganization(false)
  }

  const handleInviteRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteRequestOrgId || saving || inviteRequestInFlightRef.current) return

    inviteRequestInFlightRef.current = true
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user?.id || !user.email) {
        setError('You must be authenticated to request an invitation.')
        return
      }

      if (hasPendingInviteRequest) {
        setError('You can only keep one pending invitation request at a time.')
        await loadSentInviteRequests(user.id)
        return
      }

      if (inviteRequiresFarmSelection && !inviteRequestFarmId) {
        setError('For farm company organizations you must select the target farm.')
        return
      }

      const pendingCheck = await supabase
        .from('organization_invite_requests')
        .select('id')
        .eq('requester_user_id', user.id)
        .ilike('status', 'pending')
        .limit(1)

      if (pendingCheck.error) {
        setError(`Unable to verify existing pending requests: ${pendingCheck.error.message}`)
        return
      }

      if ((pendingCheck.data?.length || 0) > 0) {
        setError('You already have a pending request. Delete it before creating a new one.')
        await loadSentInviteRequests(user.id)
        return
      }

      let reqError: { message: string } | null = null
      const basePayload = {
        requester_user_id: user.id,
        requester_email: user.email,
        requested_role: 'member',
        ...(inviteRequestFarmId ? { requested_farm_id: inviteRequestFarmId } : {}),
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
        const normalizedMessage = reqError.message.toLowerCase()
        if (
          normalizedMessage.includes('one pending') ||
          normalizedMessage.includes('duplicate key') ||
          normalizedMessage.includes('already exists')
        ) {
          setError('You can only keep one pending invitation request at a time.')
          await loadSentInviteRequests(user.id)
        } else if (
          normalizedMessage.includes('requested_farm_id') &&
          normalizedMessage.includes('column')
        ) {
          setError('Farm-level association requests require the latest database migration.')
        } else {
          setError(`Unable to submit invite request: ${reqError.message}`)
        }
      } else {
        setMessage('Invitation request submitted successfully.')
        setInviteRequestOrgId('')
        setInviteRequestFarmId('')
        setInviteRequestMessage('')
        await loadSentInviteRequests(user.id)
      }
    } finally {
      setSaving(false)
      inviteRequestInFlightRef.current = false
    }
  }

  const handleDeleteInviteRequest = async (requestId: string) => {
    if (!confirm('Delete this invite request?')) return

    setIsDeletingRequest(true)
    setError(null)
    setMessage(null)

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) {
      setError('You must be authenticated to delete invite requests.')
      setIsDeletingRequest(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('organization_invite_requests')
      .delete()
      .eq('id', requestId)
      .eq('requester_user_id', userId)

    if (deleteError) {
      setError(`Unable to delete invite request: ${deleteError.message}`)
      setIsDeletingRequest(false)
      return
    }

    setMessage('Invite request deleted.')
    await loadSentInviteRequests(userId)
    setIsDeletingRequest(false)
  }

  const organizationNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const org of availableOrganizations) {
      map.set(org.id, org.name)
    }
    return map
  }, [availableOrganizations])
  const farmNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const farm of availableFarms) {
      map.set(farm.id, farm.name)
    }
    return map
  }, [availableFarms])
  const selectedInviteOrganization = useMemo(
    () => availableOrganizations.find((org) => org.id === inviteRequestOrgId) || null,
    [availableOrganizations, inviteRequestOrgId]
  )
  const inviteRequiresFarmSelection = selectedInviteOrganization?.organizationType === 'farm_company'
  const hasPendingInviteRequest = useMemo(
    () =>
      sentInviteRequests.some((request) => String(request.status).toLowerCase().trim() === 'pending'),
    [sentInviteRequests]
  )

  useEffect(() => {
    if (!inviteRequiresFarmSelection || !inviteRequestOrgId) {
      setAvailableFarms([])
      setInviteRequestFarmId('')
      return
    }

    loadFarmsForOrganization(inviteRequestOrgId)
  }, [inviteRequiresFarmSelection, inviteRequestOrgId])

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
        <h2 className="font-semibold text-foreground">Create Organization</h2>
        <p className="text-sm text-muted-foreground">
          Create a new organization and automatically become its owner.
        </p>
        <form onSubmit={handleCreateOrganization} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            value={createOrgName}
            onChange={(e) => setCreateOrgName(e.target.value)}
            placeholder="Organization name"
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-white/40 focus:border-[#07f880]/40 focus:outline-none"
            required
          />
          <input
            type="text"
            value={createOrgSlug}
            onChange={(e) => setCreateOrgSlug(e.target.value)}
            placeholder="organization-slug"
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-white/40 focus:border-[#07f880]/40 focus:outline-none"
            required
          />
          <select
            value={createOrgType}
            onChange={(e) => setCreateOrgType(e.target.value as OrganizationType)}
            className={`h-10 ${SELECT_CLASS}`}
            style={SELECT_STYLE}
          >
            {ORGANIZATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} style={OPTION_STYLE}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={createOrgDescription}
            onChange={(e) => setCreateOrgDescription(e.target.value)}
            placeholder="Optional description"
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder-white/40 focus:border-[#07f880]/40 focus:outline-none"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isCreatingOrganization}
              className="h-10 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20 disabled:opacity-50"
            >
              {isCreatingOrganization ? 'Creating...' : 'Create Organization & Become Owner'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-white/10 bg-card p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Request Organization Invitation</h2>
        <p className="text-sm text-muted-foreground">
          If you are not yet part of an organization, submit a request and administrators can approve your access.
        </p>
        <form onSubmit={handleInviteRequest} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
            <select
              value={inviteRequestOrgId}
              onChange={(e) => {
                setInviteRequestOrgId(e.target.value)
                setInviteRequestFarmId('')
              }}
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
              disabled={saving || hasPendingInviteRequest || (inviteRequiresFarmSelection && !inviteRequestFarmId)}
              className="h-10 rounded-lg border border-[#07f880]/30 bg-[#07f880]/10 px-4 text-sm font-medium text-[#07f880] hover:bg-[#07f880]/20 disabled:opacity-50"
            >
              {hasPendingInviteRequest ? 'Pending Request Exists' : 'Request Invite'}
            </button>
          </div>

          {inviteRequiresFarmSelection && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr] gap-2">
              <select
                value={inviteRequestFarmId}
                onChange={(e) => setInviteRequestFarmId(e.target.value)}
                className={`h-10 ${SELECT_CLASS}`}
                style={SELECT_STYLE}
                required
              >
                <option value="" style={OPTION_STYLE}>
                  Select farm (required for farm company)
                </option>
                {availableFarms.map((farm) => (
                  <option key={farm.id} value={farm.id} style={OPTION_STYLE}>
                    {farm.name}
                  </option>
                ))}
              </select>
              {availableFarms.length === 0 && (
                <p className="text-xs text-amber-300">
                  No farms found for this farm company. Association request requires a farm selection.
                </p>
              )}
            </div>
          )}

          {!inviteRequiresFarmSelection && selectedInviteOrganization && (
            <p className="text-xs text-white/60">
              Selected organization type:{' '}
              <span className="text-white/80">{selectedInviteOrganization.organizationType || 'unknown'}</span>
            </p>
          )}
        </form>
        {hasPendingInviteRequest && (
          <p className="text-xs text-amber-300">
            You can only keep one pending invitation request at a time.
          </p>
        )}

        <div className="rounded-lg border border-white/10 overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">
                  Organization
                </th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">Role</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">Farm</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">Status</th>
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wide text-white/50">Created</th>
                <th className="text-right px-3 py-2 text-xs uppercase tracking-wide text-white/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sentInviteRequests.map((request) => (
                <tr key={request.id} className="border-b border-white/5">
                  <td className="px-3 py-2 text-foreground">
                    {organizationNameById.get(request.organizationId) || request.organizationId}
                  </td>
                  <td className="px-3 py-2 text-white/80 capitalize">{request.requestedRole}</td>
                  <td className="px-3 py-2 text-white/70">
                    {request.requestedFarmId ? farmNameById.get(request.requestedFarmId) || request.requestedFarmId : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${
                        request.status === 'approved'
                          ? 'bg-[#07f880]/15 text-[#07f880]'
                          : request.status === 'rejected'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-white/60">
                    {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteInviteRequest(request.id)}
                      disabled={isDeletingRequest}
                      className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sentInviteRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No invitation requests sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
