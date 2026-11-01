import { describe, expect, it } from 'vitest'
import { organizationTypesForCreator } from '@/lib/auth/organization-types'

describe('organizationTypesForCreator', () => {
  it('hides government types from non-platform administrators', () => {
    const options = organizationTypesForCreator(false).map((o) => o.value)
    expect(options).not.toContain('government')
    expect(options).not.toContain('government_master')
    expect(options).toContain('private')
  })

  it('exposes all types to platform administrators', () => {
    const options = organizationTypesForCreator(true).map((o) => o.value)
    expect(options).toContain('government')
    expect(options).toContain('government_master')
  })
})
