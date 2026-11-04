/** Bounded procurement-mission planning and approval gates.
 * Gate decisions are local workflow review only; real purchase order approval is
 * enforced independently by nfii_review_operation in Supabase.
 */
export const MISSION_STEPS=[
 {id:'need',title:'Quantity & demand',details:'Confirm reviewed shortfall and requested quantity'},
 {id:'suppliers',title:'Global supplier discovery',details:'Inspect multiple documented producer leads and approved vendors'},
 {id:'shortlist',title:'Supplier shortlist approval',details:'Approve options for due diligence, not supplier certification'},
 {id:'allocation',title:'Quantity allocation',details:'Distribute quantity across approved contractual capacities'},
 {id:'logistics',title:'Logistics alternatives',details:'Compare source-backed corridor estimates by origin'},
 {id:'commercial',title:'Commercial comparison',details:'Check contract prices, route limits and procurement readiness'},
 {id:'submission',title:'Purchase order proposal',details:'Submit pending purchase orders for independent approval'},
] as const
export type MissionStage=typeof MISSION_STEPS[number]['id']
export type MissionDecision='approved'|'rejected'
export type ContractOption={
 id:string;supplierId:string;supplierName:string|null;countryCode:string;
 contractRef:string|null;availableTonnes:number;priceQarPerTonne:number;
 validTo:string;verification:'approved_supplier_and_current_contract'
}
export type SourceLead={
 recordId:string;organizationName:string;countryCode:string;countryName:string;
 matchedProduct:string;sourceName:string;sourceUrl:string;
 supplierApproved:false;capacityTonnes:null;exportCapabilityConfirmed:false
}
export type Allocation={contractId:string;tonnes:number}
export type RouteCandidate={
 id:string;country:string;mode:'sea'|'air'|'road';via:string|null;
 estimatedDays:number|null;timeBasis:string;costEstimate:{
  minQar:number;maxQar:number;sourceLabel:string
 }|null;exposure:{index:number|null;label:string};requiresQuote:true;
 bookingConfirmed:false;feasibleBeforeDeadline:boolean|null
}
export type MissionAction={stage:MissionStage;decision:MissionDecision;at:string;note:string}
export function validateAllocations(options:readonly ContractOption[],
 allocations:readonly Allocation[],target:number){
 if(!Number.isFinite(target)||target<0.1||target>600)
  return 'Enter a required quantity between 0.1 and 600 tonnes.'
 if(!allocations.length)return 'Select at least one approved contract.'
 const seen=new Set<string>()
 let total=0
 for(const a of allocations){
  const option=options.find(x=>x.id===a.contractId)
  if(!option||seen.has(a.contractId))return 'Duplicate or unapproved contract.'
  seen.add(a.contractId)
  if(!Number.isFinite(a.tonnes)||a.tonnes<0.1||a.tonnes>200)
   return 'Each planned shipment must be 0.1–200 tonnes.'
  if(a.tonnes>option.availableTonnes+0.00001)
   return 'Allocation exceeds the approved contract remaining capacity.'
  total+=a.tonnes
 }
 if(Math.abs(total-target)>0.001)
  return 'Sum of the selected allocations must match required quantity.'
 return null
}
export function estimatedGoodsValue(options:readonly ContractOption[],
 allocations:readonly Allocation[]){
 return allocations.reduce((sum,row)=>{
  const item=options.find(option=>option.id===row.contractId)
  return sum+(item?row.tonnes*item.priceQarPerTonne:0)
 },0)
}
export function previousMissionStep(index:number){return Math.max(0,index-1)}
export function nextMissionStep(index:number){return Math.min(MISSION_STEPS.length-1,index+1)}
export function validRouteChoices(allocations:readonly Allocation[],
 contracts:readonly ContractOption[],choices:Readonly<Record<string,string>>,
 routes:Readonly<Record<string,readonly RouteCandidate[]>>){
 for(const allocation of allocations){
  const contract=contracts.find(x=>x.id===allocation.contractId)
  if(!contract)return false
  if(contract.countryCode==='QA')continue
  const candidates=routes[contract.countryCode]??[]
  const selected=candidates.find(x=>x.id===choices[contract.countryCode])
  if(!selected||selected.feasibleBeforeDeadline===false)return false
 }
 return true
}
