import { describe, expect, it } from 'vitest'
import {
  buildModuleUrl,
  navigateToFarm,
  navigateToHarvestField,
  navigateToSignal,
  navigateToSignalEstimation,
  signalRecommendedModule,
} from '@/lib/dashboard/operational-navigation'
import type { IntelligenceSignal } from '@/lib/domain/types'

describe('operational-navigation', () => {
  it('buildModuleUrl preserves module and farm context with map focus', () => {
    const url = buildModuleUrl(new URLSearchParams('module=watchtower'), {
      module: 'water-intelligence',
      farmId: 'farm-123',
      zoom: 14,
    })
    expect(url).toContain('module=water-intelligence')
    expect(url).toContain('farmId=farm-123')
    expect(url).toContain('zoom=14')
    expect(url).toContain('focus=')
  })

  it('navigateToFarm builds map focus URL', () => {
    const url = navigateToFarm(new URLSearchParams(), 'farm-abc', 'live-map', 15)
    expect(url).toContain('farmId=farm-abc')
    expect(url).toContain('module=live-map')
    expect(url).toContain('zoom=15')
  })

  it('signalRecommendedModule defaults to watchtower for unknown types', () => {
    expect(signalRecommendedModule('data_quality')).toBe('watchtower')
  })

  it('navigateToSignalEstimation routes production signals to harvest with parcel focus', () => {
    const signal: IntelligenceSignal = {
      id: 'prod-test',
      type: 'production',
      severity: 'attention',
      title: 'Test',
      summary: 'Test summary',
      detectedAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z',
      parcelIds: ['parcel-1'],
    }
    const url = navigateToSignalEstimation(new URLSearchParams(), signal)
    expect(url).toContain('module=harvest')
    expect(url).toContain('signalId=prod-test')
    expect(url).toContain('parcelId=parcel-1')
    expect(url).toContain('focus=harvest-parcel-1')
    expect(url).toContain('zoom=13')
  })

  it('navigateToHarvestField sets harvest navigation params', () => {
    const url = navigateToHarvestField(
      new URLSearchParams('module=watchtower'),
      { parcel_id: 'parcel-1', season_id: 42 },
      { mode: 'predict', signalId: 'sig-1', timeframe: '7d' }
    )
    expect(url).toContain('module=harvest')
    expect(url).toContain('parcelId=parcel-1')
    expect(url).toContain('harvestSeasonId=42')
    expect(url).toContain('focus=harvest-parcel-1')
    expect(url).toContain('harvestMetric=npp')
    expect(url).toContain('signalId=sig-1')
    expect(url).toContain('timeframe=7d')
  })

  it('navigateToSignal routes water signals to water intelligence with point focus', () => {
    const signal: IntelligenceSignal = {
      id: 'water-test',
      type: 'water',
      severity: 'attention',
      title: 'Test',
      summary: 'Test summary',
      detectedAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z',
      pointIds: ['p1'],
    }
    const url = navigateToSignal(new URLSearchParams(), signal)
    expect(url).toContain('water-intelligence')
    expect(url).toContain('pointId=p1')
    expect(url).toContain('focus=')
    expect(url).toContain('zoom=16')
  })

  it('navigateToSignal ignores stale deep links without entity context', () => {
    const signal: IntelligenceSignal = {
      id: 'water-test',
      type: 'water',
      severity: 'attention',
      title: 'Test',
      summary: 'Test summary',
      detectedAt: '2026-09-22T12:00:00.000Z',
      updatedAt: '2026-09-22T12:00:00.000Z',
      pointIds: ['p1'],
      deepLink: '/dashboard?module=water-intelligence&signalId=water-test',
    }
    const url = navigateToSignal(new URLSearchParams(), signal)
    expect(url).toContain('pointId=p1')
    expect(url).not.toBe(signal.deepLink)
  })
})
