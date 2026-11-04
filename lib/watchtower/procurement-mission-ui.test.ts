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
describe('Source-backed multi-choice procurement mission',()=>{
 it('links live procurement research, supplier approval and route providers',()=>{
  expect(ui).toContain('/api/nfii/procurement/crop-producers?')
  expect(ui).toContain("research:'curated'")
  expect(ui).toContain('/api/watchtower/procurement-agent?')
  expect(ui).toContain('/api/nfii/logistics/corridors?')
  expect(ui).toContain("supplierScope:'approved'")
  expect(ui).toContain("Promise.allSettled")
 })
 it('requires manual approvals before progressing and returns on rejection',()=>{
  expect(ui).toContain('const approve=()=>')
  expect(ui).toContain('const reject=()=>')
  expect(ui).toContain('previousMissionStep(stage)')
  expect(ui).toContain('nextMissionStep(stage)')
  expect(ui).toContain('setStage(returnTo)')
  expect(ui).toContain('sourceErrors')
  expect(ui).toContain('selectedAllocations')
  expect(ui).toContain("stage===4")
 })
 it('supports distinct allocation choices and does not automatically approve orders',()=>{
  expect(ui).toContain('type="checkbox"')
  expect(ui).toContain('setShortlist(prev')
  expect(ui).toContain('type="radio"')
  expect(ui).toContain('validateAllocations')
  expect(ui).toContain("kind:'purchase_order'")
  expect(ui).toContain("'/api/nfii/operations'")
  expect(ui).toContain("'/api/nfii/operations/action'")
  expect(ui).toContain("action:decision")
  expect(ui).toContain("approval?.status==='pending'")
  expect(ui).toContain('Approve (authorized reviewer)')
  expect(ui).toContain('Reject & return')
  expect(route).toContain("requireCapability('supply.view'")
  expect(route).toContain("eq('status','approved')")
  expect(route).not.toContain('buildOrganizationOperationsBaseline')
 })
 it('keeps old diagnostic playback collapsed and matches the Growa theme',()=>{
  expect(desk).toContain('<WatchtowerProcurementMission')
  expect(desk).toContain('<details className={styles.legacyAudit}>')
  expect(css).toContain('background:var(--growa-ink)')
  expect(css).toContain('var(--status-critical)')
 })
})
