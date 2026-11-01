import {describe,expect,it} from 'vitest'
import {calculateFoodBalance} from '@/lib/food-security/balance'
import {buildQatarIllustrativeFoodBalanceInput} from '@/lib/food-security/demo-data'
import {ZERO_FOOD_SCENARIO,type FoodScenarioAdjustments} from '@/lib/food-security/scenario'
import {previewOperationsSnapshot} from './operations-types'
import {simulateCommodityAgents} from './agent-operational-simulation'
import {buildAgentFinalRecommendation} from './agent-decision'

const today='2026-11-01'
const operations=previewOperationsSnapshot(today)

const decide=(commodityId:string,shocks:FoodScenarioAdjustments={...ZERO_FOOD_SCENARIO})=>{
  const food=calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput(commodityId,today,30))
  const result=simulateCommodityAgents({commodityId,balance:food,operations,today,shocks})
  return {result,decision:buildAgentFinalRecommendation(result)}
}

describe('Final executive recommendation across agent specialists',()=>{
  it('makes the urgent deficit verdict explicit and quantifies the gap for investigation',()=>{
    const {decision,result}=decide('tomato',{
      productionReductionPercent:40,
      importReductionPercent:65,
      demandIncreasePercent:20,
      openingStockLossPercent:10,
    })
    expect(result.scenario.totals.scenarioDeficitTonnes).toBeGreaterThan(0)
    expect(decision.priority).toBe('urgent')
    expect(decision.code).toBe('investigate_shortage')
    expect(decision.gapForReviewTonnes).toBe(result.scenario.totals.scenarioDeficitTonnes)
    expect(decision.headlineEn).toContain('tonnes')
    expect(decision.reasonEn).toContain('scenario')
    expect(decision.options.map(o=>o.id)).toEqual(['procurement','logistics','reserves'])
    expect(decision.nextStepEn).toContain('human approval')
    expect(decision.ownerEn).toContain('Procurement')
  })

  it('separates low coverage from a positive tonnage shortage',()=>{
    const {decision,result}=decide('tomato')
    expect(result.scenario.totals.scenarioDeficitTonnes).toBe(0)
    expect(decision.gapForReviewTonnes).toBeNull()
    expect(decision.code).toBe('protect_buffer')
    expect(decision.priority).toBe('high')
    expect(decision.coverageDays).toBeLessThan(14)
    expect(decision.headlineEn).not.toContain('tonnes')
  })

  it('recommends monitoring with no additional purchase when coverage is sufficient',()=>{
    const {decision}=decide('wheat')
    expect(decision.priority).toBe('monitor')
    expect(decision.code).toBe('continue_monitoring')
    expect(decision.gapForReviewTonnes).toBeNull()
    expect(decision.headlineEn).toContain('no additional purchase')
  })

  it('distinguishes mid-range replenishment attention from critical shortage',()=>{
    const {decision}=decide('rice')
    expect(decision.code).toBe('review_replenishment')
    expect(decision.priority).toBe('attention')
    expect(decision.coverageDays).toBeGreaterThanOrEqual(14)
    expect(decision.coverageDays).toBeLessThan(30)
    expect(decision.gapForReviewTonnes).toBeNull()
  })

  it('blocks all operational advice when reviewed source inputs are incomplete',()=>{
    const balance=calculateFoodBalance({
      ...buildQatarIllustrativeFoodBalanceInput('rice',today,30),
      stocks:[],
    })
    const result=simulateCommodityAgents({
      commodityId:'rice',balance,operations,today,
      shocks:{...ZERO_FOOD_SCENARIO},
    })
    const decision=buildAgentFinalRecommendation(result)
    expect(decision.code).toBe('request_evidence')
    expect(decision.priority).toBe('blocked')
    expect(decision.gapForReviewTonnes).toBeNull()
    expect(decision.coverageDays).toBeNull()
    expect(decision.options.map(o=>o.id)).toContain('source')
    expect(decision.headlineEn).toContain('Do not authorize')
  })

  it('discloses shipment exceptions separately, never as additional food inventory',()=>{
    const modified={
      ...operations,
      shipments: operations.shipments.map(s=>
        s.shipment_ref?.includes('RICE-PK')?{...s,status:'delayed' as const}:s),
    }
    const balance=calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput('rice',today,30))
    const result=simulateCommodityAgents({
      commodityId:'rice',balance,operations:modified,today,shocks:{...ZERO_FOOD_SCENARIO},
    })
    const decision=buildAgentFinalRecommendation(result)
    expect(decision.secondaryEn.some(s=>s.includes('delayed shipment'))).toBe(true)
    expect(decision.scenarioDeficitTonnes).toBe(0)
    expect(decision.gapForReviewTonnes).toBeNull()
  })

  it('never turns a recommendation into a real or simulated database authorization',()=>{
    const {decision}=decide('tomato',{
      productionReductionPercent:40,importReductionPercent:65,
      demandIncreasePercent:20,openingStockLossPercent:10,
    })
    expect(decision.requiredHumanApproval).toBe(true)
    expect(decision.executionStatus).toBe('not_executed')
    expect(decision.evidenceSource).toBe('illustrative')
    expect(decision.options.every(o=>Boolean(o.en&&o.ar))).toBe(true)
    expect(decision.ownerAr.length).toBeGreaterThan(0)
    expect(decision.nextStepAr.length).toBeGreaterThan(0)
  })
})
