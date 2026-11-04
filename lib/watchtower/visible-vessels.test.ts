import {describe,expect,it} from 'vitest'
import {MIN_MAPPED_VESSEL_KNOTS,MAX_MAPPED_VESSEL_AGE_MS,visibleObservedVessel,visibleUnderwayVessel} from './visible-vessels'
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
const minutesAgo=(minutes:number)=>new Date(now-minutes*60000).toISOString()

describe('Watchtower real-vessel visibility',()=>{
  it('requires genuine source-aged positions no older than one hour',()=>{
    expect(MAX_MAPPED_VESSEL_AGE_MS).toBe(3600000)
    expect(visibleObservedVessel(ship({observedAt:minutesAgo(59)}),now)).toBe(true)
    expect(visibleObservedVessel(ship({observedAt:minutesAgo(60)}),now)).toBe(true)
    expect(visibleObservedVessel(ship({observedAt:minutesAgo(61)}),now)).toBe(false)
    expect(visibleUnderwayVessel(ship({observedAt:minutesAgo(61)}),now)).toBe(false)
  })
  it('never treats stale Bab el-Mandeb positions as recent',()=>{
    expect(visibleObservedVessel(ship({chokepointId:'bab_el_mandeb',
      source:'hormuz.data-tracking.net AIS',
      observedAt:minutesAgo(6*24*60)}),now)).toBe(false)
  })
  it('rejects undated webpage captures, poll-only positions and future fixes',()=>{
    expect(visibleObservedVessel(ship({observationBasis:'webpage_capture'}),now)).toBe(false)
    expect(visibleObservedVessel(ship({observationBasis:'snapshot_poll'}),now)).toBe(false)
    expect(visibleObservedVessel(ship({observedAt:new Date(now+120000).toISOString()}),now)).toBe(false)
  })
  it('requires source-reported speed at least 3 kn, not zero/unknown',()=>{
    expect(MIN_MAPPED_VESSEL_KNOTS).toBe(3)
    for(const speedKnots of [null,0,0.1,1.5,2.99])
      expect(visibleUnderwayVessel(ship({speedKnots}),now)).toBe(false)
    expect(visibleUnderwayVessel(ship({speedKnots:3}),now)).toBe(true)
    expect(visibleUnderwayVessel(ship({speedKnots:12}),now)).toBe(true)
    expect(visibleUnderwayVessel(ship({speedKnots:56}),now)).toBe(false)
  })
  it('does not accept aircraft as vessels',()=>{
    expect(visibleObservedVessel(ship({kind:'aircraft'}),now)).toBe(false)
  })
})
