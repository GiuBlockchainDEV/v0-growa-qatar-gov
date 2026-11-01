import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'
import { writeSecurityAudit } from '@/lib/auth/audit-server'
import { canAcceptInvitation, canResendInvitation, canRevokeInvitation } from '@/lib/invitations/lifecycle'
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  isInvitationExpired,
} from '@/lib/invitations/token'
import { normalizeOrgRole } from '@/lib/auth/role-registry'
import { canGrantMembershipRole } from '@/lib/auth/membership-authorization'

export interface InvitationDelivery {
  sent: boolean
  method: 'supabase_invite' | 'supabase_magiclink' | 'none'
  devInviteUrl?: string
  devMessage?: string
}

export interface OrganizationInvitationRow {
  id: string
  organization_id: string
  email: string
  role: string
  department_scope: string | null
  message: string | null
  status: string
  expires_at: string
  created_at: string
  last_sent_at: string | null
}

function inviteAcceptUrl(token: string, origin: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/auth/invite?token=${encodeURIComponent(token)}`
}

async function findProfileIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data } = await admin.from('profiles').select('id, account_status').eq('email', email).maybeSingle()
  return data as { id: string; account_status?: string } | null
}

async function deliverInvitationEmail(
  email: string,
  token: string,
  origin: string,
  isNewUser: boolean
): Promise<InvitationDelivery> {
  if (!isAdminClientConfigured()) {
    return {
      sent: false,
      method: 'none',
      devInviteUrl: inviteAcceptUrl(token, origin),
      devMessage: 'SUPABASE_SERVICE_ROLE_KEY not set — invitation link shown for development only.',
    }
  }

  const admin = createAdminClient()
  const redirectTo = inviteAcceptUrl(token, origin)

  if (isNewUser) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    })
    if (error) {
      return {
        sent: false,
        method: 'none',
        devInviteUrl: redirectTo,
        devMessage: error.message,
      }
    }
    return { sent: true, method: 'supabase_invite' }
  }

  const { error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (error) {
    return {
      sent: false,
      method: 'none',
      devInviteUrl: redirectTo,
      devMessage: error.message,
    }
  }

  return { sent: true, method: 'supabase_magiclink' }
}

export async function createOrganizationInvitation(input: {
  actorId: string
  actorRole: string
  isPlatformAdmin?: boolean
  organizationId: string
  email: string
  role: string
  departmentScope?: string | null
  message?: string | null
  origin: string
}): Promise<
  | { ok: true; invitation: OrganizationInvitationRow; delivery: InvitationDelivery; token?: string }
  | { ok: false; status: number; error: string }
> {
  const email = input.email.trim().toLowerCase()
  if (!email) {
    return { ok: false, status: 400, error: 'Email is required' }
  }

  const role = normalizeOrgRole(input.role)
  if (
    !canGrantMembershipRole({
      actorUserId: input.actorId,
      actorRole: input.actorRole,
      targetUserId: '00000000-0000-0000-0000-000000000000',
      targetCurrentRole: null,
      proposedRole: role,
      ownerCountInOrg: 1,
      isPlatformAdmin: Boolean(input.isPlatformAdmin),
    })
  ) {
    return { ok: false, status: 403, error: 'Cannot assign this role' }
  }

  if (!isAdminClientConfigured()) {
    return { ok: false, status: 503, error: 'Invitation service is not configured on this server' }
  }

  const admin = createAdminClient()
  const { token, tokenHash } = generateInvitationToken()
  const expiresAt = invitationExpiresAt(7)
  const now = new Date().toISOString()

  const existingProfile = await findProfileIdByEmail(admin, email)
  let membershipId: string | null = null

  if (existingProfile?.id) {
    const { data: memberRow, error: memberError } = await admin
      .from('user_organization_members')
      .upsert(
        {
          user_id: existingProfile.id,
          organization_id: input.organizationId,
          role,
          status: 'invited',
          invited_at: now,
        },
        { onConflict: 'user_id,organization_id' }
      )
      .select('id')
      .single()

    if (memberError && memberError.code !== '23505') {
      return { ok: false, status: 500, error: memberError.message }
    }

    if (memberRow?.id) {
      membershipId = memberRow.id
    } else {
      const { data: existingMember } = await admin
        .from('user_organization_members')
        .select('id, status')
        .eq('user_id', existingProfile.id)
        .eq('organization_id', input.organizationId)
        .maybeSingle()
      if (existingMember?.status === 'active') {
        return { ok: false, status: 409, error: 'User is already an active member of this organization' }
      }
      membershipId = existingMember?.id ?? null
      if (existingMember?.id) {
        await admin
          .from('user_organization_members')
          .update({ status: 'invited', role, invited_at: now })
          .eq('id', existingMember.id)
      }
    }
  }

  await admin
    .from('organization_invitations')
    .update({ status: 'revoked', revoked_at: now })
    .eq('organization_id', input.organizationId)
    .eq('email', email)
    .eq('status', 'pending')

  const { data: invitation, error: insertError } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: input.organizationId,
      email,
      role,
      department_scope: input.departmentScope ?? null,
      message: input.message ?? null,
      status: 'pending',
      token_hash: tokenHash,
      invited_by: input.actorId,
      membership_id: membershipId,
      expires_at: expiresAt,
      last_sent_at: now,
    })
    .select('*')
    .single()

  if (insertError || !invitation) {
    return { ok: false, status: 500, error: insertError?.message ?? 'Failed to create invitation' }
  }

  const delivery = await deliverInvitationEmail(email, token, input.origin, !existingProfile?.id)

  await writeSecurityAudit({
    actorId: input.actorId,
    organizationId: input.organizationId,
    action: 'invitation_sent',
    resourceType: 'organization_invitation',
    resourceId: invitation.id,
    metadata: { email, role, deliveryMethod: delivery.method, emailSent: delivery.sent },
  })

  const row = invitation as OrganizationInvitationRow
  return {
    ok: true,
    invitation: row,
    delivery,
    token: delivery.devInviteUrl ? token : undefined,
  }
}

export async function resendOrganizationInvitation(input: {
  actorId: string
  organizationId: string
  invitationId: string
  origin: string
}): Promise<
  | { ok: true; delivery: InvitationDelivery; token?: string }
  | { ok: false; status: number; error: string }
> {
  if (!isAdminClientConfigured()) {
    return { ok: false, status: 503, error: 'Invitation service is not configured' }
  }

  const admin = createAdminClient()
  const { data: invitation, error } = await admin
    .from('organization_invitations')
    .select('*')
    .eq('id', input.invitationId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error || !invitation) {
    return { ok: false, status: 404, error: 'Invitation not found' }
  }

  const status = invitation.status as string
  if (!canResendInvitation(status as 'pending' | 'accepted' | 'expired' | 'revoked')) {
    return { ok: false, status: 400, error: 'Invitation cannot be resent' }
  }

  const { token, tokenHash } = generateInvitationToken()
  const now = new Date().toISOString()
  const expiresAt = invitationExpiresAt(7)

  await admin
    .from('organization_invitations')
    .update({
      token_hash: tokenHash,
      status: 'pending',
      expires_at: expiresAt,
      last_sent_at: now,
      revoked_at: null,
    })
    .eq('id', invitation.id)

  const profile = await findProfileIdByEmail(admin, invitation.email)
  const delivery = await deliverInvitationEmail(
    invitation.email,
    token,
    input.origin,
    !profile?.id
  )

  await writeSecurityAudit({
    actorId: input.actorId,
    organizationId: input.organizationId,
    action: 'invitation_resent',
    resourceType: 'organization_invitation',
    resourceId: invitation.id,
    metadata: { emailSent: delivery.sent },
  })

  return { ok: true, delivery, token: delivery.devInviteUrl ? token : undefined }
}

export async function revokeOrganizationInvitation(input: {
  actorId: string
  organizationId: string
  invitationId: string
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isAdminClientConfigured()) {
    return { ok: false, status: 503, error: 'Invitation service is not configured' }
  }

  const admin = createAdminClient()
  const { data: invitation } = await admin
    .from('organization_invitations')
    .select('id, status, membership_id')
    .eq('id', input.invitationId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!invitation) {
    return { ok: false, status: 404, error: 'Invitation not found' }
  }

  if (!canRevokeInvitation(invitation.status as 'pending' | 'accepted' | 'expired' | 'revoked')) {
    return { ok: false, status: 400, error: 'Invitation cannot be revoked' }
  }

  const now = new Date().toISOString()
  await admin
    .from('organization_invitations')
    .update({ status: 'revoked', revoked_at: now })
    .eq('id', invitation.id)

  if (invitation.membership_id) {
    await admin
      .from('user_organization_members')
      .update({ status: 'inactive' })
      .eq('id', invitation.membership_id)
  }

  await writeSecurityAudit({
    actorId: input.actorId,
    organizationId: input.organizationId,
    action: 'invitation_revoked',
    resourceType: 'organization_invitation',
    resourceId: invitation.id,
  })

  return { ok: true }
}

export async function lookupInvitationByToken(token: string): Promise<
  | {
      ok: true
      invitation: OrganizationInvitationRow & {
        organization_name: string
        expired: boolean
        canAccept: boolean
      }
    }
  | { ok: false; error: string }
> {
  if (!token?.trim()) {
    return { ok: false, error: 'Invalid invitation' }
  }

  if (!isAdminClientConfigured()) {
    return { ok: false, error: 'Invitation service unavailable' }
  }

  const admin = createAdminClient()
  const tokenHash = hashInvitationToken(token.trim())
  const { data: invitation } = await admin
    .from('organization_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!invitation) {
    return { ok: false, error: 'Invalid or expired invitation' }
  }

  const expired = isInvitationExpired(invitation.expires_at)
  const status = invitation.status as 'pending' | 'accepted' | 'expired' | 'revoked'

  if (expired && status === 'pending') {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invitation.id)
  }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('name')
    .eq('id', invitation.organization_id)
    .maybeSingle()

  return {
    ok: true,
    invitation: {
      ...(invitation as OrganizationInvitationRow),
      organization_name: (orgRow?.name as string | undefined) ?? 'Organization',
      expired: expired || status === 'expired',
      canAccept: canAcceptInvitation(status, expired),
    },
  }
}

export async function acceptOrganizationInvitation(input: {
  token: string
  userId: string
  userEmail: string
}): Promise<{ ok: true; organizationId: string } | { ok: false; status: number; error: string }> {
  const lookup = await lookupInvitationByToken(input.token)
  if (!lookup.ok) {
    return { ok: false, status: 400, error: lookup.error }
  }

  const inv = lookup.invitation
  if (!inv.canAccept) {
    return { ok: false, status: 400, error: 'Invitation is no longer valid' }
  }

  if (input.userEmail.trim().toLowerCase() !== inv.email) {
    return { ok: false, status: 403, error: 'Sign in with the email address that received this invitation' }
  }

  if (!isAdminClientConfigured()) {
    return { ok: false, status: 503, error: 'Invitation service unavailable' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('user_organization_members')
    .upsert(
      {
        user_id: input.userId,
        organization_id: inv.organization_id,
        role: inv.role,
        status: 'active',
        joined_at: now,
        invited_at: inv.created_at,
      },
      { onConflict: 'user_id,organization_id' }
    )

  await admin
    .from('organization_invitations')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_by: input.userId,
    })
    .eq('id', inv.id)

  await admin
    .from('profiles')
    .update({
      account_status: 'active',
      department_scope: inv.department_scope ?? null,
    })
    .eq('id', input.userId)

  await writeSecurityAudit({
    actorId: input.userId,
    organizationId: inv.organization_id,
    action: 'invitation_accepted',
    resourceType: 'organization_invitation',
    resourceId: inv.id,
  })

  return { ok: true, organizationId: inv.organization_id }
}
