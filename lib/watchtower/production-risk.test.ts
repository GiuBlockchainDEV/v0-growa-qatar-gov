import {describe,expect,it} from 'vitest'
import {
 gdacsDriver,hazardScreeningZone,parseAdministrativeMatch,validRiskPolygon,
 combineRiskZones,
} from './production-risk'
import type {MapAlert} from './global-tracking'
const incident=(overrides:Partial<MapAlert>={}):MapAlert=>({
 id:'gdacs:FL:123',kind:'hazard',lat:35.2,lon:-92.3,
 title:'Floods',severity:'high',observedAt:'2026-11-01T00:00:00.000Z',
 source:'GDACS',sourceUrl:'https://www.gdacs.org/',
 detail:'Recent verified GDACS event',locationBasis:'Event point only',...overrides,
})
const polygon={
 type:'Polygon',coordinates:[[[-93,35],[-92,35],[-92,36],[-93,36],[-93,35]]],
}
describe('production risk geographic screening',()=>{
 it('admits GDACS natural hazards only, not shipping/aviation/organization indicators',()=>{
  expect(gdacsDriver(incident())).toBe('flood')
  expect(gdacsDriver(incident({id:'gdacs:DR:12'}))).toBe('drought')
  expect(gdacsDriver(incident({id:'gdacs:TC:12'}))).toBe('storm')
  expect(gdacsDriver(incident({id:'gdacs:WF:12'}))).toBe('wildfire')
  expect(gdacsDriver(incident({id:'gdacs:EQ:12'}))).toBe('earthquake')
  expect(gdacsDriver(incident({source:'EASA CZIB'}))).toBeNull()
  expect(gdacsDriver(incident({kind:'food'}))).toBeNull()
 })
 it('identifies Esri admin1 polygons and labels them as SCREENING ONLY',()=>{
  const admin=parseAdministrativeMatch({features:[{
   properties:{NAME:'Arkansas',COUNTRY:'United States',ISO_SUB:'US-AR'},
   geometry:polygon,
  }]})
  expect(admin?.name).toBe('Arkansas')
  const zone=hazardScreeningZone(incident(),admin)
  expect(zone?.boundaryBasis).toBe('esri_admin1_screening')
  expect(zone?.radiusKm).toBeNull()
  expect(zone?.scopeNote).toContain('NOT the verified impact footprint')
  expect(zone?.productionExposure).toContain('crop')
  expect(zone?.costChannels).toContain('cost')
 })
 it('uses an explicitly approximate radius when no region is returned',()=>{
  const zone=hazardScreeningZone(incident(),null)
  expect(zone?.boundaryBasis).toBe('approximate_point_radius')
  expect(zone?.radiusKm).toBeGreaterThan(0)
  expect(zone?.geometry).toBeNull()
  expect(zone?.scopeNote).toContain('NOT GDACS event footprint')
 })
 it('rejects invalid coordinate arrays instead of rendering world-spanning areas',()=>{
  expect(validRiskPolygon({type:'Polygon',coordinates:[
   [[-93,35],[-92,35],[-92,36],[-93,36],[-93,35]],
  ]})).not.toBeNull()
  expect(validRiskPolygon({type:'Polygon',coordinates:[
   [[-193,35],[-92,35],[-92,36],[-93,36],[-193,35]],
  ]})).toBeNull()
  expect(parseAdministrativeMatch({features:[]})).toBeNull()
  expect(hazardScreeningZone(incident({lat:Number.NaN}),null)).toBeNull()
 })
 it('coalesces reports for the same administrative region and hazard type',()=>{
  const admin=parseAdministrativeMatch({features:[{
   properties:{NAME:'Arkansas',COUNTRY:'United States'},geometry:polygon,
  }]})
  const zones=[
   hazardScreeningZone(incident(),admin)!,
   hazardScreeningZone(incident({id:'gdacs:FL:456',severity:'attention'}),admin)!,
   hazardScreeningZone(incident({id:'gdacs:DR:999'}),admin)!,
  ]
  const merged=combineRiskZones(zones)
  expect(merged).toHaveLength(2)
  expect(merged[0].driver).toBe('flood')
  expect(merged[0].evidenceCount).toBe(2)
 })
})
