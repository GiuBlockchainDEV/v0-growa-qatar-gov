import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import type {FoodPosture,FoodPostureCommodity} from './food-posture'
import {simulateResilienceAgentTrace} from './resilience-agent-trace'

const org='11111111-1111-4111-8111-111111111111'
function row(id='rice',complete=true):FoodPostureCommodity{
  return {
    commodityId:id,name:id,nameAr:id,band:complete?'critical':'unknown',
    status:complete?'complete':'insufficient_data',
    reason:complete?'deficit':'missing_evidence',
    projectedBalanceTonnes:complete?-100:null,
    deficitTonnes:complete?100:null,coverageDays:complete?0:null,
    domesticProductionTonnes:complete?20:null,
    confirmedImportsTonnes:complete?40:null,
    importShareOfInflowsPercent:complete?66.7:null,
    evidenceSourceRefs:complete?['verified:balance']:[],
    missingCoverage:complete?[]:['consumption'],
    latestReviewedAt:complete?'2026-11-03T12:00:00Z':null,
  }
}
function posture(items=[row()]):FoodPosture{
  return {
    schemaVersion:1,scope:'organization',sourceMode:'live',
    organizationId:org,generatedAt:'2026-11-04T01:00:00Z',
    fromDate:'2026-11-01',toDate:'2026-11-30',days:30,
    totalCommodities:items.length,
    assessedCount:items.filter(item=>item.status==='complete').length,
    deficitCount:items.filter(item=>(item.deficitTonnes??0)>0).length,
    criticalCount:items.filter(item=>item.band==='critical').length,
    highCount:0,attentionCount:0,
    unknownCount:items.filter(item=>item.band==='unknown').length,
    pendingReviewCount:3,latestReviewedAt:null,commodities:items,caveats:[],
  }
}
describe('Organization resilience multi-agent rehearsal',()=>{
  it('creates exactly eleven inspectable specialist steps and no purchase',()=>{
    const result=simulateResilienceAgentTrace(posture(),'rice')
    expect(result.steps).toHaveLength(11)
    expect(result.steps.map(step=>step.id)).toEqual([
      'scope','evidence','production','imports','balance','coverage',
      'importExposure','suppliers','logistics','options','governance',
    ])
    expect(result.verdict.priority).toBe('P0')
    expect(result.verdict.approvalRequired).toBe(true)
    expect(result.steps[7].state).toBe('blocked')
    expect(result.steps[8].state).toBe('blocked')
    expect(result.steps[10].state).toBe('gate')
    expect(result.steps[10].output.join(' ')).toContain('Procurement action: NONE')
    expect(JSON.stringify(result)).not.toContain('supplierName')
  })
  it('does not convert missing evidence to purchase advice or numeric shortage',()=>{
    const trace=simulateResilienceAgentTrace(posture([row('rice',false)]),'rice')
    expect(trace.verdict.priority).toBe('EVIDENCE')
    expect(trace.steps.find(step=>step.id==='balance')?.state).toBe('blocked')
    expect(trace.steps.find(step=>step.id==='coverage')?.state).toBe('blocked')
    expect(trace.steps.find(step=>step.id==='balance')?.output.join(' ')).
      not.toContain('Projected deficit: 0')
    expect(trace.verdict.nextAction).toContain('Collect and independently review')
  })
  it('rejects demo, unauthorized federation and missing commodity ids',()=>{
    expect(()=>simulateResilienceAgentTrace({
      ...posture(),sourceMode:'demo',
    },'rice')).toThrow('live organization')
    expect(()=>simulateResilienceAgentTrace({
      ...posture(),scope:'illustrative',
    },'rice')).toThrow('live organization')
    expect(()=>simulateResilienceAgentTrace(posture(),'wheat')).toThrow('not included')
  })
  it('renders no final verdict before the user runs and completes steps',()=>{
    const tsx=readFileSync(join(process.cwd(),
      'components/dashboard/watchtower/resilience-desk.tsx'),'utf8')
    const css=readFileSync(join(process.cwd(),
      'components/dashboard/watchtower/resilience-desk.module.css'),'utf8')
    expect(tsx).toContain('const [session,setSession]=useState<Session|null>(null)')
    expect(tsx).toContain('setSession({snapshot:posture,commodityId:effectiveCommodity,trace:built})')
    expect(tsx).toContain('session.snapshot===posture')
    expect(tsx).toContain('{completed&&trace&&')
    expect(tsx).toContain('Agent operations stream')
    expect(tsx).toContain('buildAgentPlaybackEvents(trace)')
    expect(tsx).toContain('setEventCursor(nextCursor)')
    expect(tsx).toContain('visibleEvents.some(v=>v.stageId===viewStage.id')
    expect(tsx).toContain('setFollowActive(false)')
    expect(tsx).toContain('emittedAt:null,expanded:true')
    expect(css).toContain('.liveConsole{')
    expect(css).toContain('.logLine{')
    expect(css).toContain('prefers-reduced-motion')
    expect(tsx).toContain('simulation, not a live multi-agent LLM execution')
    expect(css).toContain('background:var(--growa-ink)')
    expect(css).toContain('var(--status-critical)')
    expect(css).toContain('@media(max-width:690px)')
  })
})
