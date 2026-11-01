import {describe,expect,it} from 'vitest'
import {calculateFoodBalance} from '@/lib/food-security/balance'
import {buildQatarIllustrativeFoodBalanceInput} from '@/lib/food-security/demo-data'
import {calculateFoodScenario,ZERO_FOOD_SCENARIO} from '@/lib/food-security/scenario'
import {
  agentProgressPercent,buildBalanceChartModel,buildScenarioChartModel,
} from './commodity-charts'

const start='2026-11-01'
const food=(commodity:string,days:7|30|90|180=30)=>
  calculateFoodBalance(buildQatarIllustrativeFoodBalanceInput(commodity,start,days))

describe('Commodity visual accounting model',()=>{
  it('draws rice availability and outflows to the same scale without double counting',()=>{
    const m=buildBalanceChartModel(food('rice'))
    expect(m).not.toBeNull()
    expect(m?.inflows).toEqual([320,0,210])
    expect(m?.outflows).toEqual([270,1.8])
    expect(m?.availableTonnes).toBe(530)
    expect(m?.requiredTonnes).toBe(271.8)
    expect(m?.closingTonnes).toBe(258.2)
    expect(m?.netTonnes).toBe(258.2)
    expect(m?.deficitTonnes).toBe(0)
    expect(m?.maxTonnes).toBe(530)
  })
  it('shows the correct accounting waterfall and a negative net position',()=>{
    const m=buildBalanceChartModel(food('rice'))
    expect(m?.bridge.map(s=>s.key)).toEqual([
      'opening','domestic','imports','consumption','losses','net',
    ])
    expect(m?.bridge.map(s=>s.end)).toEqual([320,320,530,260,258.2,258.2])
    expect(m?.bridge[3].amount).toBe(-270)
    expect(m?.bridge[4].amount).toBe(-1.8)
    const bad=food('barley',180)
    const b=buildBalanceChartModel(bad)
    expect(b).not.toBeNull()
    expect(b?.netTonnes).toBe(bad.totals.projectedBalanceTonnes)
    expect(b?.deficitTonnes).toBe(bad.totals.deficitTonnes)
    expect(b?.minBridge).toBeLessThanOrEqual(0)
  })
  it('never silently replaces incomplete or missing real input with zero bars',()=>{
    expect(buildBalanceChartModel(null)).toBeNull()
    const base=buildQatarIllustrativeFoodBalanceInput('rice',start,30)
    const missing=calculateFoodBalance({...base,stocks:[]})
    const partial=calculateFoodBalance({...base,coverage:[]})
    expect(missing.status).toBe('insufficient_data')
    expect(buildBalanceChartModel(missing)).toBeNull()
    expect(buildBalanceChartModel(partial)).toBeNull()
  })
  it('compares only a matching commodity, period and source-mode scenario',()=>{
    const rice=food('rice')
    const s=calculateFoodScenario(rice,{...ZERO_FOOD_SCENARIO,importReductionPercent:40})
    const m=buildScenarioChartModel(s,rice)
    expect(m?.baselineNetTonnes).toBe(258.2)
    expect(m?.scenarioNetTonnes).toBe(174.2)
    expect(m?.scenarioDeficitTonnes).toBe(0)
    expect(m?.maxAbsNetTonnes).toBe(258.2)
    expect(buildScenarioChartModel(s,food('tomato'))).toBeNull()
    expect(buildScenarioChartModel(s,food('rice',7))).toBeNull()
    expect(buildScenarioChartModel(null,rice)).toBeNull()
    expect(buildScenarioChartModel(s,null)).toBeNull()
  })
  it('shows negative scenario net and risk when a compound crisis creates a deficit',()=>{
    const tomato=food('tomato')
    const s=calculateFoodScenario(tomato,{
      productionReductionPercent:40,importReductionPercent:65,
      demandIncreasePercent:20,openingStockLossPercent:10,
    })
    const m=buildScenarioChartModel(s,tomato)
    expect(m).not.toBeNull()
    expect(m?.scenarioNetTonnes).toBeLessThan(0)
    expect(m?.scenarioDeficitTonnes).toBeCloseTo(Math.abs(m?.scenarioNetTonnes??0),2)
    expect(m?.baselineNetTonnes).toBe(tomato.totals.projectedBalanceTonnes)
    expect(m?.scenarioCoverageDays).toBe(0)
  })
  it('calculates stage progress without overflows and never conflates it with an outcome',()=>{
    expect(agentProgressPercent(0,10)).toBe(0)
    expect(agentProgressPercent(1,10)).toBe(10)
    expect(agentProgressPercent(5,10)).toBe(50)
    expect(agentProgressPercent(10,10)).toBe(100)
    expect(agentProgressPercent(999,10)).toBe(100)
    expect(agentProgressPercent(-5,10)).toBe(0)
    expect(agentProgressPercent(4,0)).toBe(0)
  })
})
