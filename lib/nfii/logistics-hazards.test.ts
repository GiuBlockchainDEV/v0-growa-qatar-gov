import {describe,expect,it} from 'vitest'
import {parseGdacsRegionalEvents} from './logistics-hazards'
import {buildScreenedRoutes} from './logistics-screening'

describe('Observed hazard coverage is not a fabricated risk percentage',()=>{
  it('reports red/orange hazard alerts only when points are near sampled gateways',()=>{
    const events={type:'FeatureCollection',features:[
      {id:'near',properties:{alertlevel:'Red',eventtype:'TC',eventid:'123'},
        geometry:{type:'Point',coordinates:[72.9,18.9]}},
      {id:'far',properties:{alertlevel:'Orange',eventtype:'EQ',eventid:'999'},
        geometry:{type:'Point',coordinates:[-100,30]}},
      {id:'low',properties:{alertlevel:'Green',eventtype:'FL',eventid:'88'},
        geometry:{type:'Point',coordinates:[72.9,18.9]}},
    ]}
    const alerts=parseGdacsRegionalEvents(events,'IN')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('red')
    expect(alerts[0].near).toBe('origin')
    expect(alerts[0].source).toBe('GDACS')
    expect(()=>parseGdacsRegionalEvents({items:[]},'IN')).toThrow()
  })
  it('removes formula-based scores, unsupported air ETAs and fake hub alternatives',()=>{
    const context={
      country:'IN',commodity:'rice',tonnes:20,limitDays:60,
      rates:{sea:null,air:null,road:null},
      seaDistances:null,lpi:null,lpiYear:null,waves:null,weatherAgeHours:null,
    }
    const initial=buildScreenedRoutes(context)
    expect(initial.every(x=>x.riskScore===null)).toBe(true)
    expect(initial.find(x=>x.mode==='sea')?.estimatedDays).toBeNull()
    expect(initial.find(x=>x.mode==='air')?.estimatedDays).toBeGreaterThan(1)
    expect(initial.map(x=>x.id)).toEqual(['sea_direct','air_direct'])
    expect(initial.every(x=>x.riskBand==='unavailable')).toBe(true)
    const active=buildScreenedRoutes({...context,hazards:{
      state:'available' as const,alerts:[{
        id:'TC:123:origin',type:'TC',severity:'red' as const,
        near:'origin' as const,distanceKm:12,label:'TC red near port',
        source:'GDACS' as const,sourceUrl:'https://www.gdacs.org/',
      }],sourceUrl:'https://www.gdacs.org/',observedAt:'2026-11-01T00:00:00Z',
    }})
    expect(active.every(x=>x.riskBand==='reported_alert')).toBe(true)
    expect(active[0].riskDrivers.some(x=>x.includes('TC red near port'))).toBe(true)
  })
})
