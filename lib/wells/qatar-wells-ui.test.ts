import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8')
describe('Qatar Wells Live Map integration',()=>{
 it('enables groundwater well mapping only on the Live Map',()=>{
  expect(read('app/dashboard/page.tsx')).toContain("wellsEnabled={moduleKey === 'live-map'}")
  expect(read('components/dashboard/satellite-map.tsx')).toContain(
   '{wellsEnabled&&<QatarWellsLayers map={mapForReadout}/>}')
 })
 it('keeps public and saved well locations independent and toggleable',()=>{
  const ui=read('components/dashboard/qatar-wells-layers.tsx')
  expect(ui).toContain('Public mapped')
  expect(ui).toContain('My mapped wells')
  expect(ui).toContain('setShowPublic')
  expect(ui).toContain('setShowSaved')
  expect(ui).toContain('normalizeUserMappedWells')
  expect(ui).toContain('/api/wells/qatar')
  expect(ui).toContain('/api/operations/custom-map-points')
 })
 it('guards the public endpoint and retains source attribution',()=>{
  const api=read('app/api/wells/qatar/route.ts')
  expect(api).toContain('auth.getUser()')
  expect(api).toContain('normalizeQatarWells(data)')
  expect(api).toContain('cache')
  expect(api).toContain('unavailable')
  expect(api).toContain('OpenStreetMap')
 })
 it('does not present missing groundwater telemetry as live data',()=>{
  const ui=read('components/dashboard/qatar-wells-layers.tsx')
  expect(ui).toContain('Live telemetry: ')
  expect(ui).toContain('Not connected')
  expect(ui).toContain('No live water level')
  expect(ui).not.toContain('Math.random()')
 })
})
