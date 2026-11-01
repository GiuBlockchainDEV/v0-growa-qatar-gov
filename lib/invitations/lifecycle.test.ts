import { describe, expect, it } from 'vitest'
import { canAcceptInvitation, canResendInvitation, canRevokeInvitation } from '@/lib/invitations/lifecycle'

describe('invitation lifecycle', () => {
  it('allows accept only for pending non-expired invites', () => {
    expect(canAcceptInvitation('pending', false)).toBe(true)
    expect(canAcceptInvitation('pending', true)).toBe(false)
    expect(canAcceptInvitation('revoked', false)).toBe(false)
  })

  it('controls resend and revoke', () => {
    expect(canResendInvitation('pending')).toBe(true)
    expect(canResendInvitation('accepted')).toBe(false)
    expect(canRevokeInvitation('pending')).toBe(true)
    expect(canRevokeInvitation('expired')).toBe(false)
  })
})
