/**
 * NFII resilient-purchasing decision support.
 *
 * Suggestions only, never tenders, supplier recommendations or procurement orders.
 * Risk is inferred strictly from independently reviewed organization balances.
 */
import type { FoodPosture, FoodPostureCommodity } from './food-posture'

export type ResilienceActionPriority = 'P0' | 'P1' | 'P2' | 'EVIDENCE'
export type ResilienceActionKind =
  | 'investigate_deficit'
  | 'assess_short_coverage'
  | 'review_buffer'
  | 'verify_evidence'

export interface ResilienceAction {
  commodityId: string
  name: string
  nameAr: string
  priority: ResilienceActionPriority
  kind: ResilienceActionKind
  gapTonnes: number | null
  coverageDays: number | null
  evidenceCount: number
  missingCoverage: FoodPostureCommodity['missingCoverage']
}

export interface ResilienceDecisionQueue {
  /** Assessed risk is separate from missing evidence: lack of records != no risk. */
  procurementReview: ResilienceAction[]
  evidenceReview: ResilienceAction[]
  summary: {
    p0: number
    p1: number
    p2: number
    evidence: number
    assessed: number
    total: number
  }
}

function actionFromCommodity(row: FoodPostureCommodity): ResilienceAction | null {
  const base = {
    commodityId: row.commodityId,
    name: row.name,
    nameAr: row.nameAr,
    gapTonnes: row.status === 'complete' ? row.deficitTonnes : null,
    coverageDays: row.status === 'complete' ? row.coverageDays : null,
    evidenceCount: row.evidenceSourceRefs.length,
    missingCoverage: row.missingCoverage,
  }

  // Missing or invalid evidence gets investigated, NEVER a fictitious purchase order.
  if (row.status !== 'complete' || row.band === 'unknown') {
    return { ...base, priority: 'EVIDENCE', kind: 'verify_evidence' }
  }
  if (row.band === 'critical' && (row.deficitTonnes ?? 0) > 0) {
    return { ...base, priority: 'P0', kind: 'investigate_deficit' }
  }
  if (row.band === 'critical' || row.band === 'high') {
    return { ...base, priority: 'P1', kind: 'assess_short_coverage' }
  }
  if (row.band === 'attention') {
    return { ...base, priority: 'P2', kind: 'review_buffer' }
  }
  return null
}

/**
 * Product-level triage, NOT a nationally authorized policy ranking.
 * Returns no purchasing action for missing data and no action for stable records.
 */
export function buildResilienceDecisionQueue(
  posture: FoodPosture,
): ResilienceDecisionQueue {
  if (posture.scope !== 'organization' || posture.sourceMode !== 'live') {
    throw new Error('Resilience decisions require reviewed organization live posture')
  }

  const all = posture.commodities
    .map(actionFromCommodity)
    .filter((action): action is ResilienceAction => action !== null)

  const procurementReview = all
    .filter(action => action.priority !== 'EVIDENCE')
    .sort((a, b) => {
      const rank: Record<ResilienceActionPriority, number> = {
        P0: 0, P1: 1, P2: 2, EVIDENCE: 3,
      }
      return rank[a.priority] - rank[b.priority] ||
        (b.gapTonnes ?? 0) - (a.gapTonnes ?? 0) ||
        a.name.localeCompare(b.name, 'en')
    })

  const evidenceReview = all
    .filter(action => action.priority === 'EVIDENCE')
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  return {
    procurementReview,
    evidenceReview,
    summary: {
      p0: procurementReview.filter(action => action.priority === 'P0').length,
      p1: procurementReview.filter(action => action.priority === 'P1').length,
      p2: procurementReview.filter(action => action.priority === 'P2').length,
      evidence: evidenceReview.length,
      assessed: posture.assessedCount,
      total: posture.totalCommodities,
    },
  }
}
