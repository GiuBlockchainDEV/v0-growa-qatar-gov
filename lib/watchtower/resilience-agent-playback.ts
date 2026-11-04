/**
 * Visual audit playback for the deterministic resilience assessment.
 *
 * These messages expose PRECOMPUTED, source-backed validation steps.
 * Their timed appearance is a UI walkthrough, not an LLM reasoning stream,
 * asynchronous supplier search, or real elapsed processing telemetry.
 */
import type {AgentTraceStage,ResilienceAgentTrace} from './resilience-agent-trace'

export type PlaybackKind='start'|'input'|'operation'|'output'|'finding'|'handoff'
export interface AgentPlaybackEvent{
  id:string
  stageIndex:number
  stageId:AgentTraceStage['id']
  kind:PlaybackKind
  text:string
  textAr:string
  resultState:AgentTraceStage['state']
}
export interface AgentPlaybackLog extends AgentPlaybackEvent{
  /** Wall-clock time of UI emission; null when the user expands the trace. */
  emittedAt:number|null
  expanded?:boolean
}
export function buildAgentPlaybackEvents(trace:ResilienceAgentTrace):AgentPlaybackEvent[]{
  const events:AgentPlaybackEvent[]=[]
  for(const [stageIndex,stage] of trace.steps.entries()){
    let ordinal=0
    const add=(kind:PlaybackKind,text:string,textAr:string)=>{
      events.push({
        id:stage.id+':'+ordinal++,
        stageIndex,
        stageId:stage.id,
        kind,text,textAr,
        resultState:stage.state,
      })
    }
    add('start','Starting '+stage.agent+'...','بدء تشغيل '+stage.agentAr+'...')
    for(const input of stage.input){
      add('input','Reading: '+input,'قراءة: '+input)
    }
    add('operation',stage.operation,stage.operationAr)
    for(const output of stage.output){
      add('output','Checked: '+output,'نتيجة الفحص: '+output)
    }
    add('finding',stage.finding,stage.findingAr)
    add('handoff',stage.handoff,stage.handoffAr)
  }
  return events
}
export function completedAgentStages(events:readonly AgentPlaybackEvent[]):number{
  return events.filter(event=>event.kind==='handoff').length
}
export function activeAgentStage(events:readonly AgentPlaybackEvent[],stageCount:number):number{
  if(!stageCount)return 0
  const completed=completedAgentStages(events)
  return Math.min(completed,stageCount-1)
}
export function revealedAgentFinding(
  events:readonly AgentPlaybackEvent[],stageId:AgentTraceStage['id']
):boolean{
  return events.some(event=>event.stageId===stageId&&event.kind==='finding')
}
