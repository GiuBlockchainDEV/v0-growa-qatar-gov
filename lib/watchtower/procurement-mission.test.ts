import {describe,expect,it} from 'vitest'
import {
 MISSION_STEPS,validateAllocations,estimatedGoodsValue,previousMissionStep,
 nextMissionStep,validRouteChoices,type ContractOption,type RouteCandidate,
} from './procurement-mission'
const option=(id:string,capacity:number,countryCode='IN'):ContractOption=>({
 id,supplierId:'s'+id,supplierName:'Supplier '+id,countryCode,
 contractRef:'ref'+id,availableTonnes:capacity,priceQarPerTonne:1200,
 validTo:'2027-01-01',verification:'approved_supplier_and_current_contract',
})
describe('Procurement mission approval gates',()=>{
 const options=[option('a',40),option('b',60,'TR')]
 it('supports multiple supplier allocations without hiding over-allocation',()=>{
  const rows=[{contractId:'a',tonnes:30},{contractId:'b',tonnes:50}]
  expect(validateAllocations(options,rows,80)).toBeNull()
  expect(estimatedGoodsValue(options,rows)).toBe(96000)
  expect(validateAllocations(options,rows,100)).toMatch(/must match/)
  expect(validateAllocations(options,[{contractId:'a',tonnes:41}],41)).toMatch(/capacity/)
  expect(validateAllocations(options,[{contractId:'a',tonnes:210}],210)).toMatch(/0.1/)
  expect(validateAllocations(options,[{contractId:'not-approved',tonnes:10}],10))
   .toMatch(/unapproved/)
 })
 it('returns to previous step after a rejection',()=>{
  expect(MISSION_STEPS).toHaveLength(7)
  expect(previousMissionStep(0)).toBe(0)
  expect(previousMissionStep(5)).toBe(4)
  expect(nextMissionStep(0)).toBe(1)
  expect(nextMissionStep(6)).toBe(6)
 })
 it('requires route selection for every non-Qatari selected origin',()=>{
  const routes:Record<string,RouteCandidate[]>={
   IN:[{id:'sea',country:'IN',mode:'sea',via:null,estimatedDays:17,
     timeBasis:'planning',costEstimate:null,
     exposure:{index:null,label:'unknown'},requiresQuote:true,
     bookingConfirmed:false,feasibleBeforeDeadline:true}],
   TR:[{id:'air',country:'TR',mode:'air',via:null,estimatedDays:2,
     timeBasis:'model only',costEstimate:null,
     exposure:{index:null,label:'unknown'},requiresQuote:true,
     bookingConfirmed:false,feasibleBeforeDeadline:null}],
  }
  const allocations=[{contractId:'a',tonnes:25},{contractId:'b',tonnes:30}]
  expect(validRouteChoices(allocations,options,{IN:'sea'},routes)).toBe(false)
  expect(validRouteChoices(allocations,options,{IN:'sea',TR:'air'},routes)).toBe(true)
 })
})
