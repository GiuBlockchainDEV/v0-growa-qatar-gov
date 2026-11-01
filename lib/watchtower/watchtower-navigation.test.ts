import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe,expect,it } from 'vitest'

const ui=readFileSync(join(process.cwd(),'components/dashboard/watchtower-workspace.tsx'),'utf8')

describe('NFII Watchtower navigation clarity',()=>{
  it('shows one primary analysis panel at a time',()=>{
    expect(ui).toContain("activeSection === 'food' && <WatchtowerFoodCommandCenter />")
    expect(ui).toContain("activeSection === 'operations' && <WatchtowerOperationsPulse />")
    expect(ui).toContain("activeSection === 'scenarios' && <WatchtowerScenarioRoom />")
    expect(ui).toContain("activeSection === 'agents' && <WatchtowerAgentOperationsRoom />")
  })
  it('supports deep links and keyboard-accessible active tabs',()=>{
    expect(ui).toContain("window.location.hash")
    expect(ui).toContain("window.addEventListener('hashchange'")
    expect(ui).toContain("aria-pressed={activeSection === section.id}")
    expect(ui).toContain("type=\"button\"")
  })
  it('does not reintroduce legacy field or fake national map summaries',()=>{
    expect(ui).not.toContain('NationalMapPanel')
    expect(ui).not.toContain('/api/watchtower/summary')
    expect(ui).not.toContain('buildDemoFoodBalanceInput')
  })
})
