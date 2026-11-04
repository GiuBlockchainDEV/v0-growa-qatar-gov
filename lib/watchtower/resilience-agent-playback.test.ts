import {describe,expect,it} from 'vitest'
import {buildAgentPlaybackEvents,activeAgentStage,completedAgentStages,
  revealedAgentFinding} from './resilience-agent-playback'
import {simulateResilienceAgentTrace} from './resilience-agent-trace'
import type {FoodPosture} from './food-posture'
const posture={
  schemaVersion:1,scope:'organization',sourceMode:'live',
  organizationId:'11111111-1111-4111-8111-111111111111',
  generatedAt:'2026-11-04T01:00:00Z',
  fromDate:'2026-11-01',toDate:'2026-11-30',days:30,
  totalCommodities:1,assessedCount:1,deficitCount:1,
  criticalCount:1,highCount:0,attentionCount:0,unknownCount:0,
  pendingReviewCount:0,latestReviewedAt:null,caveats:[],
  commodities:[{
    commodityId:'rice',name:'Rice',nameAr:'الأرز',band:'critical',
    status:'complete',reason:'deficit',projectedBalanceTonnes:-100,
    deficitTonnes:100,coverageDays:4,domesticProductionTonnes:20,
    confirmedImportsTonnes:40,importShareOfInflowsPercent:66.7,
    evidenceSourceRefs:['verified:test'],missingCoverage:[],
    latestReviewedAt:'2026-11-04T00:00:00Z',
  }],
} as FoodPosture
describe('Incremental resilience workflow playback',()=>{
  const trace=simulateResilienceAgentTrace(posture,'rice')
  const events=buildAgentPlaybackEvents(trace)
  it('streams each specialist source, validation, observation and handoff in order',()=>{
    expect(trace.steps).toHaveLength(11)
    expect(completedAgentStages([])).toBe(0)
    expect(events).toHaveLength(trace.steps.reduce((n,step)=>n+4+
      step.input.length+step.output.length,0))
    for(const [index,stage] of trace.steps.entries()){
      const group=events.filter(event=>event.stageIndex===index)
      expect(group[0].kind).toBe('start')
      expect(group.some(event=>event.kind==='input')).toBe(true)
      expect(group.some(event=>event.kind==='operation')).toBe(true)
      expect(group.some(event=>event.kind==='output')).toBe(true)
      expect(group.at(-2)?.kind).toBe('finding')
      expect(group.at(-1)?.kind).toBe('handoff')
      expect(group.at(-2)?.text).toBe(stage.finding)
      expect(group.at(-1)?.text).toBe(stage.handoff)
    }
  })
  it('never reveals outcomes before their corresponding log entries',()=>{
    const beforeFirstFinding=events.slice(0,events.findIndex(x=>x.kind==='finding'))
    expect(revealedAgentFinding(beforeFirstFinding,'scope')).toBe(false)
    expect(completedAgentStages(beforeFirstFinding)).toBe(0)
    expect(activeAgentStage(beforeFirstFinding,11)).toBe(0)
    const afterFirstHandoff=events.slice(0,events.findIndex(x=>x.kind==='handoff')+1)
    expect(revealedAgentFinding(afterFirstHandoff,'scope')).toBe(true)
    expect(completedAgentStages(afterFirstHandoff)).toBe(1)
    expect(activeAgentStage(afterFirstHandoff,11)).toBe(1)
  })
  it('is explicit about missing supplier and logistics evidence',()=>{
    const supplier=events.filter(event=>event.stageId==='suppliers')
    const logistics=events.filter(event=>event.stageId==='logistics')
    expect(supplier.map(x=>x.text).join(' ')).toContain('NOT VERIFIED')
    expect(logistics.map(x=>x.text).join(' ')).toContain('NOT CALCULATED')
    expect(supplier.at(-2)?.resultState).toBe('blocked')
    expect(logistics.at(-2)?.resultState).toBe('blocked')
    expect(completedAgentStages(events)).toBe(11)
  })
})
