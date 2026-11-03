/**
 * Authorization for a global, public-source intelligence feed.
 *
 * The feed is not an organization ledger. The caller never selects an
 * organization; it must, however, have an ACTIVE canonical or legacy
 * membership that grants intelligence.view, or platform super-admin status.
 * Never grant access based solely on the role-preview or a missing membership.
 */
import {isActiveMembershipStatus} from '@/lib/auth/membership-status'
import {permissionsForOrgRole} from '@/lib/auth/role-registry'
import type {SessionContextPayload} from '@/lib/auth/authorization-service'

export function canViewGlobalMaritimeRadar(
  context:Pick<SessionContextPayload,'memberships'|'authorization'>,
):boolean{
  if(context.authorization.platformStaffTier==='super_admin')return true
  return context.memberships.some(member=>
    isActiveMembershipStatus(member.status)&&
    permissionsForOrgRole(member.role).has('intelligence.view'))
}
