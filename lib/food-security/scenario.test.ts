import { describe, expect, it } from 'vitest'
import { calculateFoodBalance, type FoodBalanceInput } from './balance'
import { buildDemoFoodBalanceInput } from './demo-data'
import { calculateFoodScenario, ZERO_FOOD_SCENARIO } from './scenario'

function baseline() {
  const input: FoodBalanceInput = {
    commodityId: 'tomato',
    sourceMode: 'live',
    fromDate: '2026-11-01', toDate: '2026-11-30',
    stocks: [{ id: 'opening', asOfDate: '2026-10-31', usableTonnes: 100, sourceRef: 'warehouse:1', dataMode: 'observed' }],
    flows: [
      { id: 'p', externalKey: 'p', flowType: 'domestic_production', effectiveDate: '2026-11-03', quantityTonnes: 30, sourceRef: 'farm:1', dataMode: 'forecast' },
      { id: 'i', externalKey: 'i', flowType: 'confirmed_import', effectiveDate: '2026-11-12', quantityTonnes: 20, sourceRef: 'shipment:1', dataMode: 'observed' },
      { id: 'd', externalKey: 'd', flowType: 'consumption', effectiveDate: '2026-11-20', quantityTonnes: 110, sourceRef: 'demand:1', dataMode: 'forecast' },
      { id: 'l', externalKey: 'l', flowType: 'loss', effectiveDate: '2026-11-22', quantityTonnes: 5, sourceRef: 'loss:1', dataMode: 'estimated' },
    ],
    coverage: (['domestic_production', 'confirmed_import', 'consumption', 'loss'] as const).map(flowType => ({
      id: 'c-' + flowType, flowType, status: 'complete' as const, startDate: '2026-11-01',
      endDate: '2026-11-30', sourceRef: 'coverage:' + flowType, dataMode: 'observed' as const,
    })),
  }
  return calculateFoodBalance(input)
}

describe('food scenario sensitivity analysis', () => {
  it('preserves the baseline when shocks are zero', () => {
    const result = calculateFoodScenario(baseline(), ZERO_FOOD_SCENARIO)
    expect(result.status).toBe('complete')
    expect(result.totals.baselineProjectedBalanceTonnes).toBe(35)
    expect(result.totals.scenarioProjectedBalanceTonnes).toBe(35)
    expect(result.totals.changeInBalanceTonnes).toBe(0)
    expect(result.simulated).toBe(true)
  })

  it('reduces domestic production by the chosen percentage', () => {
    const result = calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, productionReductionPercent: 50 })
    expect(result.totals.scenarioProjectedBalanceTonnes).toBe(20)
    expect(result.totals.changeInBalanceTonnes).toBe(-15)
  })

  it('removes confirmed imports without treating a delay as known', () => {
    const result = calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, importReductionPercent: 100 })
    expect(result.totals.scenarioProjectedBalanceTonnes).toBe(15)
  })

  it('increases demand and decreases coverage', () => {
    const result = calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, demandIncreasePercent: 10 })
    expect(result.totals.scenarioProjectedBalanceTonnes).toBe(24)
    expect(result.totals.scenarioCoverageDays).toBe(6)
  })

  it('models a warehouse inventory shock without negative physical stock', () => {
    const result = calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, openingStockLossPercent: 50 })
    expect(result.totals.scenarioProjectedBalanceTonnes).toBe(-15)
    expect(result.totals.scenarioDeficitTonnes).toBe(15)
    expect(result.totals.scenarioClosingStockTonnes).toBe(0)
    expect(result.totals.changeInDeficitTonnes).toBe(15)
  })

  it('fails closed with insufficient source data', () => {
    const input = buildDemoFoodBalanceInput('milk', '2026-11-01', 30)
    const incomplete = calculateFoodBalance({ ...input, stocks: [] })
    const result = calculateFoodScenario(incomplete, { ...ZERO_FOOD_SCENARIO, demandIncreasePercent: 25 })
    expect(result.status).toBe('insufficient_data')
    expect(result.totals.scenarioProjectedBalanceTonnes).toBeNull()
  })

  it('preserves the demo baseline label', () => {
    const input = buildDemoFoodBalanceInput('rice', '2026-11-01', 7)
    const result = calculateFoodScenario(calculateFoodBalance(input), ZERO_FOOD_SCENARIO)
    expect(result.sourceMode).toBe('demo')
    expect(result.warnings.some(w => w.includes('DEMO'))).toBe(true)
  })

  it('rejects negative, non-finite or above-100 percentage shocks', () => {
    expect(() => calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, productionReductionPercent: -1 })).toThrow()
    expect(() => calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, importReductionPercent: 101 })).toThrow()
    expect(() => calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, demandIncreasePercent: Number.NaN })).toThrow()
    expect(() => calculateFoodScenario(baseline(), { ...ZERO_FOOD_SCENARIO, openingStockLossPercent: Infinity })).toThrow()
  })
})
