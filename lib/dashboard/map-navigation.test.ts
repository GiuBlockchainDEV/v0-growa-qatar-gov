import { describe, expect, it } from 'vitest'
import { buildFarmSearchMapUrl } from '@/lib/dashboard/map-navigation'

describe('buildFarmSearchMapUrl', () => {
  it('opens live map focused on a farm', () => {
    const url = buildFarmSearchMapUrl({ source: 'farm', id: 'farm-abc' })

    expect(url).toContain('module=live-map')
    expect(url).toContain('farmId=farm-abc')
    expect(url).toContain('zoom=17')
    expect(url).toContain('focus=')
    expect(url).not.toContain('parcelId=')
  })

  it('opens live map focused on a custom point', () => {
    const url = buildFarmSearchMapUrl({ source: 'point', id: 'point-123' }, 16)

    expect(url).toContain('module=live-map')
    expect(url).toContain('pointId=point-123')
    expect(url).toContain('zoom=16')
    expect(url).not.toContain('farmId=')
  })
})
