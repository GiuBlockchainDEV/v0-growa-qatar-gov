import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {
 cameraDistanceKm,parseNearbyPublicCameras,publicCameraUrl,validCameraCoordinates,
} from './public-cameras'
import {contactIntelligence,referenceArcDeviationKm} from './contact-intelligence'
import type {TrackingAsset} from './global-tracking'
const fixture:TrackingAsset={
 id:'air:abc123',kind:'aircraft',label:'QTR123',lat:25.3,lon:51.5,
 heading:90,speedKnots:250,altitudeFt:30000,observedAt:'2026-11-06T10:00:00Z',
 source:'ADSB',sourceUrl:'https://adsb.lol',type:'B77L',cargo:'airframe_inferred',
 destination:null,foodCargoVerified:false,
}
describe('Gods Eye inspired Watchtower extensions',()=>{
 it('never embeds arbitrary third party frames',()=>{
  expect(publicCameraUrl('https://attacker.example/embed')).toBeNull()
  expect(publicCameraUrl('javascript:alert(1)')).toBeNull()
  expect(publicCameraUrl('http://www.windy.com')).toBeNull()
  expect(publicCameraUrl('https://windy.com:4444')).toBeNull()
  expect(publicCameraUrl('https://www.windy.com/webcams/foo')).toBeTruthy()
  expect(validCameraCoordinates(25.3,51.5)).toBe(true)
  expect(validCameraCoordinates(92,51.5)).toBe(false)
 })
 it('parses only nearby, active, provider-backed embedded webcams',()=>{
  const input={webcams:[
   {webcamId:42,status:'active',title:'Port camera',location:{latitude:25.31,longitude:51.51},
    player:{live:{available:true,embed:'https://www.windy.com/webcams/player/42'},day:{embed:'https://www.windy.com/webcams/player/42/day'}},
    urls:{detail:'https://www.windy.com/webcams/42'},lastUpdatedOn:'2026-11-06T09:00:00Z'},
   {webcamId:43,status:'active',title:'Far camera',location:{latitude:10,longitude:10},
    player:{live:{available:true,embed:'https://www.windy.com/embed/43'}},
    urls:{detail:'https://www.windy.com/43'}},
   {webcamId:44,status:'inactive',title:'Offline',location:{latitude:25.3,longitude:51.5},
    player:{live:{available:true,embed:'https://www.windy.com/embed/44'}},
    urls:{detail:'https://www.windy.com/44'}},
  ]}
  const list=parseNearbyPublicCameras(input,25.3,51.5)
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({id:'42',liveCapable:true,title:'Port camera'})
  expect(list[0].distanceKm).toBeLessThan(5)
  expect(cameraDistanceKm(25.3,51.5,25.3,51.5)).toBe(0)
 })
 it('does not infer observed routes from unverified itineraries',()=>{
  const intelligence=contactIntelligence(fixture,Date.parse('2026-11-06T10:01:00Z'))
  expect(intelligence.freshness).toBe('recent')
  expect(intelligence.route).toBe('insufficient_data')
  expect(intelligence.notes.join(' ')).toContain('Cargo classification is inferred')
  expect(referenceArcDeviationKm({lat:0,lon:0},{lat:0,lon:10},{lat:0,lon:5})).toBeLessThan(5)
  expect(referenceArcDeviationKm({lat:0,lon:0},{lat:0,lon:10},{lat:10,lon:5})).toBeGreaterThan(100)
 })
 it('preserves data provenance on delayed and screen-captured positions',()=>{
  const seen=contactIntelligence({...fixture,kind:'vessel',
   id:'sea:123456789',observationBasis:'webpage_capture'},
   Date.parse('2026-11-06T10:01:00Z'))
  expect(seen.freshness).toBe('undated')
  expect(seen.notes.join(' ')).toContain('Webpage inspection')
 })
 it('wires the observation camera to the selected Watchtower object',()=>{
  const page=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  const visual=readFileSync(join(process.cwd(),'components/dashboard/watchtower/asset-observation-camera.tsx'),'utf8')
  expect(page).toContain('<AssetObservationCamera key={selectedAsset.id} asset={selectedAsset}/>')
  expect(page).toContain('Geospatial Contact Intelligence')
  expect(visual).toContain('SATELLITE BASEMAP · NOT LIVE FOOTAGE')
  expect(visual).toContain('/api/watchtower/public-cameras?')
  expect(visual).toContain('Following')
 })
})
