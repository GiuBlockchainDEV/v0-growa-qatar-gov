import {describe,expect,it} from 'vitest'
import {calculateFoodBalance} from '@/lib/food-security/balance'
import {buildQatarIllustrativeFoodBalanceInput} from '@/lib/food-security/demo-data'
import {previewOperationsSnapshot} from './operations-types'
import {simulateCommodityAgents,agentRisk} from './agent-operational-simulation'
import {ZERO_FOOD_SCENARIO} from '@/lib/food-security/scenario'
import {AGENT_REGISTRY} from '@/lib/ai/agents/registry'

const from='2026-11-01'
const ops=previewOperationsSnapshot(from)
const balance=(commodityId:string)=>calculateFoodBalance(
  buildQatarIllustrativeFoodBalanceInput(commodityId,from,30))
const run=(commodityId:string,shocks={...ZERO_FOOD_SCENARIO})=>
  simulateCommodityAgents({commodityId,balance:balance(commodityId),operations:ops,today:from,shocks})

describe('Deterministic agent operating rehearsal',()=>{
  it('runs ten traceable stages from orchestrator to human control',()=>{
    const result=run('rice')
    expect(result.steps).toHaveLength(10)
    expect(result.steps[0].agent).toBe('orchestrator')
    expect(result.steps.at(-1)?.id).toBe('report')
    expect(result.humanGate).toBe('approval_required')
    for(const step of result.steps){
      expect(AGENT_REGISTRY[step.agent]).toBeDefined()
      expect(step.findingEn.length).toBeGreaterThan(24)
      expect(step.evidence.length).toBeGreaterThan(0)
    }
    expect(result.steps.find(s=>s.id==='quality')?.agent).toBe('data_quality_agent')
    expect(result.steps.find(s=>s.id==='logistics')?.agent).toBe('supply_analyst')
    expect(result.steps.find(s=>s.id==='reserves')?.agent).toBe('compliance_analyst')
  })
  it('returns crisis risk based on shock math, not invented LLM output',()=>{
    const r=run('tomato',{
      productionReductionPercent:40,importReductionPercent:65,
      demandIncreasePercent:20,openingStockLossPercent:10,
    })
    expect(r.risk).toBe('critical')
    expect(r.scenario.totals.scenarioDeficitTonnes).toBeGreaterThan(0)
    expect(r.proposals.some(p=>p.id==='deficit')).toBe(true)
    expect(r.proposals.some(p=>p.id==='reserve')).toBe(true)
  })
  it('never double counts contract, shipment and reserve tonnage as food balance',()=>{
    const r=run('rice')
    expect(r.scenario.totals.baselineProjectedBalanceTonnes).toBe(258.2)
    expect(r.links.deliveredTonnes).toBeGreaterThan(0)
    expect(r.scenario.totals.baselineProjectedBalanceTonnes)
      .toBe(balance('rice').totals.projectedBalanceTonnes)
  })
  it('blocks a credible gap conclusion when opening stock is missing',()=>{
    const incomplete=calculateFoodBalance({
      ...buildQatarIllustrativeFoodBalanceInput('rice',from,30),stocks:[],
    })
    const r=simulateCommodityAgents({
      commodityId:'rice',balance:incomplete,operations:ops,today:from,
      shocks:{...ZERO_FOOD_SCENARIO},
    })
    expect(r.risk).toBe('unknown')
    expect(r.scenario.status).toBe('insufficient_data')
    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0].id).toBe('collect')
    expect(r.steps.find(s=>s.id==='food')?.state).toBe('needs_data')
  })
  it('all proposals require human approval, no executed actions',()=>{
    const r=run('tomato')
    expect(r.humanGate).toBe('approval_required')
    expect(r.simulated).toBe(true)
    expect(r.sourceMode).toBe('demo')
    expect(r.proposals.every(p=>p.requiresHumanApproval)).toBe(true)
    expect(r.caveats.join(' ')).toContain('Does not invoke an LLM')
  })
  it('does not accept mismatched commodity scope',()=>{
    expect(()=>simulateCommodityAgents({
      commodityId:'tomato',balance:balance('rice'),operations:ops,today:from,
      shocks:{...ZERO_FOOD_SCENARIO},
    })).toThrow('do not match')
  })
  it('returns no all-clear when source evidence is incomplete',()=>{
    const incomplete=calculateFoodBalance({
      ...buildQatarIllustrativeFoodBalanceInput('barley',from,30),coverage:[],
    })
    const scenario=run('barley').scenario
    expect(agentRisk(incomplete,scenario)).toBe('unknown')
  })
})
