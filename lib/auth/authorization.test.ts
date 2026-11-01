import { describe, expect, it } from 'vitest'
import {
  authorize,
  resolveAuthorization,
  selectValidatedActiveOrganizationId,
  type MembershipRecord,
} from '@/lib/auth/authorization'

const memberships: MembershipRecord[] = [
  { organizationId: 'org-a', role: 'ministry_admin', status: 'active' },
  { organizationId: 'org-b', role: 'viewer', status: 'active' },
]

describe('selectValidatedActiveOrganizationId', () => {
  it('never picks an arbitrary first membership without validation', () => {
    expect(selectValidatedActiveOrganizationId(memberships, null, null)).toBeNull()
  })

  it('accepts explicit requested organization when member', () => {
    expect(selectValidatedActiveOrganizationId(memberships, 'org-b', null)).toBe('org-b')
  })

  it('rejects organization outside membership', () => {
    expect(selectValidatedActiveOrganizationId(memberships, 'org-x', null)).toBeNull()
  })

  it('allows single membership auto-selection after validation path', () => {
    const single = [{ organizationId: 'org-only', role: 'viewer', status: 'active' }]
    expect(selectValidatedActiveOrganizationId(single, null, null)).toBe('org-only')
  })

  it('does not auto-select invited-only membership', () => {
    const invitedOnly = [{ organizationId: 'org-pending', role: 'viewer', status: 'invited' }]
    expect(selectValidatedActiveOrganizationId(invitedOnly, null, null)).toBeNull()
  })
})

describe('resolveAuthorization', () => {
  it('denies org permissions without active organization', () => {
    const resolved = resolveAuthorization({
      userId: 'u1',
      activeOrganizationId: null,
      memberships,
      platformStaffTier: null,
    })
    expect(authorize(resolved, 'users.manage')).toBe(false)
  })

  it('grants org permissions from active membership role', () => {
    const resolved = resolveAuthorization({
      userId: 'u1',
      activeOrganizationId: 'org-a',
      memberships,
      platformStaffTier: null,
    })
    expect(authorize(resolved, 'users.manage')).toBe(true)
    expect(authorize(resolved, 'platform.config.manage')).toBe(false)
  })

  it('adds platform staff capabilities without org admin escalation', () => {
    const resolved = resolveAuthorization({
      userId: 'u1',
      activeOrganizationId: 'org-b',
      memberships,
      platformStaffTier: 'support',
    })
    expect(authorize(resolved, 'platform.support.tools')).toBe(true)
    expect(authorize(resolved, 'platform.config.manage')).toBe(false)
    expect(authorize(resolved, 'users.manage')).toBe(false)
  })
})
