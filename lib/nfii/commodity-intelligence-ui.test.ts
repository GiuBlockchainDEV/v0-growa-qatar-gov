import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const get=(name:string)=>readFileSync(join(process.cwd(),name),'utf8')
const cockpit=get('components/dashboard/commodity-intelligence-cockpit.tsx')
const workspace=get('components/dashboard/commodity-workspace.tsx')
const resilience=get('components/dashboard/watchtower/resilience-desk.tsx')
const css=get('components/dashboard/commodity-intelligence-cockpit.module.css')
describe('Commodity command intelligence UI',()=>{
 it('renders the new cockpit for each selected catalogue commodity',()=>{
  expect(workspace).toContain('<CommodityIntelligenceCockpit key={commodity.id}')
  expect(cockpit).toContain('buildCommoditySignal(balance)')
  expect(cockpit).toContain('links.pendingApprovals')
  expect(cockpit).toContain('COMMODITY COMMAND INTELLIGENCE')
 })
 it('uses sourced yearly customs values when monthly market series do not exist',()=>{
  const evidence=get('components/dashboard/commodity-import-prices.tsx')
  expect(cockpit).toContain('<CommodityImportPrices commodity={commodity.id}/>')
  expect(evidence).toContain('/api/watchtower/commodity-price-evidence?')
  expect(evidence).toContain('years.length>=2')
  expect(evidence).toContain('data.originPrices.length>=2')
 })
 it('only charts published monthly commodity prices with provenance',()=>{
  expect(cockpit).toContain('/api/watchtower/commodity-markets')
  expect(cockpit).toContain('market?.instruments.find(i=>i.id===commodity.id)')
  expect(cockpit).toContain('IMF via FRED')
  expect(cockpit).toContain('No matching published global benchmark for this crop.')
 })
 it('retains full source ledgers, scenario agents and linked operations',()=>{
  expect(workspace).toContain('Show detailed accounting and linked source records')
  expect(workspace).toContain('<CommodityBalanceCharts balance={balance}/>')
  expect(workspace).toContain('<CommodityAgentLab')
  expect(cockpit).toContain('onAgents')
  expect(cockpit).toContain('onSources')
  expect(cockpit).toContain('/dashboard/procurement')
  expect(cockpit).toContain('/dashboard/logistics')
 })
 it('deletes the legacy diagnostic audit, not just collapses it',()=>{
  expect(resilience).toContain('<WatchtowerProcurementMission')
  expect(resilience).not.toContain('<details')
  expect(resilience).not.toContain('Diagnostic agent audit')
 })
 it('uses brand styling and responsive/reduced-motion layout',()=>{
  expect(css).toContain('var(--growa-ink)')
  expect(css).toContain('var(--growa-sage)')
  expect(css).toContain('@media(max-width:620px)')
  expect(css).toContain('prefers-reduced-motion')
 })
})
