import { describe, expect, it } from 'vitest'
import {
  calculateFoodBalance,
  type FoodBalanceInput,
  type FoodBalanceFlow,
  type FoodCoverage,
} from './balance'
import { buildDemoFoodBalanceInput } from './demo-data'

const types: FoodBalanceFlow['flowType'][] = [
  'domestic_production', 'confirmed_import', 'consumption', 'loss',
]

function fixture(): FoodBalanceInput {
  const fromDate = '2026-11-01'
  const toDate = '2026-11-30'
  return {
    commodityId: 'tomato',
    fromDate,
    toDate,
    sourceMode: 'live',
    stocks: [{ id: 'opening', asOfDate: '2026-10-31', usableTonnes: 100, sourceRef: 'inventory:1', dataMode: 'observed' }],
    flows: [
      { id: 'prod', externalKey: 'farm:1', flowType: 'domestic_production', effectiveDate: '2026-11-03', quantityTonnes: 30, sourceRef: 'farm:1', dataMode: 'forecast' },
      { id: 'imports', externalKey: 'shipment:1', flowType: 'confirmed_import', effectiveDate: '2026-11-12', quantityTonnes: 20, sourceRef: 'shipment:1', dataMode: 'observed' },
      { id: 'demand', externalKey: 'demand:1', flowType: 'consumption', effectiveDate: '2026-11-15', quantityTonnes: 110, sourceRef: 'forecast:1', dataMode: 'forecast' },
      { id: 'loss', externalKey: 'loss:1', flowType: 'loss', effectiveDate: '2026-11-21', quantityTonnes: 5, sourceRef: 'loss:1', dataMode: 'estimated' },
    ],
    coverage: types.map((flowType): FoodCoverage => ({
      id: `coverage-${flowType}`, flowType, startDate: fromDate, endDate: toDate,
      status: 'complete', sourceRef: `coverage:${flowType}`, dataMode: 'observed',
    })),
  }
}

describe('calculateFoodBalance', () => {
  it('balances opening inventory plus inflows minus demand and losses', () => {
    const result = calculateFoodBalance(fixture())
    expect(result.status).toBe('complete')
    expect(result.totals.projectedBalanceTonnes).toBe(35)
    expect(result.totals.projectedClosingStockTonnes).toBe(35)
    expect(result.totals.deficitTonnes).toBe(0)
    expect(result.totals.projectedCoverageDays).toBe(9.5)
    expect(result.evidence.flowIds).toHaveLength(4)
  })

  it('never interprets missing flow coverage as a verified zero', () => {
    const input = fixture()
    const result = calculateFoodBalance({ ...input, coverage: input.coverage.filter(c => c.flowType !== 'loss') })
    expect(result.status).toBe('insufficient_data')
    expect(result.totals.lossesTonnes).toBeNull()
    expect(result.totals.projectedBalanceTonnes).toBeNull()
    expect(result.evidence.missingCoverage).toContain('loss')
  })

  it('accepts explicitly verified zero activity', () => {
    const input = fixture()
    const result = calculateFoodBalance({ ...input, flows: input.flows.filter(f => f.flowType !== 'confirmed_import') })
    expect(result.totals.confirmedImportsTonnes).toBe(0)
    expect(result.totals.projectedBalanceTonnes).toBe(15)
  })

  it('requires an end-of-day opening stock snapshot before the period', () => {
    const input = fixture()
    const result = calculateFoodBalance({ ...input, stocks: [] })
    expect(result.totals.projectedBalanceTonnes).toBeNull()
    expect(result.status).toBe('insufficient_data')
  })

  it('rejects a stale stock snapshot even if flow coverage is complete', () => {
    const input = fixture()
    const stocks = [{ ...input.stocks[0], asOfDate: '2026-10-01' }]
    const result = calculateFoodBalance({ ...input, stocks })
    expect(result.status).toBe('insufficient_data')
    expect(result.totals.projectedBalanceTonnes).toBeNull()
    expect(result.evidence.warnings.some(w => w.includes('stale'))).toBe(true)
  })

  it('supports adjoining coverage intervals, not gaps', () => {
    const input = fixture()
    const coverage = input.coverage.filter(c => c.flowType !== 'consumption')
    const append: FoodCoverage[] = [
      { id: 'a', flowType: 'consumption', startDate: '2026-11-01', endDate: '2026-11-15', status: 'complete', sourceRef: 'a', dataMode: 'observed' },
      { id: 'b', flowType: 'consumption', startDate: '2026-11-16', endDate: '2026-11-30', status: 'complete', sourceRef: 'b', dataMode: 'observed' },
    ]
    expect(calculateFoodBalance({ ...input, coverage: [...coverage, ...append] }).status).toBe('complete')
    append[1].startDate = '2026-11-17'
    expect(calculateFoodBalance({ ...input, coverage: [...coverage, ...append] }).status).toBe('insufficient_data')
  })

  it('rejects duplicate source transaction keys to prevent double counting', () => {
    const input = fixture()
    expect(() => calculateFoodBalance({ ...input, flows: [...input.flows, input.flows[0]] })).toThrow('Duplicate')
  })

  it('rejects negative, non-finite and invalid dates', () => {
    const input = fixture()
    expect(() => calculateFoodBalance({ ...input, flows: [{ ...input.flows[0], quantityTonnes: -1 }] })).toThrow()
    expect(() => calculateFoodBalance({ ...input, fromDate: '2026-02-30' })).toThrow()
    expect(() => calculateFoodBalance({ ...input, toDate: '2026-10-01' })).toThrow()
  })

  it('shows a deficit without reporting negative physical inventory', () => {
    const input = fixture()
    const flows = input.flows.map(f => f.flowType === 'consumption' ? { ...f, quantityTonnes: 500 } : f)
    const result = calculateFoodBalance({ ...input, flows })
    expect(result.totals.projectedBalanceTonnes).toBe(-355)
    expect(result.totals.projectedClosingStockTonnes).toBe(0)
    expect(result.totals.deficitTonnes).toBe(355)
  })

  it('does not calculate days of coverage from zero demand', () => {
    const input = fixture()
    const result = calculateFoodBalance({ ...input, flows: input.flows.filter(f => f.flowType !== 'consumption') })
    expect(result.totals.consumptionTonnes).toBe(0)
    expect(result.totals.projectedCoverageDays).toBeNull()
  })

  it('does not count movements outside the requested horizon', () => {
    const input = fixture()
    const result = calculateFoodBalance({
      ...input,
      flows: [
        ...input.flows,
        { ...input.flows[0], id: 'dec', externalKey: 'farm:dec', effectiveDate: '2026-12-01', quantityTonnes: 900 },
        { ...input.flows[1], id: 'oct', externalKey: 'shipment:oct', effectiveDate: '2026-10-31', quantityTonnes: 900 },
      ],
    })
    expect(result.totals.projectedBalanceTonnes).toBe(35)
    expect(result.evidence.flowIds).toHaveLength(4)
  })

  it('rejects a flow input with NaN, an impossible quantity or an invalid coverage date', () => {
    const input = fixture()
    expect(() => calculateFoodBalance({ ...input, flows: [{ ...input.flows[0], quantityTonnes: NaN }] })).toThrow()
    expect(() => calculateFoodBalance({ ...input, flows: [{ ...input.flows[0], quantityTonnes: 1e13 }] })).toThrow()
    expect(() => calculateFoodBalance({ ...input, coverage: [{ ...input.coverage[0], endDate: '2026-11-00' }] })).toThrow()
  })

  it('rejects complete coverage when an interval does not reach the last day', () => {
    const input = fixture()
    const coverage = input.coverage.map(c => c.flowType === 'loss' ? { ...c, endDate: '2026-11-29' } : c)
    const result = calculateFoodBalance({ ...input, coverage })
    expect(result.status).toBe('insufficient_data')
    expect(result.evidence.missingCoverage).toEqual(['loss'])
  })

  it('keeps demo results explicitly labeled and isolated', () => {
    const result = calculateFoodBalance(buildDemoFoodBalanceInput('rice', '2026-11-01', 30))
    expect(result.status).toBe('complete')
    expect(result.sourceMode).toBe('demo')
    expect(result.evidence.warnings.some(w => w.includes('SIMULATED'))).toBe(true)
  })
})
