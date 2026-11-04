import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(join(process.cwd(), 'components/dashboard/watchtower-workspace.tsx'), 'utf8')
const agents = readFileSync(join(process.cwd(), 'components/dashboard/watchtower/agent-operations-room.tsx'), 'utf8')
const lab = readFileSync(join(process.cwd(), 'components/dashboard/commodity-agent-lab.tsx'), 'utf8')

describe('NFII Watchtower scope regression', () => {
  it('keeps the command room focused on food security and agent operations', () => {
    expect(workspace).toContain('<WatchtowerFoodCommandCenter />')
    expect(workspace).toContain('<WatchtowerAgentOperationsRoom />')
    expect(workspace).not.toContain('<WatchtowerScenarioRoom />')
    expect(readFileSync(join(process.cwd(), 'components/dashboard/watchtower/global-watchtower.tsx'), 'utf8')).toContain('Food Security Watchtower')
  })

  it.each([
    'NationalMapPanel',
    'WatchtowerProductionSnapshot',
    'WatchtowerChangesPanel',
    'WatchtowerContextDeck',
    'GrowaIntelligencePanel',
    'SignalCard',
    'buildWatchtowerGrowaContext',
    'partitionSignalsByPriority',
    '/api/watchtower/summary',
    '/api/alerts',
  ])('does not render or fetch unrelated legacy feature %s', symbol => {
    expect(workspace).not.toContain(symbol)
  })

  it('reuses live reviewed commodity inputs without a separate scenario room', () => {
    expect(agents).toContain('useCommodityCase(commodityId,days)')
    expect(agents).toContain('<CommodityAgentLab')
    expect(lab).toContain('simulateCommodityAgents({')
  })

  it('does not mutate procurement, approvals or source records', () => {
    expect(lab).not.toContain("method: 'POST'")
    expect(agents).not.toContain("method: 'POST'")
    expect(agents).not.toContain('/api/food-security/imports')
    expect(workspace).not.toContain('buildDemoFoodBalanceInput')
  })
})
