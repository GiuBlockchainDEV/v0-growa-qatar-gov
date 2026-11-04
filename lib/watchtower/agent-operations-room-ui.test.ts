import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
const nav=source('components/dashboard/watchtower-workspace.tsx')
const room=source('components/dashboard/watchtower/agent-operations-room.tsx')
const lab=source('components/dashboard/commodity-agent-lab.tsx')
const css=source('components/dashboard/watchtower/agent-operations-room.module.css')
describe('Watchtower agent operations redesign',()=>{
 it('removes scenario room navigation and preserves old deep links',()=>{
  expect(nav).not.toContain('WatchtowerScenarioRoom')
  expect(nav).not.toContain("id: 'scenarios'")
  expect(nav).toContain("hash === '#watchtower-scenarios') setActiveSection('agents')")
  expect(nav).toContain("<WatchtowerAgentOperationsRoom />")
 })
 it('provides an active specialist stage constellation and action brief',()=>{
  expect(room).toContain('GROWA / INTELLIGENCE OPERATIONS')
  expect(room).toContain('Specialist agent constellation')
  expect(room).toContain('EXECUTIVE INTELLIGENCE BRIEF')
  expect(room).toContain('Mission execution studio')
  expect(room).toContain('telemetry.steps.find')
  expect(room).toContain("telemetry.phase==='completed'")
  expect(room).toContain('verdict?tx(verdict.headlineEn,verdict.headlineAr)')
  expect(css).toContain('.node[data-state=\'active\']')
  expect(css).toContain('prefers-reduced-motion')
 })
 it('keeps results undisclosed until actual user-run completion',()=>{
  expect(lab).toContain('onTelemetry?:(telemetry:AgentMissionTelemetry)=>void')
  expect(lab).toContain('verdict:workflowComplete?recommendation:null')
  expect(lab).toContain('steps:result?result.steps.slice(0,revealed):[]')
  expect(lab).toContain('const [session,setSession]=useState<AgentRunSession|null>(null)')
  expect(room).toContain('<CommodityAgentLab key={commodityId')
 })
 it('uses reviewed organization records and never auto-executes procurement',()=>{
  expect(room).toContain('useCommodityCase(commodityId,days)')
  expect(room).toContain('linkCommodityOperations(commodityId,operations,today)')
  expect(room).toContain('No orders, releases or payments')
  expect(room).not.toContain("method: 'POST'")
  expect(lab).not.toContain("method: 'POST'")
 })
})
