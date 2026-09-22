import { describe, expect, it } from 'vitest'
import { generateIntelligenceSignals } from '@/lib/watchtower/signals-engine'
import type { WatchtowerRawData } from '@/lib/watchtower/fetch-context-data'

function baseData(overrides: Partial<WatchtowerRawData> = {}): WatchtowerRawData {
  return {
    farms: [],
    insights: [],
    polygons: [],
    harvestFields: [],
    harvestDemo: false,
    harvestAvailable: true,
    weatherSamples: [],
    weatherAvailable: true,
    supply: null,
    supplyAvailable: false,
    fetchedAt: '2026-09-22T12:00:00.000Z',
    ...overrides,
  }
}

describe('generateIntelligenceSignals', () => {
  it('detects water intensity anomaly when producers exceed baseline', () => {
    const signals = generateIntelligenceSignals(
      baseData({
        insights: [
          { id: '1', pointId: 'p1', cropName: 'tomato', estimatedProductionTons: 10, energyConsumptionKwh: 100, waterConsumptionM3: 50 },
          { id: '2', pointId: 'p2', cropName: 'tomato', estimatedProductionTons: 10, energyConsumptionKwh: 100, waterConsumptionM3: 50 },
          { id: '3', pointId: 'p3', cropName: 'tomato', estimatedProductionTons: 10, energyConsumptionKwh: 100, waterConsumptionM3: 200 },
        ],
      })
    )

    const waterSignal = signals.find((signal) => signal.type === 'water')
    expect(waterSignal).toBeDefined()
    expect(waterSignal?.severity).toMatch(/attention|high/)
  })

  it('detects low crop health polygons', () => {
    const signals = generateIntelligenceSignals(
      baseData({
        polygons: [
          { id: 'poly1', pointId: 'p1', score: 25, crop: { cropName: 'cucumber' } },
        ],
      })
    )

    expect(signals.some((signal) => signal.type === 'crop_health')).toBe(true)
  })

  it('emits data quality signal when weather unavailable', () => {
    const signals = generateIntelligenceSignals(
      baseData({ weatherAvailable: false })
    )

    expect(signals.some((signal) => signal.id.includes('weather-unavailable'))).toBe(true)
  })

  it('does not fabricate supply signals without data', () => {
    const signals = generateIntelligenceSignals(baseData())
    expect(signals.some((signal) => signal.type === 'supply')).toBe(false)
  })
})
