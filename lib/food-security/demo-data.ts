import {
  addFoodDays,
  type FoodBalanceInput,
  type FoodFlowType,
} from './balance'

/** Explicitly synthetic, non-persisted demonstration data. Never use for live KPIs. */
export function buildDemoFoodBalanceInput(
  commodityId: string,
  fromDate: string,
  days: number,
): FoodBalanceInput {
  const examples: Record<string, [number, number, number, number, number]> = {
    // opening, production/day, confirmed imports/day, demand/day, loss/day
    tomato: [1200, 30, 10, 45, 1],
    cucumber: [700, 22, 7, 31, 1],
    milk: [850, 115, 4, 112, 2],
    rice: [4000, 0, 80, 85, 0.5],
    wheat: [5000, 0, 110, 120, 1],
    pepper: [500, 12, 4, 17, 0.5],
    lettuce: [350, 14, 3, 18, 0.5],
    date: [750, 5, 6, 11, 0.2],
    barley: [600, 1, 19, 21, 0.2],
  }
  const [opening, production, imports, demand, loss] = examples[commodityId] ?? [300, 5, 5, 10, 0.3]
  const end = addFoodDays(fromDate, days - 1)
  const stockDate = addFoodDays(fromDate, -1)
  const sourceRef = `synthetic-fixture:${commodityId}:v1`
  const flowTypes: Array<[FoodFlowType, number]> = [
    ['domestic_production', production],
    ['confirmed_import', imports],
    ['consumption', demand],
    ['loss', loss],
  ]
  return {
    commodityId,
    fromDate,
    toDate: end,
    sourceMode: 'demo',
    stocks: [{ id: 'demo-opening', asOfDate: stockDate, usableTonnes: opening, sourceRef, dataMode: 'demo' }],
    flows: flowTypes.map(([flowType, dailyTonnes]) => ({
      id: `demo-${flowType}`,
      externalKey: `demo-${commodityId}-${flowType}-${fromDate}`,
      flowType,
      effectiveDate: fromDate,
      quantityTonnes: Number((dailyTonnes * days).toFixed(3)),
      sourceRef,
      dataMode: 'demo',
    })),
    coverage: flowTypes.map(([flowType]) => ({
      id: `demo-coverage-${flowType}`,
      flowType,
      startDate: fromDate,
      endDate: end,
      status: 'complete',
      sourceRef,
      dataMode: 'demo',
    })),
  }
}


import qatarPreview from '@/supabase/seeds/qatar-2026-sandbox/03_dataset_preview.json'

/**
 * Reuses the EXISTING Qatar 2026 synthetic seed assumptions, matching the
 * supplier/contract/shipment preview. Daily allocation (rather than dated
 * multi-week blocks) makes 7/30/90/180-day horizons mathematically coherent.
 * Read-only local computation, never persisted or independently verified.
 */
export function buildQatarIllustrativeFoodBalanceInput(
  commodityId: string, fromDate: string, days: number,
): FoodBalanceInput {
  if (![7, 30, 90, 180].includes(days)) throw new Error('Unsupported example horizon')
  const row = qatarPreview.commodity_daily_assumptions_tonnes.find(
    c => c.commodity === commodityId,
  )
  if (!row) throw new Error('No existing Qatar example for commodity ' + commodityId)
  const sourceRef = 'SIMQA26/SYNTHETIC-PLANNING/' + commodityId
  const types = [
    'domestic_production', 'confirmed_import', 'consumption', 'loss',
  ] as const
  const flows: FoodBalanceInput['flows'][number][] = []
  for (let offset = 0; offset < days; offset++) {
    for (const flowType of types) {
      let multiplier = 1
      if (['tomato', 'cucumber', 'pepper', 'lettuce'].includes(commodityId)) {
        if (flowType === 'domestic_production') {
          multiplier = offset < 90 ? 1.1 : offset < 150 ? 0.75 : 0.45
        } else if (flowType === 'confirmed_import') {
          multiplier = offset < 90 ? 0.9 : offset < 150 ? 1.15 : 1.4
        }
      }
      flows.push({
        id: 'illustrative-' + commodityId + '-' + flowType + '-' + offset,
        externalKey: 'SIMQA26-' + commodityId + '-' + flowType + '-' + offset,
        flowType,
        effectiveDate: addFoodDays(fromDate, offset),
        quantityTonnes: Math.round(row[flowType] * multiplier * 1000) / 1000,
        sourceRef: sourceRef + '/' + flowType,
        dataMode: 'demo',
      })
    }
  }
  const toDate = addFoodDays(fromDate, days - 1)
  return {
    commodityId, fromDate, toDate, sourceMode: 'demo',
    stocks: [{
      id: 'SIMQA26-OPENING-' + commodityId,
      asOfDate: addFoodDays(fromDate, -1),
      usableTonnes: row.opening,
      sourceRef: sourceRef + '/OPENING',
      dataMode: 'demo',
    }],
    flows,
    coverage: types.map(flowType => ({
      id: 'SIMQA26-COVERAGE-' + commodityId + '-' + flowType,
      flowType, startDate: fromDate, endDate: toDate,
      status: 'complete', sourceRef: sourceRef + '/COVERAGE/' + flowType,
      dataMode: 'demo',
    })),
  }
}
