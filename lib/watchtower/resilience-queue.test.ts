import { describe, expect, it } from 'vitest'
import type { FoodPosture, FoodPostureCommodity } from './food-posture'
import { buildResilienceDecisionQueue } from './resilience-queue'

const scope = '11111111-1111-4111-8111-111111111111'
function row(id: string, status: FoodPostureCommodity['status'],
             band: FoodPostureCommodity['band'],
             deficitTonnes: number | null,
             coverageDays: number | null): FoodPostureCommodity {
  return {
    commodityId: id,
    name: id,
    nameAr: id,
    status, band, reason: status === 'complete' ? 'assessed' : 'missing_evidence',
    deficitTonnes, coverageDays,
    projectedBalanceTonnes: status === 'complete' ? 1 : null,
    domesticProductionTonnes: status === 'complete' ? 10 : null,
    confirmedImportsTonnes: status === 'complete' ? 10 : null,
    importShareOfInflowsPercent: status === 'complete' ? 50 : null,
    evidenceSourceRefs: status === 'complete' ? ['source:verified'] : [],
    latestReviewedAt: status === 'complete' ? '2026-10-31T12:00:00Z' : null,
    missingCoverage: status === 'complete' ? [] : ['consumption'],
  }
}
function posture(commodities: FoodPostureCommodity[]): FoodPosture {
  return {
    schemaVersion: 1,
    sourceMode: 'live',
    scope: 'organization',
    organizationId: scope,
    generatedAt: '2026-10-31T13:00:00Z',
    fromDate: '2026-10-31',
    toDate: '2026-11-29',
    days: 30,
    totalCommodities: commodities.length,
    assessedCount: commodities.filter(c => c.status === 'complete').length,
    deficitCount: commodities.filter(c => c.status === 'complete' && (c.deficitTonnes ?? 0) > 0).length,
    criticalCount: commodities.filter(c => c.band === 'critical').length,
    highCount: commodities.filter(c => c.band === 'high').length,
    attentionCount: commodities.filter(c => c.band === 'attention').length,
    unknownCount: commodities.filter(c => c.band === 'unknown').length,
    pendingReviewCount: 3,
    latestReviewedAt: null,
    commodities,
    caveats: [],
  }
}

describe('NFII resilient purchasing triage', () => {
  it('prioritizes a complete verified deficit without creating orders', () => {
    const queue = buildResilienceDecisionQueue(posture([
      row('rice', 'complete', 'critical', 120, 0),
      row('tomato', 'complete', 'attention', 0, 24),
    ]))
    expect(queue.summary.p0).toBe(1)
    expect(queue.procurementReview[0]).toMatchObject({
      commodityId: 'rice', priority: 'P0', kind: 'investigate_deficit', gapTonnes: 120,
    })
    expect('purchaseOrder' in queue.procurementReview[0]).toBe(false)
    expect(queue.summary.p2).toBe(1)
  })

  it('flags short coverage for assessment, not a speculative purchase', () => {
    const queue = buildResilienceDecisionQueue(posture([
      row('milk', 'complete', 'critical', 0, 6),
      row('wheat', 'complete', 'high', 0, 12),
    ]))
    expect(queue.procurementReview.map(x => x.priority)).toEqual(['P1', 'P1'])
    expect(queue.procurementReview.every(x => x.kind === 'assess_short_coverage')).toBe(true)
  })

  it('separates evidence gaps from asserted supply shortages', () => {
    const queue = buildResilienceDecisionQueue(posture([
      row('rice', 'insufficient_data', 'unknown', null, null),
      row('tomato', 'insufficient_data', 'critical', null, null),
    ]))
    expect(queue.summary.evidence).toBe(2)
    expect(queue.summary.p0).toBe(0)
    expect(queue.procurementReview).toEqual([])
    expect(queue.evidenceReview.every(x => x.gapTonnes === null)).toBe(true)
    expect(queue.evidenceReview[0].missingCoverage).toEqual(['consumption'])
  })

  it('shows no decision actions for stable assessed commodities', () => {
    const queue = buildResilienceDecisionQueue(posture([
      row('tomato', 'complete', 'stable', 0, 120),
    ]))
    expect(queue.procurementReview).toEqual([])
    expect(queue.evidenceReview).toEqual([])
    expect(queue.summary.assessed).toBe(1)
  })

  it('sorts urgency before tonnage and orders equal priorities by gap', () => {
    const queue = buildResilienceDecisionQueue(posture([
      row('wheat', 'complete', 'attention', 0, 22),
      row('rice', 'complete', 'critical', 50, 0),
      row('milk', 'complete', 'critical', 150, 0),
      row('tomato', 'complete', 'high', 0, 9),
    ]))
    expect(queue.procurementReview.map(x => x.commodityId)).toEqual([
      'milk', 'rice', 'tomato', 'wheat',
    ])
  })

  it('rejects artificial DEMO or unauthorized federation scope', () => {
    expect(() => buildResilienceDecisionQueue({
      ...posture([]), sourceMode: 'demo',
    } as unknown as FoodPosture)).toThrow('reviewed organization live')
    expect(() => buildResilienceDecisionQueue({
      ...posture([]), scope: 'national',
    } as unknown as FoodPosture)).toThrow('reviewed organization live')
  })
})
