import { describe, expect, it } from 'vitest'
import { accountStatusBlocksSession, isAccountLoginAllowed } from '@/lib/auth/account-status'

describe('account status', () => {
  it('blocks suspended and deactivated accounts', () => {
    expect(isAccountLoginAllowed('suspended')).toBe(false)
    expect(accountStatusBlocksSession('deactivated')).toBe(true)
  })

  it('allows active and invited accounts', () => {
    expect(isAccountLoginAllowed('active')).toBe(true)
    expect(isAccountLoginAllowed('invited')).toBe(true)
  })
})
