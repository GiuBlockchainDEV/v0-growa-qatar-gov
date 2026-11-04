import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const ui=readFileSync(join(process.cwd(),
 'components/dashboard/watchtower/procurement-mission.tsx'),'utf8')
const route=readFileSync(join(process.cwd(),
 'app/api/watchtower/procurement-agent/route.ts'),'utf8')
const desk=readFileSync(join(process.cwd(),
 'components/dashboard/watchtower/resilience-desk.tsx'),'utf8')
const css=readFileSync(join(process.cwd(),
 'components/dashboard/watchtower/procurement-mission.module.css'),'utf8')
describe('Growa sourcing autopilot: multi-source analysis and human governance',()=>{
 it('executes real source calls without restricting research to approved contracts',()=>{
  expect(ui).toContain('/api/nfii/procurement/crop-producers?')
  expect(ui).toContain("research:'curated'")
  expect(ui).toContain('/api/watchtower/procurement-agent?')
  expect(ui).toContain('/api/nfii/procurement/origin-prices?')
  expect(ui).toContain('/api/nfii/logistics/corridors?')
  expect(ui).toContain("supplierScope:documented?'documented':approved?'approved'")
  expect(ui).toContain('Promise.allSettled')
  expect(ui).toContain('rankSourcingCandidates(leads,contracts,origins)')
  expect(ui).toContain('buildSourcingScenarios(candidates,routes,origins,requiredQty)')
 })
 it('retains multiple supplier alternatives and only meaningful approval gates',()=>{
  expect(ui).toContain('type="checkbox"')
  expect(ui).toContain('setSelectedIds(prev')
  expect(ui).toContain('diverseShortlist(candidates,8)')
  expect(ui).toContain('approveShortlist')
  expect(ui).toContain('rejectShortlist')
  expect(ui).toContain('rejectPlan')
  expect(ui).toContain('approvePlan')
  expect(ui).toContain("setPhase('shortlist')")
  expect(ui).toContain('Research orchestrator')
  expect(ui).toContain('Logistics orchestrator')
 })
 it('never manufactures binding supplier quotes or automatically approves an order',()=>{
  expect(ui).toContain('No approved contracts: RFQ and qualification pathways remain available.')
  expect(ui).toContain('sourcingBrief(')
  expect(ui).toContain('planApprovedOrders(')
  expect(ui).toContain("kind:'purchase_order'")
  expect(ui).toContain("'/api/nfii/operations'")
  expect(ui).toContain("'/api/nfii/operations/action'")
  expect(ui).toContain("action:decision")
  expect(ui).toContain("approval?.status==='pending'")
  expect(ui).toContain('Approve (authorized reviewer)')
  expect(ui).toContain('Reject · return to plan')
  expect(route).toContain("requireCapability('supply.view'")
  expect(route).toContain("eq('status','approved')")
  expect(route).not.toContain('buildOrganizationOperationsBaseline')
 })
 it('is Growa-themed and keeps optional old audit replay collapsed',()=>{
  expect(desk).toContain('<WatchtowerProcurementMission')
  expect(desk).toContain('<details className={styles.legacyAudit}>')
  expect(css).toContain('background:var(--growa-ink)')
  expect(css).toContain('var(--status-critical)')
  expect(css).toContain('.agentConsole')
 })
})
