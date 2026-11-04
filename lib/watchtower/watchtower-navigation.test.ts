import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe,expect,it } from 'vitest'

const ui=readFileSync(join(process.cwd(),'components/dashboard/watchtower-workspace.tsx'),'utf8')

describe('NFII Watchtower navigation clarity',()=>{
  it('shows one primary analysis panel at a time',()=>{
    expect(ui).toContain("activeSection === 'markets' && <CommodityMarkets />")
    expect(ui.indexOf("id: 'markets'")).toBeLessThan(ui.indexOf("id: 'food'"))
    expect(ui).toContain("'#watchtower-markets'")
    expect(ui).toContain("activeSection === 'food' && <WatchtowerFoodCommandCenter />")
    expect(ui).toContain("activeSection === 'operations' && <WatchtowerOperationsPulse />")
    expect(ui).not.toContain('WatchtowerScenarioRoom')
    expect(ui).not.toContain("id: 'scenarios'")
    expect(ui).toContain("hash === '#watchtower-scenarios') setActiveSection('agents')")
    expect(ui).toContain("activeSection === 'agents' && <WatchtowerAgentOperationsRoom />")
  })
  it('supports deep links and keyboard-accessible active tabs',()=>{
    expect(ui).toContain("window.location.hash")
    expect(ui).toContain("bg-card")
    expect(ui).toContain("bg-cream-100")
    expect(ui).not.toContain("bg-slate-700")
    expect(ui).toContain("window.addEventListener('hashchange'")
    expect(ui).toContain("aria-pressed={section.id === activeSection}")
    expect(ui).toContain("type=\"button\"")
  })
  it('does not reintroduce legacy field or fake national map summaries',()=>{
    expect(ui).not.toContain('NationalMapPanel')
    expect(ui).not.toContain('/api/watchtower/summary')
    expect(ui).not.toContain('buildDemoFoodBalanceInput')
  })
})
