import {describe,it,expect} from 'vitest'
import {rankSourcingCandidates,diverseShortlist,buildSourcingScenarios,
  planApprovedOrders,sourcingBrief,type SourcingLead,type EligibleContract,
  type RouteReview} from './sourcing-autopilot'
const lead=(id:string,country:string):SourcingLead=>({
 recordId:id,organizationName:'Farm '+id,countryCode:country,countryName:country,
 matchedProduct:'Wheat',sourceName:'registry',sourceUrl:'https://example.org/'+id,
 evidenceType:'company_product_document',supplierApproved:false,
 exportCapabilityConfirmed:false,capacityTonnes:null,
})
const contract=(id:string,capacity:number):EligibleContract=>({
 id,supplierId:id,supplierName:'Approved '+id,countryCode:'TR',
 contractRef:id,availableTonnes:capacity,priceQarPerTonne:1000,validTo:'2027-01-01',
 verification:'approved_supplier_and_current_contract',
})
const route=(country:string,days:number):RouteReview=>({
 id:country+'-sea',country,mode:'sea',via:null,estimatedDays:days,timeBasis:'screened',
 costEstimate:null,exposure:{index:35,label:'moderate'},requiresQuote:true,
 bookingConfirmed:false,feasibleBeforeDeadline:true,
})
describe('Sourcing autopilot: real evidence, not supplier certification',()=>{
 it('makes multi-country prospects available even when no approved contracts exist',()=>{
  const candidates=rankSourcingCandidates([lead('a','IN'),lead('b','TR'),lead('c','TH')],[])
  expect(candidates).toHaveLength(3)
  expect(candidates.every(x=>!x.approved&&x.capacityTonnes===null)).toBe(true)
  const alternatives=buildSourcingScenarios(candidates,{IN:[route('IN',18)],
    TR:[route('TR',8)],TH:[route('TH',14)]},[],40)
  expect(alternatives.length).toBeGreaterThanOrEqual(2)
  expect(alternatives[0].countries).toHaveLength(3)
  expect(alternatives[0].blockers.join(' ')).toContain('Prospect qualification')
  expect(planApprovedOrders(candidates,candidates.map(x=>x.id),40).ready).toBe(false)
 })
 it('does not confuse annual import values with price quotes',()=>{
  const candidates=rankSourcingCandidates([lead('a','IN')],[],[{
   countryCode:'IN',countryName:'India',observedQatarImports:true,
   historicalUnitValueQarKg:2.2,year:2024,documentedLeads:1,
  }])
  const scenarios=buildSourcingScenarios(candidates,{},[{
   countryCode:'IN',countryName:'India',observedQatarImports:true,
   historicalUnitValueQarKg:2.2,year:2024,documentedLeads:1,
  }],null)
  expect(scenarios.some(s=>s.id==='historical')).toBe(true)
  expect(scenarios[0].allocation[0].plannedTonnes).toBeNull()
  expect(scenarios[0].blockers).toContain('Reviewed demand quantity unavailable')
 })
 it('splits eligible contracts into bounded PO pieces and rejects insufficient stock',()=>{
  const candidates=rankSourcingCandidates([], [contract('a',240),contract('b',170)])
  const selection=candidates.map(c=>c.id)
  const plan=planApprovedOrders(candidates,selection,350)
  expect(plan.ready).toBe(true)
  expect(plan.lines).toHaveLength(3)
  expect(plan.lines.every(line=>line.tonnes<=200)).toBe(true)
  expect(plan.lines.reduce((sum,x)=>sum+x.tonnes,0)).toBe(350)
  expect(planApprovedOrders(candidates,selection,500).ready).toBe(false)
  expect(planApprovedOrders(candidates,selection,null).ready).toBe(false)
 })
 it('preserves multiple alternatives and does not present leads as legal vendors',()=>{
  const candidates=rankSourcingCandidates([lead('a','IN'),lead('b','TR')],[])
  expect(diverseShortlist(candidates,2).map(x=>x.country)).toEqual(
    expect.arrayContaining(['IN','TR']))
  const brief=sourcingBrief('Wheat',35,candidates,null)
  expect(brief).toContain('NOT a purchase order')
  expect(brief).toContain('Unqualified lead')
  expect(brief).toContain('Independent procurement and order approval required')
 })
})
