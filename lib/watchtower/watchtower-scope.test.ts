import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(join(process.cwd(), 'components/dashboard/watchtower-workspace.tsx'), 'utf8')
const scenario = readFileSync(join(process.cwd(), 'components/dashboard/watchtower/scenario-room.tsx'), 'utf8')

describe('NFII Watchtower scope regression', () => {
  it('keeps the command room focused on food security and scenarios', () => {
    expect(workspace).toContain('<WatchtowerFoodCommandCenter />')
    expect(workspace).toContain('<WatchtowerScenarioRoom />')
    expect(workspace).toContain('Food Security Watchtower')
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

  it('uses organization-authorized, verified live balances for scenarios', () => {
    expect(scenario).toContain('/api/food-security/balance?')
    expect(scenario).toContain("mode: 'live'")
    expect(scenario).toContain("payload.dataSource !== 'LIVE'")
    expect(scenario).toContain("payload.balance.sourceMode !== 'live'")
    expect(scenario).toContain('calculateFoodScenario')
  })

  it('does not mutate procurement, approvals or source records', () => {
    expect(scenario).not.toContain("method: 'POST'")
    expect(scenario).not.toContain('/api/food-security/imports')
    expect(scenario).not.toContain('/api/food-security/records/review')
    expect(workspace).not.toContain('buildDemoFoodBalanceInput')
  })
})
