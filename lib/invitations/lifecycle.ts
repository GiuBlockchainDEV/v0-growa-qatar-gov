export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export function canAcceptInvitation(status: InvitationStatus, expired: boolean): boolean {
  return status === 'pending' && !expired
}

export function canResendInvitation(status: InvitationStatus): boolean {
  return status === 'pending' || status === 'expired'
}

export function canRevokeInvitation(status: InvitationStatus): boolean {
  return status === 'pending'
}
