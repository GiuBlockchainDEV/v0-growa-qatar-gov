import { describe, expect, it } from 'vitest'
import { hasHarvestTableMetrics, missingHarvestTableMetrics } from '@/lib/harvest/field-metrics'

describe('field-metrics', () => {
  it('treats partial table metrics as incomplete', () => {
    expect(hasHarvestTableMetrics({ aeti: 1200 })).toBe(false)
    expect(missingHarvestTableMetrics({ aeti: 1200 })).toEqual(['tbp', 'bwp'])
  })

  it('treats full table metrics as complete', () => {
    expect(
      hasHarvestTableMetrics({
        aeti: 1200,
        tbp: 80,
        bwp: 1.1,
      })
    ).toBe(true)
    expect(missingHarvestTableMetrics({ aeti: 1200, tbp: 80, bwp: 1.1 })).toEqual([])
  })
})
