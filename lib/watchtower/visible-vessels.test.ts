import {describe,expect,it} from 'vitest'
import {isDelayedBabPosition,MIN_MAPPED_VESSEL_KNOTS,visibleObservedVessel,visibleUnderwayVessel} from './visible-vessels'
import type {TrackingAsset} from './global-tracking'
const now=Date.UTC(2026,10,3,12)
const ship=(overrides:Partial<TrackingAsset>={}):TrackingAsset=>({
  id:'sea:123456789',kind:'vessel',label:'TEST SHIP',lat:25.2,lon:55.2,
  heading:95,speedKnots:11,altitudeFt:null,
  observedAt:new Date(now-5*60000).toISOString(),
  source:'OpenSeaFeed AIS',sourceUrl:'https://openseafeed.com/',
  type:'AIS cargo vessel',cargo:'ais_cargo_class',
  destination:null,foodCargoVerified:false,observationBasis:'position_report',
  ...overrides,
})
describe('port and stationary ship clutter',()=>{
 it('allows explicitly selected stopped or speed-unknown observed AIS vessels',()=>{
  for(const speedKnots of [0,0.1,0.7,1.49,null]){
    expect(visibleObservedVessel(ship({speedKnots}),now)).toBe(true)
  }
  expect(visibleObservedVessel(ship({observationBasis:'webpage_capture'}),now)).toBe(false)
  expect(visibleObservedVessel(ship({
    observedAt:new Date(now-13*60*60000).toISOString(),
  }),now)).toBe(false)
 })
 it('excludes every vessel reporting less than 3 kn or unknown SOG',()=>{
  expect(MIN_MAPPED_VESSEL_KNOTS).toBe(3)
  for(const speedKnots of [0,0.1,0.7,1.49,1.5,2.99,null]){
    expect(visibleUnderwayVessel(ship({speedKnots}),now)).toBe(false)
  }
 })
 it('keeps source-observed traffic at or above 3 knots',()=>{
  expect(visibleUnderwayVessel(ship({speedKnots:3}),now)).toBe(true)
  expect(visibleUnderwayVessel(ship({speedKnots:13}),now)).toBe(true)
  expect(visibleUnderwayVessel(ship({speedKnots:12,observedAt:new Date(now-4*60*60000).toISOString()}),now)).toBe(true)
 })
 it('identifies last-known Bab AIS positions without asserting they are live',()=>{
  const sixDaysAgo=new Date(now-6*24*60*60000).toISOString()
  const delayed=ship({chokepointId:'bab_el_mandeb',
    source:'hormuz.data-tracking.net AIS',speedKnots:6,
    observedAt:sixDaysAgo})
  expect(isDelayedBabPosition(delayed,now)).toBe(true)
  expect(visibleUnderwayVessel(delayed,now)).toBe(true)
  expect(visibleUnderwayVessel({...delayed,speedKnots:2.5},now)).toBe(false)
  expect(isDelayedBabPosition({...delayed,chokepointId:'hormuz'},now)).toBe(false)
  expect(visibleUnderwayVessel({...delayed,chokepointId:'hormuz'},now)).toBe(false)
  expect(visibleUnderwayVessel({...delayed,observedAt:
    new Date(now-8*24*60*60000).toISOString()},now)).toBe(false)
 })
 it('rejects webpage captures and stale underway reports',()=>{
  expect(visibleUnderwayVessel(ship({observationBasis:'webpage_capture'}),now)).toBe(false)
  expect(visibleUnderwayVessel(ship({
    observedAt:new Date(now-13*60*60000).toISOString(),
  }),now)).toBe(false)
  expect(visibleUnderwayVessel(ship({
    observedAt:new Date(now+120000).toISOString(),
  }),now)).toBe(false)
 })
})
