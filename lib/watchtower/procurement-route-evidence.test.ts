import {describe,it,expect} from 'vitest'
import {mapRouteEvidence,orderRouteAlternatives,routePassages,
 riskAssessment,routeKey,routeOptionReport,displayFreight,preferredCorridor,type CorridorOption} from './procurement-route-evidence'
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
 it('shows indicative QAR freight totals and QAR per tonne, respecting quantity',()=>{
  const r=route('sea_direct',44)
  const shown=displayFreight(r,20,20)
  expect(shown?.minQar).toBe(2500)
  expect(shown?.maxQar).toBe(5300)
  expect(shown?.perTonneMin).toBe(125)
  expect(shown?.perTonneMax).toBe(265)
  expect(displayFreight(r,40,20)).toBeNull()
  expect(displayFreight({...r,costEstimate:null},20,20)).toBeNull()
 })
 it('recommends one primary feasible evidenced route rather than all routes',()=>{
  const routes=mapRouteEvidence('IN',{routes:[route('a',66),route('b',33)],
   mapRoutes:[],generatedAt:'x'})
  expect(preferredCorridor(routes)?.key).toBe('IN:b')
 })
 it('shows origin, transshipment, Qatar, customs and warehouse with truthful status',()=>{
  const stages=routePassages(route('sea_via',57))
  expect(stages.map(x=>x.stage).join(' ')).toContain('transfer')
  expect(stages.map(x=>x.stage).join(' ')).toContain('Qatar arrival')
  expect(stages.at(-1)?.detail).toContain('unconfirmed')
  expect(stages.filter(x=>x.certainty==='pending').length).toBeGreaterThan(2)
 })
})
