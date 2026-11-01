import { describe, expect, it } from 'vitest'
import {
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
} from '@/lib/invitations/token'

describe('invitation token', () => {
  it('hashes tokens consistently', () => {
    const { token, tokenHash } = generateInvitationToken()
    expect(token.length).toBeGreaterThan(20)
    expect(hashInvitationToken(token)).toBe(tokenHash)
  })

  it('detects expiry', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isInvitationExpired(past)).toBe(true)
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isInvitationExpired(future)).toBe(false)
  })
})
