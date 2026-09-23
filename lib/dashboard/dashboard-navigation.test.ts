import { describe, expect, it } from 'vitest'
import { resolveDashboardHref } from '@/lib/dashboard/dashboard-navigation'

describe('resolveDashboardHref', () => {
  it('preserves standalone dashboard routes', () => {
    expect(resolveDashboardHref(new URLSearchParams('module=watchtower'), '/dashboard/supply-overview')).toBe(
      '/dashboard/supply-overview'
    )
  })

  it('keeps module when updating query params from bare dashboard', () => {
    expect(
      resolveDashboardHref(new URLSearchParams('module=watchtower&timeframe=7d'), 'module=harvest&signalId=abc')
    ).toBe('/dashboard?module=harvest&signalId=abc')
  })

  it('defaults module to watchtower when missing', () => {
    expect(resolveDashboardHref(new URLSearchParams(), 'signalId=abc')).toBe(
      '/dashboard?signalId=abc&module=watchtower'
    )
  })
})
