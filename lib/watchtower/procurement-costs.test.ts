import {describe,it,expect} from 'vitest'
import {routeCostSummary} from './procurement-costs'
import {mapRouteEvidence,type CorridorOption,type CorridorPayload} from './procurement-route-evidence'
import type {Candidate,OriginReference} from './sourcing-autopilot'

const option:CorridorOption={
 id:'sea_direct',country:'IN',mode:'sea',via:null,
 from:'Origin port',to:'Hamad Port',originCode:'INABC',destinationCode:'QAHMD',
 estimatedDays:11,timeBasis:'model',quality:'model_only',
 costEstimate:{minQar:2000,maxQar:3000,sourceLabel:'Planning estimate'},
 exposure:{index:30,label:'screened'},riskBand:'no_nearby_reported_alert',
 riskDrivers:[],sourceUrl:null,distanceKm:2500,
 feasibleBeforeDeadline:true,requiresQuote:true,bookingConfirmed:false,
}
const origin:OriginReference={
 countryCode:'IN',countryName:'India',observedQatarImports:true,
 historicalUnitValueQarKg:2.5,year:2024,documentedLeads:1,
}
const contract:Candidate={
 id:'contract:1',kind:'contract',name:'Verified seller',country:'IN',
 countryName:'India',relevance:100,sourceUrl:null,sourceName:'Approved ledger',
 evidence:'Approved contract',capacityTonnes:100,priceQarPerTonne:1600,
 contractId:'1',approved:true,
}
const source=(tonnes:number,cost:CorridorOption['costEstimate']=option.costEstimate):CorridorPayload=>({
 context:{tonnes},routes:[{...option,costEstimate:cost}],mapRoutes:[],generatedAt:'x',
})
const summary=(tonnes:number,needed:number|null,candidates:Candidate[],
 origins:OriginReference[],cost:CorridorOption['costEstimate']=option.costEstimate)=>{
 const payload=source(tonnes,cost)
 const selected=mapRouteEvidence('IN',payload)[0]
 return routeCostSummary(selected,{IN:payload},candidates,origins,needed)
}
describe('Watchtower goods and freight costing',()=>{
 it('keeps historical CIF-like customs price separate from freight',()=>{
  const x=summary(20,20,[],[origin])
  expect(x.goods?.kind).toBe('historical_import')
  expect(x.goods?.totalQar).toBe(50000)
  expect(x.freight?.minQar).toBe(2000)
  expect(x.subtotal).toBeNull()
 })
 it('shows contract goods and screened freight as distinct amounts',()=>{
  const x=summary(20,20,[contract],[origin])
  expect(x.goods?.kind).toBe('approved_contract')
  expect(x.goods?.totalQar).toBe(32000)
  expect(x.freight?.maxQar).toBe(3000)
  expect(x.subtotal).toEqual({minQar:34000,maxQar:35000})
  expect(x.coversRequestedQuantity).toBe(true)
 })
 it('flags 200 tonne screening for a larger order without extrapolation',()=>{
  const x=summary(200,350,[],[origin])
  expect(x.coversRequestedQuantity).toBe(false)
  expect(x.evaluatedTonnes).toBe(200)
  expect(x.subtotal).toBeNull()
 })
 it('never invents freight or combined cost from missing route evidence',()=>{
  const x=summary(20,20,[contract],[],null)
  expect(x.goods?.totalQar).toBe(32000)
  expect(x.freight).toBeNull()
  expect(x.subtotal).toBeNull()
 })
})
