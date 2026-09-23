import { describe, expect, it } from 'vitest'
import { buildHarvestProductionSnapshot } from '@/lib/watchtower/production-metrics'
import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'

describe('buildHarvestProductionSnapshot', () => {
  it('aggregates forecast biomass and field coverage from harvest data', () => {
    const snapshot = buildHarvestProductionSnapshot({
      farms: [],
      insights: [],
      polygons: [{ pointId: 'p1', score: 40, cropName: 'tomato' }],
      harvestFields: [
        { parcel_id: 'a', name: 'North', crop: 'tomato', metrics: { tbp: 120, bwp: 1.3 } },
        { parcel_id: 'b', name: 'South', crop: 'cucumber', metrics: { tbp: 80, bwp: 1.1 } },
      ],
      harvestDemo: true,
      harvestAvailable: true,
      weatherSamples: [],
      weatherAvailable: false,
      supply: null,
      supplyAvailable: false,
      fetchedAt: '2026-09-23T00:00:00.000Z',
    } as WatchtowerRawData)

    expect(snapshot.forecastBiomassTons).toBe(200)
    expect(snapshot.fieldCount).toBe(2)
    expect(snapshot.cropCount).toBe(2)
    expect(snapshot.lowHealthPolygonCount).toBe(1)
  })
})
