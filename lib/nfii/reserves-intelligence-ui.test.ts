import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
const workspace=read('components/dashboard/nfii-ops/operations-workspace.tsx')
const panel=read('components/dashboard/nfii-ops/strategic-reserves-command.tsx')
const engine=read('lib/nfii/reserves-intelligence.ts')
describe('Strategic reserves command UX',()=>{
  it('gives reserves a separate command, agent and operational register',()=>{
    expect(workspace).toContain('<StrategicReservesCommand')
    expect(workspace).toContain("'command'|'register'")
    expect(workspace).toContain('onOpenRegister={view=>')
    expect(workspace).toContain("focus==='reserves'&&reserveView==='command'?null")
  })
  it('includes visualizations and an on-demand rule-based decision agent',()=>{
    expect(panel).toContain('<StockMix')
    expect(panel).toContain('<ExpiryChart')
    expect(panel).toContain('<BarGroups')
    expect(panel).toContain('<LotRows')
    expect(panel).toContain('<AgentPanel')
    expect(panel).toContain('Run reserve agent')
    expect(panel).toContain('setReport(runReserveAgent')
    expect(panel).not.toContain('buildQatarIllustrativeFoodBalanceInput')
    expect(panel).not.toContain('previewOperationsSnapshot')
  })
  it('fetches only authorized reviewed consumption and never auto-executes requests',()=>{
    expect(panel).toContain("mode:'live'")
    expect(panel).toContain("json.dataSource!=='LIVE'")
    expect(panel).toContain("b.sourceMode!=='live'")
    expect(panel).toContain("b.status!=='complete'")
    expect(panel).not.toContain("method:'POST'")
    expect(engine).toContain('never subtract them a second time')
    expect(engine).toContain('Approved release commitments exceed on-hand quantity')
  })
})
