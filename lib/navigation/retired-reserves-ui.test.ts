import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'
const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8')
describe('Retired Strategic Reserves navigation',()=>{
 it('removes the nav module for every role without deleting inventory services',()=>{
  const registry=read('lib/navigation/registry.ts')
  expect(registry).not.toContain("key: 'strategic-reserves'")
  expect(registry).not.toContain("'strategic-reserves',")
  expect(registry).not.toContain("path: '/dashboard/reserves'")
 })
 it('redirects old bookmarks to the working Watchtower operations view',()=>{
  const page=read('app/dashboard/reserves/page.tsx')
  expect(page).toContain("redirect('/dashboard?module=watchtower#watchtower-operations')")
  expect(page).not.toContain('NfiiOperationsWorkspace')
 })
 it('removes entrypoints in operation hub, commodities, agent and watchtower',()=>{
  for(const path of [
   'components/dashboard/watchtower-workspace.tsx',
   'components/dashboard/watchtower/operations-pulse.tsx',
   'components/dashboard/watchtower/agent-operations-room.tsx',
   'components/dashboard/commodity-workspace.tsx',
   'components/dashboard/nfii-ops/operations-workspace.tsx',
  ]) expect(read(path),path).not.toContain('/dashboard/reserves')
 })
 it('does not delete the organization-approved ledger or downstream API integration',()=>{
  expect(read('components/dashboard/nfii-ops/operations-workspace.tsx')).toContain('/api/nfii/operations')
  expect(read('lib/nfii/reserves-intelligence.ts')).toContain('buildReservePortfolio')
 })
})
