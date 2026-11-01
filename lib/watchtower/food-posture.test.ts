import { describe, expect, it } from 'vitest'
import { calculateFoodBalance } from '@/lib/food-security/balance'
import { buildDemoFoodBalanceInput } from '@/lib/food-security/demo-data'
import { buildResilienceDecisionQueue } from './resilience-queue'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import { buildFoodPosture, buildIllustrativeFoodPosture, type FoodPostureEntry } from './food-posture'

const start = '2026-11-01'
const end = '2026-11-30'
const tomato = COMMODITY_CATALOG.find(x => x.id === 'tomato')!
const rice = COMMODITY_CATALOG.find(x => x.id === 'rice')!

function makeEntry(commodity = tomato): FoodPostureEntry {
  const synthetic = buildDemoFoodBalanceInput(commodity.id, start, 30)
  // Unit-test fixture only; production endpoint never transforms DEMO into LIVE.
  return {
    commodity,
    balance: calculateFoodBalance({ ...synthetic, sourceMode: 'live' }),
    latestReviewedAt: '2026-10-31T12:00:00Z',
  }
}

function evaluate(entries: FoodPostureEntry[], pendingReviewCount: number | null = 3) {
  return buildFoodPosture({
    organizationId: '11111111-1111-4111-8111-111111111111',
    fromDate: start, toDate: end, days: 30, pendingReviewCount,
    generatedAt: '2026-10-31T12:30:00Z', entries,
  })
}

describe('Watchtower source-backed organization food posture', () => {
  it('rejects mixing DEMO balances or the wrong period', () => {
    const entry = makeEntry()
    const demo = {
      ...entry,
      balance: { ...entry.balance, sourceMode: 'demo' as const },
    }
    expect(() => evaluate([demo])).toThrow('source does not match')
    const wrongHorizon = {
      ...entry,
      balance: { ...entry.balance, toDate: '2026-12-01' },
    }
    expect(() => evaluate([wrongHorizon])).toThrow('source does not match')
  })

  it('never claims an all-clear when evidence is missing', () => {
    const entry = makeEntry()
    const incomplete = {
      ...entry, balance: {
        ...entry.balance,
        status: 'insufficient_data' as const,
        totals: { ...entry.balance.totals, projectedBalanceTonnes: null, projectedCoverageDays: null },
        evidence: {
          ...entry.balance.evidence,
          missingCoverage: ['consumption' as const],
        },
      },
    }
    const view = evaluate([incomplete])
    expect(view.assessedCount).toBe(0)
    expect(view.deficitCount).toBe(0)
    expect(view.unknownCount).toBe(1)
    expect(view.commodities[0].reason).toBe('missing_evidence')
  })

  it('prioritizes a verified deficit and does not count missing records as shortages', () => {
    const entry = makeEntry(rice)
    const negative = {
      ...entry, balance: {
        ...entry.balance,
        totals: {
          ...entry.balance.totals,
          projectedBalanceTonnes: -15,
          deficitTonnes: 15,
          projectedCoverageDays: 0,
        },
      },
    }
    const unknown = {
      ...makeEntry(), balance: {
        ...makeEntry().balance,
        status: 'insufficient_data' as const,
      },
    }
    const view = evaluate([unknown, negative], 12)
    expect(view.commodities.map(x => x.commodityId)).toEqual(['rice', 'tomato'])
    expect(view.commodities[0].band).toBe('critical')
    expect(view.deficitCount).toBe(1)
    expect(view.pendingReviewCount).toBe(12)
    expect(view.unknownCount).toBe(1)
  })

  it('classifies 7/14/30-day bands as documented heuristics', () => {
    const entry = makeEntry()
    function withCoverage(days: number) {
      return {
        ...entry, balance: {
          ...entry.balance,
          totals: { ...entry.balance.totals,
            projectedBalanceTonnes: 10, deficitTonnes: 0, projectedCoverageDays: days },
        },
      }
    }
    expect(evaluate([withCoverage(6.9)]).commodities[0].band).toBe('critical')
    expect(evaluate([withCoverage(7)]).commodities[0].band).toBe('high')
    expect(evaluate([withCoverage(14)]).commodities[0].band).toBe('attention')
    expect(evaluate([withCoverage(30)]).commodities[0].band).toBe('stable')
    expect(evaluate([withCoverage(7)]).caveats.join(' ')).toContain('not official government policy')
  })

  it('sets import inflow share separately from national import dependence', () => {
    const row = evaluate([makeEntry(rice)]).commodities[0]
    expect(row.importShareOfInflowsPercent).toBe(100)
    const caveat = evaluate([makeEntry(rice)]).caveats.join(' ')
    expect(caveat).toContain('not national import dependency')
  })

  it('leaves zero-demand coverage undefined instead of classifying it as safe', () => {
    const entry = makeEntry()
    const noDemand = {
      ...entry, balance: { ...entry.balance,
        totals: { ...entry.balance.totals,
          consumptionTonnes: 0, projectedCoverageDays: null },
      },
    }
    expect(evaluate([noDemand]).commodities[0].band).toBe('unknown')
    expect(evaluate([noDemand]).commodities[0].reason).toBe('no_demand_baseline')
  })

  it('reports no risk count inflation from unavailable commodities', () => {
    const entry = makeEntry()
    const noData = { ...entry, balance: { ...entry.balance,
      status: 'insufficient_data' as const,
    }}
    const view = evaluate([noData], null)
    expect(view.criticalCount).toBe(0)
    expect(view.highCount).toBe(0)
    expect(view.assessedCount).toBe(0)
    expect(view.pendingReviewCount).toBeNull()
    expect(view.scope).toBe('organization')
    expect(view.sourceMode).toBe('live')
  })
})


describe('Illustrative food posture isolation',()=>{
  it('derives visible commodity examples without treating them as reviewed data',()=>{
    const p=buildIllustrativeFoodPosture(start,30)
    expect(p.sourceMode).toBe('demo')
    expect(p.scope).toBe('illustrative')
    expect(p.totalCommodities).toBe(COMMODITY_CATALOG.length)
    expect(p.assessedCount).toBe(COMMODITY_CATALOG.length)
    expect(p.commodities.every(c=>c.evidenceSourceRefs.some(r=>r.startsWith('SIMQA26/SYNTHETIC')))).toBe(true)
    expect(p.caveats.join(' ')).toContain('ILLUSTRATIVE EXAMPLE ONLY')
    expect(p.pendingReviewCount).toBeNull()
  })
  it('does not permit demo posture to enter the operational procurement decision queue',()=>{
    const preview=buildIllustrativeFoodPosture(start,30)
    expect(()=>buildResilienceDecisionQueue(preview)).toThrow('reviewed organization live')
  })
})
