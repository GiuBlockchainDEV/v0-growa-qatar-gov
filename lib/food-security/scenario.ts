import type { FoodBalanceResult } from './balance'

/**
 * Pure, non-persistent WHAT-IF comparison over a verified period balance.
 * Shock magnitudes apply to aggregates for the selected horizon, NOT to a daily
 * shipment schedule. A shipment delay requires transaction-level modelling.
 * No operational inventory, procurement, or accounting record is ever changed.
 */
export interface FoodScenarioAdjustments {
  productionReductionPercent: number
  importReductionPercent: number
  demandIncreasePercent: number
  openingStockLossPercent: number
}

export const ZERO_FOOD_SCENARIO: Readonly<FoodScenarioAdjustments> = {
  productionReductionPercent: 0,
  importReductionPercent: 0,
  demandIncreasePercent: 0,
  openingStockLossPercent: 0,
}

export interface FoodScenarioImpact {
  status: 'complete' | 'insufficient_data'
  sourceMode: FoodBalanceResult['sourceMode']
  commodityId: string
  fromDate: string
  toDate: string
  days: number
  simulated: true
  adjustments: FoodScenarioAdjustments
  totals: {
    baselineProjectedBalanceTonnes: number | null
    scenarioProjectedBalanceTonnes: number | null
    scenarioClosingStockTonnes: number | null
    scenarioDeficitTonnes: number | null
    scenarioCoverageDays: number | null
    changeInBalanceTonnes: number | null
    changeInDeficitTonnes: number | null
  }
  warnings: string[]
}

function roundTonnes(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

function percentage(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Invalid scenario percentage: ${label}`)
  }
  return value / 100
}

export function calculateFoodScenario(
  balance: FoodBalanceResult,
  adjustments: FoodScenarioAdjustments,
): FoodScenarioImpact {
  const p = percentage(adjustments.productionReductionPercent, 'productionReductionPercent')
  const i = percentage(adjustments.importReductionPercent, 'importReductionPercent')
  const d = percentage(adjustments.demandIncreasePercent, 'demandIncreasePercent')
  const s = percentage(adjustments.openingStockLossPercent, 'openingStockLossPercent')

  const { totals } = balance
  const ready = balance.status === 'complete' &&
    totals.openingStockTonnes !== null &&
    totals.domesticProductionTonnes !== null &&
    totals.confirmedImportsTonnes !== null &&
    totals.consumptionTonnes !== null &&
    totals.lossesTonnes !== null &&
    totals.projectedBalanceTonnes !== null &&
    totals.deficitTonnes !== null

  const warnings: string[] = [
    'WHAT-IF SIMULATION ONLY. This is an aggregate horizon sensitivity analysis, not a forecast or an executed operation.',
  ]
  if (balance.sourceMode === 'demo') {
    warnings.push('DEMO BASELINE: inputs are synthetic and are not Qatar statistics.')
  }
  if (!ready) {
    warnings.push('A complete source-backed opening stock and flow balance is required for scenario calculation.')
  }

  const result = {
    status: (ready ? 'complete' : 'insufficient_data') as FoodScenarioImpact['status'],
    sourceMode: balance.sourceMode,
    commodityId: balance.commodityId,
    fromDate: balance.fromDate,
    toDate: balance.toDate,
    days: balance.days,
    simulated: true as const,
    adjustments: { ...adjustments },
    warnings,
  }

  if (!ready) {
    return {
      ...result,
      totals: {
        baselineProjectedBalanceTonnes: totals.projectedBalanceTonnes,
        scenarioProjectedBalanceTonnes: null,
        scenarioClosingStockTonnes: null,
        scenarioDeficitTonnes: null,
        scenarioCoverageDays: null,
        changeInBalanceTonnes: null,
        changeInDeficitTonnes: null,
      },
    }
  }

  // A runtime guard makes TS narrow nullable source fields reliably.
  const opening = totals.openingStockTonnes!
  const production = totals.domesticProductionTonnes!
  const imports = totals.confirmedImportsTonnes!
  const consumption = totals.consumptionTonnes!
  const losses = totals.lossesTonnes!
  const baseline = totals.projectedBalanceTonnes!
  const baseDeficit = totals.deficitTonnes!

  const simulatedDemand = consumption * (1 + d)
  const net = roundTonnes(
    opening * (1 - s) + production * (1 - p) + imports * (1 - i) - simulatedDemand - losses,
  )
  const closing = Math.max(0, net)
  const deficit = Math.max(0, -net)
  const coverageDays = simulatedDemand > 0
    ? Math.round((closing / (simulatedDemand / balance.days)) * 10) / 10
    : null

  if (net < 0) {
    warnings.push('The scenario produces an end-of-horizon food deficit; interim stockouts are not assessed.')
  }
  if (simulatedDemand === 0) {
    warnings.push('Zero period consumption: coverage days are undefined.')
  }

  return {
    ...result,
    totals: {
      baselineProjectedBalanceTonnes: baseline,
      scenarioProjectedBalanceTonnes: net,
      scenarioClosingStockTonnes: closing,
      scenarioDeficitTonnes: deficit,
      scenarioCoverageDays: coverageDays,
      changeInBalanceTonnes: roundTonnes(net - baseline),
      changeInDeficitTonnes: roundTonnes(deficit - baseDeficit),
    },
  }
}
