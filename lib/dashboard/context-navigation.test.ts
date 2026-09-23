import { describe, expect, it } from 'vitest'
import {
  clearOperationalOverlayParams,
  hasOperationalOverlayContext,
  isHarvestDashboardModule,
} from '@/lib/dashboard/context-navigation'

describe('context-navigation', () => {
  it('treats harvest parcel selection as primary navigation, not overlay context', () => {
    const params = new URLSearchParams('module=harvest&parcelId=parcel-1&harvestSeasonId=12')
    expect(isHarvestDashboardModule('harvest')).toBe(true)
    expect(hasOperationalOverlayContext(params, { ignoreParcelId: true })).toBe(false)
    expect(hasOperationalOverlayContext(params)).toBe(true)
  })

  it('clears overlay params without removing harvest field navigation', () => {
    const params = new URLSearchParams(
      'module=harvest&parcelId=parcel-1&signalId=sig-1&harvestSeasonId=12&zoom=13&focus=harvest-parcel-1'
    )
    const cleared = clearOperationalOverlayParams(params)
    expect(cleared.get('parcelId')).toBe('parcel-1')
    expect(cleared.get('harvestSeasonId')).toBe('12')
    expect(cleared.get('zoom')).toBe('13')
    expect(cleared.get('signalId')).toBeNull()
  })
})
