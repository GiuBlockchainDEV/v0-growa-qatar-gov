import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {trafficSectorActivity} from './traffic-intelligence'
import type {TrackingAsset} from './global-tracking'
const date='2026-11-06T10:00:00Z',now=Date.parse(date)
const base:TrackingAsset={
 id:'sea:111111111',kind:'vessel',label:'TEST VESSEL',lat:12.6,lon:43.3,
 heading:90,speedKnots:7,altitudeFt:null,observedAt:'2026-11-06T09:30:00Z',
 source:'AIS',sourceUrl:'https://example.com',type:'Cargo',
 cargo:'ais_cargo_class',destination:null,foodCargoVerified:false,
 observationBasis:'position_report',
}
describe('Watchtower geographic intelligence lens',()=>{
 it('counts only recent underway source-backed vessel positions',()=>{
  const vessels=[base,{...base,id:'sea:slow',speedKnots:3},
   {...base,id:'sea:old',observedAt:'2026-11-06T05:00:00Z'},
   {...base,id:'sea:web',observationBasis:'webpage_capture' as const}]
  const bab=trafficSectorActivity(vessels,now).find(x=>x.id==='bab_el_mandeb')
  expect(bab).toMatchObject({vessels:1,basis:'observed_fixes'})
 })
 it('provides six navigable sectors, without claiming transits',()=>{
  const sectors=trafficSectorActivity([],now)
  expect(sectors.map(x=>x.id)).toEqual(['suez','red_sea','bab_el_mandeb','gulf_of_aden','arabian_sea','hormuz'])
  expect(sectors.every(x=>x.vessels===0&&x.aircraft===0)).toBe(true)
  const parent=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  const map=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-tracking-map.tsx'),'utf8')
  const camera=readFileSync(join(process.cwd(),'components/dashboard/watchtower/asset-observation-camera.tsx'),'utf8')
  expect(parent).toContain('<TrafficIntelligenceLens assets={allAssets}')
  expect(map).toContain('AIS FIXES')
  expect(map).toContain('radius:23')
  expect(camera).toContain('Imagery unavailable')
  expect(camera).toContain('Open provider player')
  expect(camera).not.toContain('<iframe')
 })
})
