'use client'

/* Settings page state and actions; the tabs in settings-tabs.tsx render from it. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n, type Locale } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/hooks/use-organization'
import { usePermissions } from '@/hooks/use-permissions'
import { useTeamManagement, type TeamMember } from '@/hooks/use-team-management'
import { useConfirm } from '@/components/brand/feedback'
import { useAuth } from '@/hooks/use-auth'
import { humanize } from '@/components/brand/status'
import { SETTINGS_TABS, type AssignableRole, type OrganizationType, type SettingsTab } from './settings-model'

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

export function useSettings() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  /* Three tabs, addressable from the URL: the user menu's "Profile" and
     "Settings" used to open the same page at the same place. */
  const requestedTab = searchParams.get('tab')
  const tab: SettingsTab = SETTINGS_TABS.includes(requestedTab as SettingsTab) ? (requestedTab as SettingsTab) : 'profile'
  const setTab = useCallback(
    (next: SettingsTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const confirmDialog = useConfirm()
  const supabase = createClient()
  const { locale, setLocale, tr } = useI18n()
  const { organization } = useOrganization()
  const { getUserRole } = usePermissions()
  const { getTeamMembers, addMemberByEmail, updateMemberRole, removeMember } = useTeamManagement()

  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
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
      const rows = (firstAttempt.data || []).map((row: Record<string, any>) => ({
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
      const rows = (secondAttempt.data || []).map((row: Record<string, any>) => ({
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

    const farms = (data || []).map((row: Record<string, any>) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name_en || row.name || row.code || row.id,
    }))
    setAvailableFarms(farms)
  }

  const loadSentInviteRequests = async (userId: string) => {
    const mapRows = (rows: any[], organizationKey: 'target_organization_id' | 'organization_id') =>
      rows.map((row: Record<string, any>) => ({
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
          const full = typeof row.full_name === 'string' ? row.full_name.trim() : ''
          const [fullFirst = '', ...fullRest] = full ? full.split(/\s+/) : []
          setFirstName(typeof row.first_name === 'string' && row.first_name ? row.first_name : fullFirst)
          setLastName(typeof row.last_name === 'string' && row.last_name ? row.last_name : fullRest.join(' '))
        }

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
        setError(tr('Unable to load settings data.'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [organization?.id, getUserRole, getTeamMembers, setLocale])

  const canManageUsers = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'super_admin'

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
      setError(result.error || tr('Unable to add member. Ensure the user has already registered.'))
    } else {
      setMessage(tr('Member added successfully.'))
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
      setError(tr('Unable to save preferences: no authenticated user.'))
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
        setError(tr('Unable to save preferences: {error}', { error: profileSeedError.message }))
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
        return { ok: false, missingColumn: false, message: tr('Profile row not found for current user.') }
      }
      setProfileRecord((prev) => ({ ...(prev || {}), ...payload }))
      return { ok: true, missingColumn: false, message: '' }
    }

    let preferencesSaved = false
    let localeSaved = false
    let lastErrorMessage = tr('Unknown error')

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
      setError(tr('Unable to save preferences: {error}', { error: lastErrorMessage }))
      setSavingPreferences(false)
      return
    }

    setLocale(languageChoice)
    setMessage(
      preferencesSaved
        ? tr('Preferences saved successfully.')
        : tr('Language saved successfully. Notification columns are not available in profile schema.')
    )
    setSavingPreferences(false)
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCreatingOrganization) return

    const normalizedName = createOrgName.trim()
    const normalizedSlug = createOrgSlug.trim().toLowerCase().replace(/\s+/g, '-')
    if (!normalizedName || !normalizedSlug) {
      setError(tr('Organisation name and short address are required.'))
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
      setError(tr('Unable to create organisation: {error}', { error: createError.message }))
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
        ? tr('Organisation created successfully. You are now owner of the new organisation.')
        : tr('Organisation created successfully. You are now owner.')
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
        setError(tr('You must be authenticated to request an invitation.'))
        return
      }

      if (hasPendingInviteRequest) {
        setError(tr('You can only keep one pending invitation request at a time.'))
        await loadSentInviteRequests(user.id)
        return
      }

      if (inviteRequiresFarmSelection && !inviteRequestFarmId) {
        setError(tr('For farm company organisations you must select the target farm.'))
        return
      }

      const pendingCheck = await supabase
        .from('organization_invite_requests')
        .select('id')
        .eq('requester_user_id', user.id)
        .ilike('status', 'pending')
        .limit(1)

      if (pendingCheck.error) {
        setError(tr('Unable to verify existing pending requests: {error}', { error: pendingCheck.error.message }))
        return
      }

      if ((pendingCheck.data?.length || 0) > 0) {
        setError(tr('You already have a pending request. Delete it before creating a new one.'))
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
          setError(tr('You can only keep one pending invitation request at a time.'))
          await loadSentInviteRequests(user.id)
        } else if (
          normalizedMessage.includes('requested_farm_id') &&
          normalizedMessage.includes('column')
        ) {
          setError(tr('Farm-level association requests require the latest database migration.'))
        } else {
          setError(tr('Unable to submit invite request: {error}', { error: reqError.message }))
        }
      } else {
        setMessage(tr('Invitation request submitted successfully.'))
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
    if (!(await confirmDialog(tr('Delete this invite request?')))) return

    setIsDeletingRequest(true)
    setError(null)
    setMessage(null)

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) {
      setError(tr('You must be authenticated to delete invite requests.'))
      setIsDeletingRequest(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('organization_invite_requests')
      .delete()
      .eq('id', requestId)
      .eq('requester_user_id', userId)

    if (deleteError) {
      setError(tr('Unable to delete invite request: {error}', { error: deleteError.message }))
      setIsDeletingRequest(false)
      return
    }

    setMessage(tr('Invite request deleted.'))
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
      setError(tr('Unable to update role.'))
    } else {
      setError(null)
      await refreshMembers()
    }
    setSaving(false)
  }

  const handleRemove = async (memberId: string) => {
    if (!organization?.id) return
    if (!(await confirmDialog(tr('Remove this member from the organisation?')))) return
    setSaving(true)
    const ok = await removeMember(organization.id, memberId)
    if (!ok) {
      setError(tr('Unable to remove member.'))
    } else {
      setError(null)
      await refreshMembers()
    }
    setSaving(false)
  }

  /* Profile names: first/last where the schema has them, full_name otherwise. */
  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return
    setSavingProfile(true)
    setError(null)
    setMessage(null)
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    const candidates: Record<string, unknown>[] = [
      { first_name: firstName.trim() || null, last_name: lastName.trim() || null, full_name: fullName || null },
      { first_name: firstName.trim() || null, last_name: lastName.trim() || null },
      { full_name: fullName || null },
    ]
    let saved = false
    let lastMessage = ''
    for (const payload of candidates) {
      const { error: updateError } = await supabase.from('profiles').upsert({ id: user.id, ...payload }, { onConflict: 'id' })
      if (!updateError) {
        saved = true
        setProfileRecord((prev) => ({ ...(prev || {}), ...payload }))
        break
      }
      lastMessage = updateError.message
      if (!isMissingColumnError(updateError.message)) break
    }
    if (saved) setMessage(tr('Profile saved.'))
    else setError(tr('Unable to save the profile: {error}', { error: lastMessage }))
    setSavingProfile(false)
  }

  /* The language is chosen only here now (it left the header): it applies at
     once and is stored on the profile in the background. */
  const handleLanguageChange = async (next: Locale) => {
    setLanguageChoice(next)
    setLocale(next)
    if (!user?.id) return
    for (const payload of [{ locale: next }, { preferred_locale: next }]) {
      const { error: updateError } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (!updateError || !isMissingColumnError(updateError.message)) break
    }
  }

  const roleLabel = (value: string) =>
    ({
      owner: tr('Owner'),
      admin: tr('Admin'),
      member: tr('Member'),
    })[value] ?? humanize(value)
  const orgTypeLabel = (value: string | null | undefined) =>
    value
      ? ({
          private: tr('Private'),
          public: tr('Public'),
          farm_company: tr('Farm company'),
          government: tr('Government'),
          government_master: tr('Government master'),
        } as Record<string, string>)[value] ?? humanize(value)
      : tr('Unknown')
  const dateLocale = locale === 'ar' ? 'ar-QA' : 'en-GB'
  const initials =
    [firstName, lastName].filter(Boolean).map((part) => part.trim()[0]?.toUpperCase()).join('') ||
    (user?.email?.[0]?.toUpperCase() ?? '·')

  return {
    tab,
    addMemberByEmail,
    availableFarms,
    availableOrganizations,
    canManageUsers,
    confirmDialog,
    createOrgDescription,
    createOrgName,
    createOrgSlug,
    createOrgType,
    currentRole,
    dateLocale,
    error,
    farmNameById,
    firstName,
    getTeamMembers,
    getUserRole,
    handleCreateOrganization,
    handleDeleteInviteRequest,
    handleInvite,
    handleInviteRequest,
    handleLanguageChange,
    handleRemove,
    handleRoleChange,
    handleSavePreferences,
    handleSaveProfile,
    hasPendingInviteRequest,
    initials,
    inviteEmail,
    inviteRequestFarmId,
    inviteRequestInFlightRef,
    inviteRequestMessage,
    inviteRequestOrgId,
    inviteRequiresFarmSelection,
    inviteRole,
    isCreatingOrganization,
    isDeletingRequest,
    languageChoice,
    lastName,
    loadFarmsForOrganization,
    loadOrganizationOptions,
    loadSentInviteRequests,
    loading,
    locale,
    members,
    message,
    notificationCriticalOnly,
    notificationEmail,
    notificationInApp,
    orgTypeLabel,
    organization,
    organizationNameById,
    pathname,
    profileRecord,
    refreshMembers,
    removeMember,
    requestedTab,
    roleLabel,
    router,
    saving,
    savingPreferences,
    savingProfile,
    searchParams,
    selectedInviteOrganization,
    sentInviteRequests,
    setAvailableFarms,
    setAvailableOrganizations,
    setCreateOrgDescription,
    setCreateOrgName,
    setCreateOrgSlug,
    setCreateOrgType,
    setCurrentRole,
    setError,
    setFirstName,
    setInviteEmail,
    setInviteRequestFarmId,
    setInviteRequestMessage,
    setInviteRequestOrgId,
    setInviteRole,
    setIsCreatingOrganization,
    setIsDeletingRequest,
    setLanguageChoice,
    setLastName,
    setLoading,
    setLocale,
    setMembers,
    setMessage,
    setNotificationCriticalOnly,
    setNotificationEmail,
    setNotificationInApp,
    setProfileRecord,
    setSaving,
    setSavingPreferences,
    setSavingProfile,
    setSentInviteRequests,
    setTab,
    supabase,
    tr,
    updateMemberRole,
    user,
  }
}

export type SettingsState = ReturnType<typeof useSettings>
