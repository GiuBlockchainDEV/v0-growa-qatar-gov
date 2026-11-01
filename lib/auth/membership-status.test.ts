import { describe, expect, it } from 'vitest'
import {
  isActiveMembershipStatus,
  isBlockedMembershipStatus,
  isInvitedMembershipStatus,
} from '@/lib/auth/membership-status'

describe('isActiveMembershipStatus', () => {
  it('treats inactive memberships as blocked', () => {
    expect(isActiveMembershipStatus('inactive')).toBe(false)
  })

  it('allows active memberships only for authorization', () => {
    expect(isActiveMembershipStatus('active')).toBe(true)
    expect(isActiveMembershipStatus('invited')).toBe(false)
    expect(isActiveMembershipStatus(undefined)).toBe(true)
  })

  it('tracks invited and blocked statuses separately', () => {
    expect(isInvitedMembershipStatus('invited')).toBe(true)
    expect(isBlockedMembershipStatus('inactive')).toBe(true)
  })
})
