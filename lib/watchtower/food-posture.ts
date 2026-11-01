/**
 * Deterministic source-backed commodity triage. Organization scope only.
 * Coverage thresholds are product screening heuristics, NOT government policy.
 */
import { addFoodDays, calculateFoodBalance, type FoodBalanceResult } from '@/lib/food-security/balance'
import { buildQatarIllustrativeFoodBalanceInput } from '@/lib/food-security/demo-data'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import type { CommodityDefinition } from '@/lib/platform/commodity-catalog'

export type FoodRiskBand = 'critical' | 'high' | 'attention' | 'stable' | 'unknown'
export type FoodRiskReason = 'deficit' | 'below_7_days' | 'below_14_days' |
  'below_30_days' | 'assessed' | 'missing_evidence' | 'no_demand_baseline'

export interface FoodPostureCommodity {
  commodityId: string
  name: string
  nameAr: string
  band: FoodRiskBand
  reason: FoodRiskReason
  status: FoodBalanceResult['status']
  projectedBalanceTonnes: number | null
  deficitTonnes: number | null
  coverageDays: number | null
  domesticProductionTonnes: number | null
  confirmedImportsTonnes: number | null
  importShareOfInflowsPercent: number | null
  missingCoverage: FoodBalanceResult['evidence']['missingCoverage']
  evidenceSourceRefs: string[]
  latestReviewedAt: string | null
}

export interface FoodPosture {
  schemaVersion: 1
  scope: 'organization' | 'illustrative'
  sourceMode: 'live' | 'demo'
  organizationId: string
  generatedAt: string
  fromDate: string
  toDate: string
  days: number
  totalCommodities: number
  assessedCount: number
  deficitCount: number
  criticalCount: number
  highCount: number
  attentionCount: number
  unknownCount: number
  pendingReviewCount: number | null
  latestReviewedAt: string | null
  commodities: FoodPostureCommodity[]
  caveats: string[]
}

export interface FoodPostureEntry {
  commodity: CommodityDefinition
  balance: FoodBalanceResult
  latestReviewedAt: string | null
}

function classify(balance: FoodBalanceResult): { band: FoodRiskBand; reason: FoodRiskReason } {
  if (balance.status !== 'complete') {
    return { band: 'unknown', reason: 'missing_evidence' }
  }
  const net = balance.totals.projectedBalanceTonnes
  const consumption = balance.totals.consumptionTonnes
  const coverage = balance.totals.projectedCoverageDays
  if (net === null || consumption === null) {
    return { band: 'unknown', reason: 'missing_evidence' }
  }
  if (net < 0) return { band: 'critical', reason: 'deficit' }
  if (consumption <= 0 || coverage === null) {
    return { band: 'unknown', reason: 'no_demand_baseline' }
  }
  if (coverage < 7) return { band: 'critical', reason: 'below_7_days' }
  if (coverage < 14) return { band: 'high', reason: 'below_14_days' }
  if (coverage < 30) return { band: 'attention', reason: 'below_30_days' }
  return { band: 'stable', reason: 'assessed' }
}

const order: Record<FoodRiskBand, number> = {
  critical: 0, high: 1, attention: 2, unknown: 3, stable: 4,
}

export function buildFoodPosture(input: {
  organizationId: string
  fromDate: string
  toDate: string
  days: number
  generatedAt: string
  pendingReviewCount: number | null
  entries: readonly FoodPostureEntry[]
  /** Explicitly chosen in-memory fixture only. Never authorized live statistics. */
  preview?: boolean
}): FoodPosture {
  const commodities = input.entries.map(({ commodity, balance, latestReviewedAt }): FoodPostureCommodity => {
    if (balance.sourceMode !== (input.preview ? 'demo' : 'live') || balance.commodityId !== commodity.id ||
        balance.fromDate !== input.fromDate || balance.toDate !== input.toDate) {
      throw new Error('Food posture source does not match the requested scope')
    }
    const { band, reason } = classify(balance)
    const production = balance.totals.domesticProductionTonnes
    const imports = balance.totals.confirmedImportsTonnes
    const totalInflows = production !== null && imports !== null ? production + imports : null
    return {
      commodityId: commodity.id,
      name: commodity.name,
      nameAr: commodity.nameAr,
      band, reason,
      status: balance.status,
      projectedBalanceTonnes: balance.totals.projectedBalanceTonnes,
      deficitTonnes: balance.totals.deficitTonnes,
      coverageDays: balance.totals.projectedCoverageDays,
      domesticProductionTonnes: production,
      confirmedImportsTonnes: imports,
      importShareOfInflowsPercent: totalInflows !== null && totalInflows > 0
        ? Math.round(1000 * imports! / totalInflows) / 10 : null,
      missingCoverage: balance.evidence.missingCoverage,
      evidenceSourceRefs: balance.evidence.sourceRefs,
      latestReviewedAt,
    }
  }).sort((a, b) =>
    order[a.band] - order[b.band] || a.name.localeCompare(b.name, 'en')
  )

  const dates = commodities.map(c => c.latestReviewedAt).filter((v): v is string => Boolean(v))
  return {
    schemaVersion: 1,
    scope: input.preview ? 'illustrative' : 'organization',
    sourceMode: input.preview ? 'demo' : 'live',
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    fromDate: input.fromDate,
    toDate: input.toDate,
    days: input.days,
    totalCommodities: commodities.length,
    assessedCount: commodities.filter(c => c.status === 'complete').length,
    deficitCount: commodities.filter(c => c.status === 'complete' && (c.deficitTonnes ?? 0) > 0).length,
    criticalCount: commodities.filter(c => c.band === 'critical').length,
    highCount: commodities.filter(c => c.band === 'high').length,
    attentionCount: commodities.filter(c => c.band === 'attention').length,
    unknownCount: commodities.filter(c => c.band === 'unknown').length,
    pendingReviewCount: input.pendingReviewCount,
    latestReviewedAt: dates.length ? dates.sort().at(-1) ?? null : null,
    commodities,
    caveats: [
      ...(input.preview ? ['ILLUSTRATIVE EXAMPLE ONLY. These commodity balances are generated from synthetic local fixtures and are NOT verified Qatar statistics or operational records.'] : ['ORGANIZATION-SCOPED reviewed records, not certified Qatar national statistics.']),
      'Risk bands use 7/14/30-day screening thresholds, not official government policy.',
      'Import share measures planned inflows only; it is not national import dependency.',
      'Coverage days are projected at the end of the period, not a daily stockout model.',
      'Missing or unreviewed information is never interpreted as zero or as proof of safety.',
    ],
  }
}


/**
 * Reuse the already-shipped demo food-balance engine when Supabase is empty
 * or unavailable. Never insert, review or represent these values as live.
 */
export function buildIllustrativeFoodPosture(fromDate: string, days: 7 | 30 | 90 | 180): FoodPosture {
  const toDate = addFoodDays(fromDate, days - 1)
  const entries: FoodPostureEntry[] = COMMODITY_CATALOG.map(commodity => ({
    commodity,
    balance: calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput(commodity.id, fromDate, days)),
    latestReviewedAt: null,
  }))
  return buildFoodPosture({
    preview: true,
    organizationId: 'illustrative-only',
    fromDate, toDate, days,
    generatedAt: new Date().toISOString(),
    pendingReviewCount: null,
    entries,
  })
}
