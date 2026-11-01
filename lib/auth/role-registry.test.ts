import { describe, expect, it } from 'vitest'
import { normalizeOrgRole, permissionsForOrgRole } from '@/lib/auth/role-registry'

describe('normalizeOrgRole', () => {
  it('maps legacy aliases without escalating privilege', () => {
    expect(normalizeOrgRole('supply_chain_officer')).toBe('sourcing_manager')
    expect(normalizeOrgRole('inspector')).toBe('ministry_inspector')
  })

  it('falls back to viewer for unknown roles', () => {
    expect(normalizeOrgRole('unknown_role_xyz')).toBe('viewer')
  })
})

describe('permissionsForOrgRole', () => {
  it('grants approval only to designated approver roles', () => {
    expect(permissionsForOrgRole('ministry_admin').has('decisions.approve')).toBe(true)
    expect(permissionsForOrgRole('ministry_officer').has('decisions.approve')).toBe(false)
  })
})
