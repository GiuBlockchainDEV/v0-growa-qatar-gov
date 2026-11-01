import { describe, expect, it } from 'vitest'
import {
  buildOperatingFoodBalanceInput,
  buildOperatingFoodPosture,
} from '@/lib/food-security/operating-baseline'

describe('operating food baseline', () => {
  it('builds live-mode balances for Qatar commodities', () => {
    const balance = buildOperatingFoodBalanceInput('rice', '2026-11-01', 30)
    expect(balance.sourceMode).toBe('live')
    expect(balance.stocks[0]?.usableTonnes).toBeGreaterThan(0)
    expect(balance.flows.length).toBe(30 * 4)
  })

  it('returns an organization posture with assessed commodities', () => {
    const posture = buildOperatingFoodPosture(
      '10000000-0000-0000-0000-000000000001',
      '2026-11-01',
      30
    )
    expect(posture.sourceMode).toBe('live')
    expect(posture.scope).toBe('organization')
    expect(posture.assessedCount).toBeGreaterThan(0)
    expect(posture.commodities.some((row) => row.band !== 'unknown')).toBe(true)
  })
})
