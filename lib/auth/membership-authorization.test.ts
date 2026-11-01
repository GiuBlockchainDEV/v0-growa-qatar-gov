import { describe, expect, it } from 'vitest'
import {
  canCreateOrganizationType,
  canGrantMembershipRole,
  canRemoveMembership,
} from '@/lib/auth/membership-authorization'

describe('canCreateOrganizationType', () => {
  it('denies government types for ordinary users', () => {
    expect(canCreateOrganizationType('government', false)).toBe(false)
    expect(canCreateOrganizationType('government_master', false)).toBe(false)
  })

  it('allows self-service types for ordinary users', () => {
    expect(canCreateOrganizationType('private', false)).toBe(true)
    expect(canCreateOrganizationType('farm_company', false)).toBe(true)
  })

  it('allows privileged types only for platform administrators', () => {
    expect(canCreateOrganizationType('government_master', true)).toBe(true)
  })
})

describe('canGrantMembershipRole', () => {
  it('prevents self-promotion above current rank', () => {
    expect(
      canGrantMembershipRole({
        actorUserId: 'u1',
        actorRole: 'admin',
        targetUserId: 'u1',
        targetCurrentRole: 'admin',
        proposedRole: 'ministry_admin',
        ownerCountInOrg: 1,
      })
    ).toBe(false)
  })

  it('prevents granting roles above actor authority', () => {
    expect(
      canGrantMembershipRole({
        actorUserId: 'u1',
        actorRole: 'admin',
        targetUserId: 'u2',
        targetCurrentRole: 'member',
        proposedRole: 'ministry_admin',
        ownerCountInOrg: 1,
      })
    ).toBe(false)
  })

  it('allows peer or lower grants within authority', () => {
    expect(
      canGrantMembershipRole({
        actorUserId: 'u1',
        actorRole: 'ministry_admin',
        targetUserId: 'u2',
        targetCurrentRole: 'viewer',
        proposedRole: 'ministry_officer',
        ownerCountInOrg: 2,
      })
    ).toBe(true)
  })

  it('blocks demoting the last owner', () => {
    expect(
      canGrantMembershipRole({
        actorUserId: 'u1',
        actorRole: 'owner',
        targetUserId: 'u1',
        targetCurrentRole: 'owner',
        proposedRole: 'admin',
        ownerCountInOrg: 1,
      })
    ).toBe(false)
  })

  it('allows platform administrators to bypass rank limits', () => {
    expect(
      canGrantMembershipRole({
        actorUserId: 'u1',
        actorRole: 'viewer',
        targetUserId: 'u2',
        targetCurrentRole: 'member',
        proposedRole: 'ministry_admin',
        ownerCountInOrg: 2,
        isPlatformAdmin: true,
      })
    ).toBe(true)
  })
})

describe('canRemoveMembership', () => {
  it('prevents removing the last owner', () => {
    expect(
      canRemoveMembership({
        actorUserId: 'u1',
        actorRole: 'owner',
        targetUserId: 'u2',
        targetRole: 'owner',
        ownerCountInOrg: 1,
      })
    ).toBe(false)
  })

  it('denies cross-organization escalation via removal of higher role', () => {
    expect(
      canRemoveMembership({
        actorUserId: 'u1',
        actorRole: 'admin',
        targetUserId: 'u2',
        targetRole: 'ministry_admin',
        ownerCountInOrg: 2,
      })
    ).toBe(false)
  })

  it('allows removal when actor outranks target and owner count safe', () => {
    expect(
      canRemoveMembership({
        actorUserId: 'u1',
        actorRole: 'owner',
        targetUserId: 'u2',
        targetRole: 'member',
        ownerCountInOrg: 2,
      })
    ).toBe(true)
  })
})

describe('cross-organization access (client policy helpers)', () => {
  it('treats missing platform admin as unable to create ministry orgs', () => {
    expect(canCreateOrganizationType('government', false)).toBe(false)
  })
})
