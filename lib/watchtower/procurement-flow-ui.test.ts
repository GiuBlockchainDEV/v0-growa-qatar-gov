import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const get=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')
const mission=get('components/dashboard/watchtower/procurement-mission.tsx')
const route=get('components/dashboard/watchtower/procurement-route-desk.tsx')
const watchtower=get('components/dashboard/watchtower-workspace.tsx')
describe('Watchtower procurement progression and transparent costing',()=>{
 it('scrolls a dedicated log without dragging the entire watchtower to the top',()=>{
  expect(mission).toContain('logViewport.current.scrollTo(')
  expect(mission).not.toContain('scrollIntoView(')
  expect(watchtower).toContain('data-watchtower-flow-scroll')
 })
 it('advances to supplier, strategy, route approval and order stages',()=>{
  expect(mission).toContain('supplierSection.current')
  expect(mission).toContain('strategySection.current')
  expect(mission).toContain('decisionSection.current')
  expect(mission).toContain("setScrollNext('strategy-gate')")
  expect(mission).toContain("setScrollNext('order-gate')")
 })
 it('separates trade history from goods contracts and freight',()=>{
  expect(route).toContain('Historical import customs value is normally CIF-like')
  expect(route).toContain('Goods + freight · provisional only')
  expect(mission).toContain('Purchase cost breakdown')
  expect(mission).toContain('Excludes duties, insurance, actual delivery fees and taxes')
 })
})
