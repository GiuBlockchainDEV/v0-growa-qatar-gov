/**
 * NFII food availability accounting, v1.
 *
 * A stock snapshot is an end-of-day inventory position. Only movements after
 * that snapshot are applied; a movement cannot also be counted as opening stock.
 * All quantities are metric tonnes (t). No LLM is involved in calculations.
 *
 * Coverage declarations matter: an absence of transactions is NOT proof that
 * the corresponding flow is zero. Missing completeness gives a null total.
 */
export type FoodFlowType = 'domestic_production' | 'confirmed_import' | 'consumption' | 'loss'
export type FoodDataMode = 'observed' | 'estimated' | 'forecast' | 'demo'
export type FoodSourceMode = 'live' | 'demo'

export interface FoodStockSnapshot {
  id: string
  asOfDate: string
  usableTonnes: number
  sourceRef: string
  dataMode: FoodDataMode
}

export interface FoodBalanceFlow {
  id: string
  externalKey: string
  flowType: FoodFlowType
  effectiveDate: string
  quantityTonnes: number
  sourceRef: string
  dataMode: FoodDataMode
}

export interface FoodCoverage {
  id: string
  flowType: FoodFlowType
  startDate: string
  endDate: string
  status: 'complete' | 'partial'
  sourceRef: string
  dataMode: FoodDataMode
}

export interface FoodBalanceInput {
  commodityId: string
  fromDate: string
  toDate: string
  sourceMode: FoodSourceMode
  stocks: readonly FoodStockSnapshot[]
  flows: readonly FoodBalanceFlow[]
  coverage: readonly FoodCoverage[]
}

export interface FoodBalanceResult {
  commodityId: string
  fromDate: string
  toDate: string
  days: number
  sourceMode: FoodSourceMode
  status: 'complete' | 'insufficient_data'
  totals: {
    openingStockTonnes: number | null
    domesticProductionTonnes: number | null
    confirmedImportsTonnes: number | null
    consumptionTonnes: number | null
    lossesTonnes: number | null
    projectedBalanceTonnes: number | null
    projectedClosingStockTonnes: number | null
    deficitTonnes: number | null
    surplusTonnes: number | null
    projectedCoverageDays: number | null
  }
  evidence: {
    stockSnapshotId: string | null
    flowIds: string[]
    coverageIds: string[]
    sourceRefs: string[]
    missingCoverage: FoodFlowType[]
    warnings: string[]
  }
}

const DAY = 86_400_000
const REQUIRED_FLOWS: readonly FoodFlowType[] = [
  'domestic_production', 'confirmed_import', 'consumption', 'loss',
]

function dayIndex(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`)
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`Invalid calendar date: ${isoDate}`)
  }
  return Math.round(ms / DAY)
}

export function addFoodDays(isoDate: string, days: number): string {
  if (!Number.isInteger(days) || Math.abs(days) > 3660) throw new Error('Invalid day offset')
  return new Date((dayIndex(isoDate) + days) * DAY).toISOString().slice(0, 10)
}

function safeQuantity(amount: number, label: string): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    throw new Error(`Invalid non-negative tonne quantity: ${label}`)
  }
  return amount
}

function roundTonnes(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

/** Complete declarations may overlap; they must cover EVERY day of the window. */
function hasCompleteCoverage(
  flowType: FoodFlowType,
  from: number,
  to: number,
  declarations: readonly FoodCoverage[],
): boolean {
  const intervals = declarations
    .filter((entry) => entry.flowType === flowType && entry.status === 'complete')
    .map((entry) => [dayIndex(entry.startDate), dayIndex(entry.endDate)] as const)
    .sort((a, b) => a[0] - b[0])
  let nextUncoveredDay = from
  for (const [start, end] of intervals) {
    if (end < start) throw new Error('Coverage end date precedes start date')
    if (start > nextUncoveredDay) break
    if (end >= nextUncoveredDay) nextUncoveredDay = end + 1
    if (nextUncoveredDay > to) return true
  }
  return false
}

export function calculateFoodBalance(input: FoodBalanceInput): FoodBalanceResult {
  const from = dayIndex(input.fromDate)
  const to = dayIndex(input.toDate)
  const days = to - from + 1
  if (days < 1 || days > 180) throw new Error('Balance interval must be 1-180 days')
  if (!input.commodityId.trim()) throw new Error('Commodity is required')

  const seenExternalKeys = new Set<string>()
  for (const flow of input.flows) {
    dayIndex(flow.effectiveDate)
    safeQuantity(flow.quantityTonnes, flow.id)
    if (!flow.externalKey.trim() || seenExternalKeys.has(flow.externalKey)) {
      throw new Error('Duplicate or missing source movement key')
    }
    seenExternalKeys.add(flow.externalKey)
  }
  for (const stock of input.stocks) {
    dayIndex(stock.asOfDate)
    safeQuantity(stock.usableTonnes, stock.id)
  }
  for (const entry of input.coverage) {
    if (dayIndex(entry.endDate) < dayIndex(entry.startDate)) {
      throw new Error('Coverage end date precedes start date')
    }
  }

  const snapshot = [...input.stocks]
    .filter((stock) => dayIndex(stock.asOfDate) < from)
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0] ?? null

  // A snapshot captures closing stock on its asOfDate. Only future flows count.
  const inWindow = input.flows.filter((flow) => {
    const day = dayIndex(flow.effectiveDate)
    return day >= from && day <= to && (!snapshot || day > dayIndex(snapshot.asOfDate))
  })

  const missingCoverage = REQUIRED_FLOWS.filter(
    (type) => !hasCompleteCoverage(type, from, to, input.coverage),
  )
  const sumByType = (type: FoodFlowType): number | null => {
    if (missingCoverage.includes(type)) return null
    return roundTonnes(inWindow
      .filter((flow) => flow.flowType === type)
      .reduce((total, flow) => total + flow.quantityTonnes, 0))
  }

  const production = sumByType('domestic_production')
  const imports = sumByType('confirmed_import')
  const consumption = sumByType('consumption')
  const losses = sumByType('loss')
  // An older snapshot cannot be the opening position without intervening
  // movements, which this horizon-limited calculation does not retrieve.
  const opening = snapshot && dayIndex(snapshot.asOfDate) === from - 1
    ? snapshot.usableTonnes
    : null

  const complete = opening !== null && production !== null && imports !== null
    && consumption !== null && losses !== null

  const projectedBalance = complete
    ? roundTonnes(opening + production + imports - consumption - losses)
    : null
  const closing = projectedBalance === null ? null : Math.max(0, projectedBalance)
  const deficit = projectedBalance === null ? null : Math.max(0, -projectedBalance)
  const surplus = projectedBalance === null ? null : Math.max(0, projectedBalance)
  const coverageDays = closing === null || consumption === null || consumption <= 0
    ? null
    : Math.round((closing / (consumption / days)) * 10) / 10

  const warnings: string[] = []
  if (!snapshot) warnings.push('Missing opening usable inventory snapshot for the day preceding the selected start date.')
  else if (opening === null) warnings.push('Opening snapshot is stale: a prior-day inventory position is required.')
  if (missingCoverage.length) warnings.push(`Missing complete date coverage: ${missingCoverage.join(', ')}.`)
  if (complete && consumption === 0) warnings.push('Consumption is zero; days of coverage cannot be estimated.')
  if (input.sourceMode === 'demo') warnings.push('SIMULATED DATA ONLY: not actual Qatar food security figures.')
  if (projectedBalance !== null && projectedBalance < 0) {
    warnings.push('Projected deficit: physical closing stock is floored at zero.')
  }

  const sourceRefs = [...new Set([
    ...(snapshot ? [snapshot.sourceRef] : []),
    ...inWindow.map((flow) => flow.sourceRef),
    ...input.coverage.map((entry) => entry.sourceRef),
  ])]

  return {
    commodityId: input.commodityId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    days,
    sourceMode: input.sourceMode,
    status: complete ? 'complete' : 'insufficient_data',
    totals: {
      openingStockTonnes: opening,
      domesticProductionTonnes: production,
      confirmedImportsTonnes: imports,
      consumptionTonnes: consumption,
      lossesTonnes: losses,
      projectedBalanceTonnes: projectedBalance,
      projectedClosingStockTonnes: closing,
      deficitTonnes: deficit,
      surplusTonnes: surplus,
      projectedCoverageDays: coverageDays,
    },
    evidence: {
      stockSnapshotId: snapshot?.id ?? null,
      flowIds: inWindow.map((flow) => flow.id),
      coverageIds: input.coverage.map((entry) => entry.id),
      sourceRefs,
      missingCoverage,
      warnings,
    },
  }
}
