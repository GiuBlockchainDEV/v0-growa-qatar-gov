import type { FoodBalanceResult } from '@/lib/food-security/balance'
import type { FoodScenarioImpact } from '@/lib/food-security/scenario'

export interface BalanceChartModel {
  inflows: readonly [number, number, number]
  outflows: readonly [number, number]
  availableTonnes: number
  requiredTonnes: number
  netTonnes: number
  closingTonnes: number
  deficitTonnes: number
  maxTonnes: number
  bridge: readonly BalanceBridgeStep[]
  minBridge: number
  maxBridge: number
}
export interface BalanceBridgeStep {
  key: 'opening' | 'domestic' | 'imports' | 'consumption' | 'losses' | 'net'
  start: number
  end: number
  amount: number
}
export interface ScenarioChartModel {
  baselineNetTonnes: number
  scenarioNetTonnes: number
  maxAbsNetTonnes: number
  baselineCoverageDays: number | null
  scenarioCoverageDays: number | null
  coverageAxisDays: number
  scenarioDeficitTonnes: number
}

function valid(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

/** Charts are deliberately unavailable when accounting evidence is incomplete.
 * Missing quantities are not charted as zero, and administrative shipment
 * records are never added to the food-balance totals.
 */
export function buildBalanceChartModel(balance: FoodBalanceResult | null): BalanceChartModel | null {
  if (!balance || balance.status !== 'complete') return null
  const t = balance.totals
  const fields = [
    t.openingStockTonnes, t.domesticProductionTonnes, t.confirmedImportsTonnes,
    t.consumptionTonnes, t.lossesTonnes, t.projectedBalanceTonnes,
    t.projectedClosingStockTonnes, t.deficitTonnes,
  ]
  if (!fields.every(valid)) return null
  const [opening, domestic, imports, consumption, losses, net, closing, deficit] =
    fields as number[]
  if ([opening, domestic, imports, consumption, losses, closing, deficit]
    .some(n => n < 0)) return null
  const supply = round(opening + domestic + imports)
  const use = round(consumption + losses)
  const states: BalanceBridgeStep[] = []
  let current = 0
  const add = (key: BalanceBridgeStep['key'], amount: number) => {
    const start = current
    current = round(current + amount)
    states.push({key, start, end: current, amount})
  }
  add('opening', opening)
  add('domestic', domestic)
  add('imports', imports)
  add('consumption', -consumption)
  add('losses', -losses)
  states.push({key:'net',start:0,end:net,amount:net})
  const points = states.flatMap(step=>[step.start,step.end,0])
  return {
    inflows: [opening,domestic,imports],
    outflows: [consumption,losses],
    availableTonnes:supply, requiredTonnes:use,
    netTonnes:net,closingTonnes:closing,deficitTonnes:deficit,
    maxTonnes:Math.max(1,supply,use),
    bridge:states,
    minBridge:Math.min(...points),
    maxBridge:Math.max(...points),
  }
}

/** Both values are aggregate end-of-horizon net positions, NOT a daily trace. */
export function buildScenarioChartModel(
  scenario: FoodScenarioImpact | null,
  balance: FoodBalanceResult | null,
): ScenarioChartModel | null {
  if (!scenario || !balance || scenario.status !== 'complete' ||
      balance.status !== 'complete' || scenario.commodityId !== balance.commodityId ||
      scenario.days !== balance.days || scenario.sourceMode !== balance.sourceMode ||
      scenario.fromDate !== balance.fromDate || scenario.toDate !== balance.toDate) return null
  const a = scenario.totals.baselineProjectedBalanceTonnes
  const b = scenario.totals.scenarioProjectedBalanceTonnes
  const deficit = scenario.totals.scenarioDeficitTonnes
  if (!valid(a) || !valid(b) || !valid(deficit)) return null
  const baseCoverage = balance.totals.projectedCoverageDays
  const stressCoverage = scenario.totals.scenarioCoverageDays
  const baselineCoverageDays = valid(baseCoverage) && baseCoverage >= 0 ? baseCoverage : null
  const scenarioCoverageDays = valid(stressCoverage) && stressCoverage >= 0 ? stressCoverage : null
  return {
    baselineNetTonnes:a,scenarioNetTonnes:b,
    maxAbsNetTonnes:Math.max(1,Math.abs(a),Math.abs(b)),
    baselineCoverageDays,scenarioCoverageDays,
    coverageAxisDays:Math.max(30,Math.ceil(Math.max(
      baselineCoverageDays??0,scenarioCoverageDays??0,
    )/10)*10),
    scenarioDeficitTonnes:deficit,
  }
}

/** Agent progress is separate from quantitative scenario outcomes. */
export function agentProgressPercent(completed:number,total:number):number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0
  return Math.round(100*Math.min(1,Math.max(0,completed/total)))
}
