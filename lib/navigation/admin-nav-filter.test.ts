import { describe, expect, it } from 'vitest'
import { filterNavByPermissions } from '@/lib/navigation/admin-nav-filter'
import { allNavItems } from '@/lib/navigation/registry'

describe('filterNavByPermissions', () => {
  it('hides admin nav without capabilities', () => {
    const items = allNavItems().filter((i) =>
      ['users-roles', 'invitations', 'my-profile', 'security-audit'].includes(i.key)
    )
    const filtered = filterNavByPermissions(items, () => false)
    expect(filtered.map((i) => i.key)).toEqual(['my-profile'])
  })

  it('shows users nav when users.view granted', () => {
    const items = allNavItems().filter((i) => i.key === 'users-roles')
    const filtered = filterNavByPermissions(items, (k) => k === 'users.view')
    expect(filtered).toHaveLength(1)
  })
})
