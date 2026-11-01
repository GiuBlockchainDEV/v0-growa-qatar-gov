/** Membership grants org permissions (excludes invited / inactive). */
export function isActiveMembershipStatus(status: string | null | undefined): boolean {
  const s = (status ?? 'active').toLowerCase()
  return s === 'active' || s === ''
}

export function isInvitedMembershipStatus(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === 'invited'
}

export function isBlockedMembershipStatus(status: string | null | undefined): boolean {
  const s = (status ?? 'active').toLowerCase()
  return s === 'inactive' || s === 'suspended'
}
