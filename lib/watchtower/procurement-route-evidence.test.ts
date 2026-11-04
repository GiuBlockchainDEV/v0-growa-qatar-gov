import {describe,it,expect} from 'vitest'
import {mapRouteEvidence,orderRouteAlternatives,routePassages,
 riskAssessment,routeKey,routeOptionReport,type CorridorOption} from './procurement-route-evidence'
import type {CorridorPayload} from './procurement-route-evidence'
const route=(id:string,index:number|null,band:CorridorOption['riskBand']='no_nearby_reported_alert'):CorridorOption=>({
 id,country:'IN',mode:'sea',via:id.includes('via')?'Salalah transfer candidate':null,
 from:'Nhava Sheva',to:'Hamad Port',originCode:'INNSA',destinationCode:'QAHMD',
 estimatedDays:id==='fast'?5:13,timeBasis:'voyage estimate',
 costEstimate:{minQar:2500,maxQar:5300},
 exposure:{index,label:index===null?'unknown':'screened'},riskBand:band,
 riskDrivers:['Provider-specific observations'],quality:'model_only',sourceUrl:null,
 distanceKm:2000,feasibleBeforeDeadline:true,requiresQuote:true,bookingConfirmed:false,
})
describe('Evidence-led multi-route mapping and risk',()=>{
 it('preserves all screened variants and unique country keys without inventing paths',()=>{
  const payload:CorridorPayload={routes:[route('sea_direct',25),route('sea_via',75)],
   mapRoutes:[{id:'sea_direct',mode:'sea',paths:[[[18,72],[25,51]]],
    fidelity:'modeled_geometry',from:'Nhava Sheva',to:'Hamad Port',
    via:null,origin:[18,72],destination:[25,51],source:'Ocean grid'}],
   generatedAt:'2026-11-04T09:00:00Z'}
  const options=mapRouteEvidence('IN',payload)
  expect(options).toHaveLength(2)
  expect(options[0].key).toBe('IN:sea_direct')
  expect(options[0].overlay?.id).toBe('IN:sea_direct')
  expect(options[1].overlay).toBeNull()
  expect(routeOptionReport(options).mapped).toBe(1)
  expect(routeKey('TH','sea_direct')).toBe('TH:sea_direct')
 })
 it('ranks by risk, ETA and modeled freight separately',()=>{
  const details=mapRouteEvidence('IN',{routes:[route('sea_direct',81),
   route('sea_via',33),route('fast',52)],mapRoutes:[],generatedAt:'x'})
  expect(orderRouteAlternatives(details,'exposure')[0].route.id).toBe('sea_via')
  expect(orderRouteAlternatives(details,'eta')[0].route.id).toBe('fast')
  expect(riskAssessment(route('unavailable',null)).band).toBe('unknown')
  expect(riskAssessment(route('alert',31,'reported_alert')).band).toBe('elevated')
 })
 it('shows origin, transshipment, Qatar, customs and warehouse with truthful status',()=>{
  const stages=routePassages(route('sea_via',57))
  expect(stages.map(x=>x.stage).join(' ')).toContain('transfer')
  expect(stages.map(x=>x.stage).join(' ')).toContain('Qatar arrival')
  expect(stages.at(-1)?.detail).toContain('unconfirmed')
  expect(stages.filter(x=>x.certainty==='pending').length).toBeGreaterThan(2)
 })
})
