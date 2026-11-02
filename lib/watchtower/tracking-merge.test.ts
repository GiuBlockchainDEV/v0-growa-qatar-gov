import {describe,expect,it} from 'vitest'
import {mergeTrackingUpdate,mergeFlightItineraries,type RouteLookupResponse} from './tracking-merge'
import type {TrackingAsset,TrackingSnapshot} from './global-tracking'
const aircraft:TrackingAsset={
  id:'air:abc123',kind:'aircraft',label:'FDX123',lat:25,lon:51,
  heading:90,speedKnots:440,altitudeFt:34000,observedAt:'2026-11-02T09:00:00Z',
  source:'ADSB.lol',sourceUrl:'https://api.adsb.lol',type:'B77L',
  cargo:'operator_inferred',destination:null,foodCargoVerified:false,
}
const source={id:'adsb',name:'ADSB.lol',state:'partial' as const,checkedAt:'2026-11-02T09:00:00Z',
  latestObservationAt:'2026-11-02T09:00:00Z',detail:'Samples',url:'https://api.adsb.lol'}
const snapshot=(assets:TrackingAsset[],alerts:TrackingSnapshot['alerts']=[],sources=[source]):TrackingSnapshot=>
  ({assets,alerts,sources,generatedAt:'2026-11-02T09:00:00Z',refreshSeconds:60})
const route:RouteLookupResponse={checkedAt:'2026-11-02T09:01:00Z',status:'partial',matched:1,checked:1,
  sourceNote:'ADSB.lol',routes:{'air:abc123':{callsign:'FDX123',itinerary:{
    origin:{name:'Memphis',code:'MEM',country:'US',lat:35,lon:-89},
    destination:{name:'Paris',code:'CDG',country:'FR',lat:49,lon:2},
    departureAt:null,etaAt:null,source:'adsb_lol_routeset',
    sourceUrl:'https://api.adsb.lol/docs',confidence:'lookup_unverified',description:'lookup',
  }}}}
describe('progressive Watchtower observations',()=>{
  it('shows aircraft before slow risk feeds, then merges incoming alerts',()=>{
    const quick=snapshot([aircraft])
    const complete=snapshot([aircraft],[{
      id:'gdacs:tc:1',kind:'hazard',title:'Storm',severity:'high',lat:25,lon:51,
      observedAt:null,source:'GDACS',sourceUrl:'https://gdacs.org',
      detail:'Storm',locationBasis:'Reported point',
    }],[{...source,id:'gdacs'}])
    const first=mergeTrackingUpdate(null,quick,'quick')
    const withAlerts=mergeTrackingUpdate(first,complete,'full')
    expect(withAlerts.assets).toHaveLength(1)
    expect(withAlerts.alerts).toHaveLength(1)
    expect(withAlerts.sources).toHaveLength(2)
    const lateQuick=mergeTrackingUpdate(withAlerts,quick,'quick')
    expect(lateQuick.alerts).toHaveLength(1)
  })
  it('retains itinerary after a subsequent coordinates-only refresh',()=>{
    const base=mergeFlightItineraries(snapshot([aircraft]),route)!
    expect(base.assets[0].itinerary?.destination?.code).toBe('CDG')
    const moved={...aircraft,lat:25.1,observedAt:'2026-11-02T09:01:00Z'}
    const merged=mergeTrackingUpdate(base,snapshot([moved]),'full')
    expect(merged.assets[0].lat).toBe(25.1)
    expect(merged.assets[0].itinerary?.origin?.code).toBe('MEM')
  })
  it('does not assign a reused hex to a different callsign',()=>{
    const changed={...aircraft,label:'QTR190'}
    const merged=mergeFlightItineraries(snapshot([changed]),route)!
    expect(merged.assets[0].itinerary).toBeUndefined()
  })
})
