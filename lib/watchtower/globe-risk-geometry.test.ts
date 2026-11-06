import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {globeRiskParts,hasApproximateRiskRadius} from './globe-risk-geometry'
import type {ProductionRiskZone} from './production-risk'
const fixture:ProductionRiskZone={
 id:'production:gdacs:FL:123',name:'Reported region',country:'Test',
 center:{lat:24,lon:52},geometry:null,radiusKm:90,
 boundaryBasis:'approximate_point_radius',driver:'flood',
 severity:'high',observedAt:'2026-11-06T00:00:00Z',source:'GDACS',
 sourceUrl:'https://www.gdacs.org',evidenceCount:1,
 eventTitles:['Flood'],productionExposure:'Possible impact',
 costChannels:'Potential disruption',
 scopeNote:'Screening only; not a verified hazard footprint.',
}
describe('Cesium source-backed risk screening geometry',()=>{
 it('preserves lon/lat order and interior exclusions for real ADM1 polygons',()=>{
  const zone:ProductionRiskZone={...fixture,radiusKm:null,
   boundaryBasis:'esri_admin1_screening',
   geometry:{type:'Polygon',coordinates:[
    [[50,24],[53,24],[53,26],[50,26],[50,24]],
    [[51,24.5],[52,24.5],[52,25],[51,25],[51,24.5]],
   ]}}
  expect(globeRiskParts(zone)).toEqual([{
   outer:[[50,24],[53,24],[53,26],[50,26]],
   holes:[[[51,24.5],[52,24.5],[52,25],[51,25]]],
  }])
  expect(hasApproximateRiskRadius(zone)).toBe(false)
 })
 it('supports separate multipolygon parts instead of connecting unrelated areas',()=>{
  const zone:ProductionRiskZone={...fixture,
   geometry:{type:'MultiPolygon',coordinates:[
    [[[50,24],[51,24],[51,25],[50,24]]],
    [[[53,24],[54,24],[54,25],[53,24]]],
   ]}}
  expect(globeRiskParts(zone)).toHaveLength(2)
 })
 it('only permits an approximate radius when GDACS lacked an admin polygon',()=>{
  expect(globeRiskParts(fixture)).toEqual([])
  expect(hasApproximateRiskRadius(fixture)).toBe(true)
  expect(hasApproximateRiskRadius({...fixture,radiusKm:0})).toBe(false)
  expect(globeRiskParts({...fixture,geometry:{
   type:'Polygon',coordinates:[[[201,24],[52,24],[53,25],[201,24]]],
  }})).toEqual([])
 })
 it('keeps risk and gateway selection wired to the existing 3D map and source toggles',()=>{
  const globe=readFileSync(join(process.cwd(),'components/dashboard/watchtower/watchtower-globe-3d.tsx'),'utf8')
  const parent=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  expect(globe).toContain('globeRiskParts(zone)')
  expect(globe).toContain('layers.production')
  expect(globe).toContain('layers.risks')
  expect(globe).toContain('onSelectRef.current(related)')
  expect(globe).toContain('onChokepointRef.current(gateway)')
  expect(parent).toContain('riskZones={riskZones}')
  expect(parent).toContain('alerts={alerts}')
  expect(parent).toContain('layers={layers}')
  expect(parent).toContain('onChokepointClick={chooseChokepoint}')
 })
})
