import {describe,expect,it} from 'vitest'
import {adsbdbItinerary,applyFlightRouteLookups,flightLookupInput,knownPort,vesselReportedItinerary} from './itinerary-sources'
import type {TrackingAsset} from './global-tracking'
const air:TrackingAsset={
  id:'air:abc123',kind:'aircraft',label:'FDX5038',lat:36,lon:-87,
  heading:85,speedKnots:480,altitudeFt:36000,observedAt:'2026-11-02T09:00:00Z',
  source:'ADSB.lol',sourceUrl:'https://api.adsb.lol',type:'B77L',
  cargo:'operator_inferred',destination:null,foodCargoVerified:false,
}
describe('provider-attributed origin and destination',()=>{
  it('uses actual airports from route lookup without fabricating a dated flight plan',()=>{
    const found=applyFlightRouteLookups([air],[{
      callsign:'FDX5038',plausible:true,_airports:[
        {iata:'MEM',name:'Memphis International Airport',countryiso2:'US',lat:35.04,lon:-89.97},
        {iata:'CDG',name:'Paris Charles de Gaulle',countryiso2:'FR',lat:49.01,lon:2.55},
      ],
    }])
    expect(found.matches).toBe(1)
    expect(found.plausible).toBe(1)
    const itinerary=found.results[0].itinerary!
    expect(itinerary.origin?.code).toBe('MEM')
    expect(itinerary.destination?.code).toBe('CDG')
    expect(itinerary.confidence).toBe('lookup_plausible')
    expect(itinerary.departureAt).toBeNull()
    expect(itinerary.description).toContain('not an observed flown path')
  })
  it('rejects unknown/multileg input rather than inventing the active flight leg',()=>{
    const missing=applyFlightRouteLookups([air],[{callsign:'DIFFERENT',
      _airports:[{lat:25,lon:51,iata:'DOH'},{lat:50,lon:0,iata:'LHR'}]}])
    expect(missing.matches).toBe(0)
    expect(missing.results[0].itinerary).toBeUndefined()
    const multi=applyFlightRouteLookups([air],[{callsign:'FDX5038',
      _airports:[{lat:25,lon:51,iata:'DOH'},{lat:50,lon:0,iata:'LHR'},{lat:40,lon:-73,iata:'JFK'}]}])
    expect(multi.matches).toBe(0)
  })
  it('keeps voyage last port distinct from an unverified cargo origin',()=>{
    const result=vesselReportedItinerary({
      AIS:{DESTINATION:'QAHMD',ETA:'2026-11-13 18:25:00 UTC'},
      VOYAGE:{LASTPORT:'Jebel Ali',LOCODE:'AEJEA',DEPARTURE:'2026-11-01 06:15:00 UTC'},
    })!
    expect(result.origin?.code).toBe('AEJEA')
    expect(result.destination?.code).toBe('QAHMD')
    expect(result.origin?.lat).toBeCloseTo(24.99,2)
    expect(result.etaAt).toBe('2026-11-13T18:25:00.000Z')
    expect(result.source).toBe('vesselfinder_ais_voyage')
    expect(result.description).toContain('not verified cargo-loading origin')
  })
  it('does not geocode arbitrary port names or imply a last port without entitlement',()=>{
    const route=vesselReportedItinerary({AIS:{DESTINATION:'UNKNOWN HARBOUR'}})!
    expect(route.origin).toBeNull()
    expect(route.destination?.name).toBe('UNKNOWN HARBOUR')
    expect(route.destination?.lat).toBeNull()
    expect(knownPort('NOT A PORT')).toBeNull()
    expect(vesselReportedItinerary({AIS:{DESTINATION:''}})).toBeNull()
  })
  it('uses ADSBdb second-provider airports only when actual coordinates are returned',()=>{
    const itinerary=adsbdbItinerary({response:{flightroute:{
      origin:{name:'Memphis International',iata_code:'MEM',latitude:35.04,longitude:-89.97,country_iso_name:'US'},
      destination:{name:'Paris Charles de Gaulle',iata_code:'CDG',latitude:49.01,longitude:2.55,country_iso_name:'FR'},
    }}})!
    expect(itinerary.origin?.code).toBe('MEM')
    expect(itinerary.destination?.code).toBe('CDG')
    expect(itinerary.source).toBe('adsbdb_callsign')
    expect(itinerary.confidence).toBe('lookup_unverified')
    expect(adsbdbItinerary({response:{flightroute:{
      origin:{name:'Unknown',iata_code:'AAA'},
      destination:{name:'Other',iata_code:'BBB'},
    }}})).toBeNull()
  })
  it('batches freight callsigns and removes duplicates',()=>{
    const inputs=flightLookupInput([air,{...air,id:'air:bbbbb2'},{
      ...air,id:'air:bbbbbb',label:'UNKNOWN',cargo:'unverified',
    }],10)
    expect(inputs[0]).toEqual({callsign:'FDX5038',lat:36,lng:-87})
    expect(inputs).toHaveLength(2)
  })
})
