import { isOrgOwnerRole, membershipRoleRank } from '@/lib/auth/role-ranks'

export interface MembershipChangeContext {
  actorUserId: string
  actorRole: string | null
  targetUserId: string
  targetCurrentRole: string | null
  proposedRole: string
  ownerCountInOrg: number
  isPlatformAdmin?: boolean
}

export interface MembershipDeleteContext {
  actorUserId: string
  actorRole: string | null
  targetUserId: string
  targetRole: string | null
  ownerCountInOrg: number
  isPlatformAdmin?: boolean
}

function actorCanManage(actorRole: string | null, isPlatformAdmin?: boolean): boolean {
  if (isPlatformAdmin) return true
  return membershipRoleRank(actorRole) >= membershipRoleRank('admin')
}

/** Whether an actor may assign `proposedRole` to another member (or invite). */
export function canGrantMembershipRole(ctx: MembershipChangeContext): boolean {
  const { actorUserId, actorRole, targetUserId, targetCurrentRole, proposedRole, isPlatformAdmin } = ctx

  if (!actorCanManage(actorRole, isPlatformAdmin)) return false

  const actorRank = membershipRoleRank(actorRole)
  const proposedRank = membershipRoleRank(proposedRole)

  if (isPlatformAdmin) {
    return proposedRank > 0
  }

  if (proposedRank > actorRank) return false

  const isSelf = actorUserId === targetUserId
  const currentRank = membershipRoleRank(targetCurrentRole)

  if (isSelf && proposedRank > currentRank) return false

  if (isOrgOwnerRole(proposedRole) && !isOrgOwnerRole(actorRole)) {
    return false
  }

  if (
    targetCurrentRole &&
    isOrgOwnerRole(targetCurrentRole) &&
    proposedRank < currentRank &&
    ctx.ownerCountInOrg <= 1
  ) {
    return false
  }

  return proposedRank > 0
}

/** Whether an actor may remove a member from the organization. */
export function canRemoveMembership(ctx: MembershipDeleteContext): boolean {
  const { actorUserId, actorRole, targetUserId, targetRole, ownerCountInOrg, isPlatformAdmin } = ctx

  if (!actorCanManage(actorRole, isPlatformAdmin)) return false
  if (isPlatformAdmin) return true

  if (isOrgOwnerRole(targetRole) && ownerCountInOrg <= 1) return false

  if (actorUserId === targetUserId && isOrgOwnerRole(targetRole) && ownerCountInOrg <= 1) {
    return false
  }

  if (membershipRoleRank(targetRole) > membershipRoleRank(actorRole)) return false

  return true
}

/** Whether a user may create an organization of the given type via self-service RPC. */
export function canCreateOrganizationType(
  orgType: string,
  isPlatformAdmin: boolean
): boolean {
  if (orgType === 'government' || orgType === 'government_master') {
    return isPlatformAdmin
  }
  return orgType === 'private' || orgType === 'public' || orgType === 'farm_company'
}
