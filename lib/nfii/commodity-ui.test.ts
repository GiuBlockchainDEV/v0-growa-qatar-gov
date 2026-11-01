import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'

const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
const ui=read('components/dashboard/commodity-workspace.tsx')
const agent=read('components/dashboard/commodity-agent-lab.tsx')
const watchtower=read('components/dashboard/watchtower-workspace.tsx')
describe('Commodity Intelligence information architecture',()=>{
  it('does not mingle legacy national generic metrics with per-commodity food data',()=>{
    expect(ui).not.toContain('/api/watchtower/summary')
    expect(ui).not.toContain('Legacy national coverage')
    expect(ui).not.toContain('National contract volume (all commodities)')
    expect(ui).not.toContain('buildWatchtowerGrowaContext')
    expect(ui).toContain('linkCommodityOperations')
    expect(ui).toContain("value:total?.projectedClosingStockTonnes")
    expect(ui).toContain('Food balance explained')
  })
  it('does not display synthetic example commodity data as live',()=>{
    expect(ui).not.toContain('ILLUSTRATIVE QATAR EXAMPLE')
    expect(ui).toContain('REVIEWED ORGANIZATION SOURCES')
    expect(ui).toContain('VERIFIED DATA INCOMPLETE')
    expect(agent).toContain('SIMULATION · READ ONLY')
    expect(agent).toContain('No automatic execution')
  })
  it('exposes agent operations on Commodity and Watchtower, without writes',()=>{
    expect(ui).toContain('<CommodityAgentLab')
    expect(watchtower).toContain('<WatchtowerAgentOperationsRoom />')
    expect(watchtower).toContain("'#watchtower-agents'")
    expect(agent).not.toContain("method: 'POST'")
    expect(agent).not.toContain('createAdminClient')
    expect(agent).toContain('Rehearse approval')
  })
})
