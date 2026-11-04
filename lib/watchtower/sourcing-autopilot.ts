/**
 * Evidence-first sourcing plan. A documented crop-sector lead is NOT a vendor,
 * does not prove stock, export eligibility or an offered price. Historical
 * import unit values are NOT a commercial quote or landed cost.
 */
export type SourcingLead={
  recordId:string;organizationName:string;countryCode:string;countryName:string
  matchedProduct:string;sourceName:string;sourceUrl:string
  evidenceType?:string;evidenceSummary?:string;registryCheckedOn?:string
  supplierApproved:false;capacityTonnes:null;exportCapabilityConfirmed:false
}
export type EligibleContract={
  id:string;supplierId:string;supplierName:string|null;countryCode:string
  contractRef:string|null;availableTonnes:number;priceQarPerTonne:number
  validTo:string;verification:'approved_supplier_and_current_contract'
}
import type {PlanningPriceReference} from '@/lib/nfii/procurement-planning-prices'
export type OriginReference={
  countryCode:string;countryName:string;observedQatarImports:boolean
  historicalUnitValueQarKg:number|null;year:number|null;documentedLeads:number
 planningPrice?:PlanningPriceReference|null
}
export type RouteReview={
  id:string;country:string;mode:'sea'|'air'|'road';via:string|null
  estimatedDays:number|null;timeBasis:string;quality?:string
  costEstimate:{minQar:number;maxQar:number;sourceLabel?:string}|null
  exposure:{index:number|null;label:string};feasibleBeforeDeadline:boolean|null
  requiresQuote:true;bookingConfirmed:false
}
export type Candidate={
  id:string;kind:'contract'|'lead';name:string;country:string;countryName:string
  relevance:number;sourceUrl:string|null;sourceName:string
  evidence:string;capacityTonnes:number|null;priceQarPerTonne:number|null
  contractId:string|null;approved:boolean
}
export type RouteResult={country:string;routes:RouteReview[];error?:string}
export type SourcingScenario={
  id:'diversified'|'fastest'|'historical'|'contract'
  title:string;description:string;candidateIds:string[];countries:string[]
  route:RouteReview|null;estimatedDays:number|null;historicalUnitValueQarKg:number|null
  allocation:{candidateId:string;plannedTonnes:number|null}[]
  confidence:'conditional'|'limited';blockers:string[]
}
const quality=(v:string|undefined)=>{
  switch(v){
    case 'product_listed_in_certification_directory':return 75
    case 'company_product_document':return 73
    case 'farm_own_crop_claim':return 70
    case 'government_or_institutional_crop_profile':return 67
    case 'farm_product_catalogue':return 64
    case 'community_mapped_crop_tag':return 35
    case 'mapped_agricultural_business':return 18
    case 'keyword_business_listing':return 12
    default:return 44
  }
}
export function rankSourcingCandidates(
  leads:readonly SourcingLead[],contracts:readonly EligibleContract[],
  origins:readonly OriginReference[]=[],
):Candidate[]{
  const official=new Map(origins.map(row=>[row.countryCode,row]))
  const items:Candidate[]=[]
  const seen=new Set<string>()
  for(const contract of contracts){
    if(!contract.id||!contract.countryCode||contract.availableTonnes<=0||
      contract.priceQarPerTonne<=0)continue
    items.push({
      id:'contract:'+contract.id,kind:'contract',
      name:contract.supplierName??'Qualified supplier',country:contract.countryCode,
      countryName:official.get(contract.countryCode)?.countryName??contract.countryCode,
      relevance:100,sourceUrl:null,sourceName:'Authorized organization contract register',
      evidence:'Approved supplier and active approved contract',
      capacityTonnes:contract.availableTonnes,priceQarPerTonne:contract.priceQarPerTonne,
      contractId:contract.id,approved:true,
    })
    seen.add(contract.countryCode+'|'+(contract.supplierName??'').toLowerCase().trim())
  }
  for(const lead of leads){
    if(!lead.recordId||!lead.organizationName||!lead.countryCode||
      !/^https:\/\//.test(lead.sourceUrl))continue
    const signature=lead.countryCode+'|'+lead.organizationName.toLowerCase().trim()
    if(seen.has(signature))continue
    seen.add(signature)
    const ref=official.get(lead.countryCode)
    items.push({
      id:'lead:'+lead.countryCode+':'+lead.recordId,
      kind:'lead',name:lead.organizationName,country:lead.countryCode,
      countryName:lead.countryName||ref?.countryName||lead.countryCode,
      relevance:quality(lead.evidenceType)+(ref?.observedQatarImports?5:0),
      sourceUrl:lead.sourceUrl,sourceName:lead.sourceName,
      evidence:lead.matchedProduct,capacityTonnes:null,priceQarPerTonne:null,
      contractId:null,approved:false,
    })
  }
  return items.sort((a,b)=>b.relevance-a.relevance||
    a.name.localeCompare(b.name))
}
export function diverseShortlist(items:readonly Candidate[],limit=6):Candidate[]{
  const result:Candidate[]=[],used=new Set<string>(),selected=new Set<string>()
  // Give each documented origin a chance before adding a second candidate
  for(const item of items){
    if(result.length>=limit)break
    if(used.has(item.country))continue
    result.push(item);used.add(item.country);selected.add(item.id)
  }
  for(const item of items){
    if(result.length>=limit)break
    if(selected.has(item.id))continue
    result.push(item);selected.add(item.id)
  }
  return result
}
export function bestScreenedRoute(routes:readonly RouteReview[]):RouteReview|null{
  const allowed=routes.filter(r=>r.feasibleBeforeDeadline!==false)
  if(!allowed.length)return null
  return [...allowed].sort((a,b)=>{
    const etaA=a.estimatedDays??Infinity,etaB=b.estimatedDays??Infinity
    return etaA-etaB||
      (a.exposure.index??Infinity)-(b.exposure.index??Infinity)
  })[0]
}
function partitions(items:readonly Candidate[],target:number|null){
  return items.map((item,index)=>({
    candidateId:item.id,plannedTonnes:target===null?null:
      Math.max(0,Math.round((index===items.length-1?
        target-target*(items.length-1)/items.length:target/items.length)*100)/100),
  }))
}
export function buildSourcingScenarios(
  candidates:readonly Candidate[],routeByCountry:Readonly<Record<string,readonly RouteReview[]>>,
  origins:readonly OriginReference[],target:number|null,
):SourcingScenario[]{
  if(!candidates.length)return []
  const different=diverseShortlist(candidates,3)
  const routeFor=(country:string)=>bestScreenedRoute(routeByCountry[country]??[])
  const derived=(id:SourcingScenario['id'],title:string,description:string,
    picks:Candidate[]):SourcingScenario=>{
    const countries=[...new Set(picks.map(x=>x.country))]
    const screened=countries.map(routeFor).filter((x):x is RouteReview=>x!==null)
    const route=screened.length?bestScreenedRoute(screened):null
    const priced=origins.filter(x=>countries.includes(x.countryCode)&&
      x.historicalUnitValueQarKg!==null).sort((a,b)=>
      (a.historicalUnitValueQarKg??Infinity)-(b.historicalUnitValueQarKg??Infinity))
    const blockers:string[]=[]
    if(picks.some(x=>!x.approved))blockers.push('Prospect qualification, export license and actual offers required')
    if(picks.some(x=>x.capacityTonnes===null))blockers.push('Available tonnage not independently confirmed')
    if(!screened.length&&countries.some(x=>x!=='QA'))blockers.push('Validated route/ETA unavailable')
    if(!countries.every(x=>x==='QA'))blockers.push('Freight quote, shipping booking and customs clearance pending')
    if(target===null)blockers.push('Reviewed demand quantity unavailable')
    return {
      id,title,description,candidateIds:picks.map(x=>x.id),countries,route,
      estimatedDays:route?.estimatedDays??null,
      historicalUnitValueQarKg:priced[0]?.historicalUnitValueQarKg??null,
      allocation:partitions(picks,target),
      confidence:blockers.length?'limited':'conditional',blockers,
    }
  }
  const scenarios:SourcingScenario[]=[
    derived('diversified','Diversified supply',
      'Distributes the planning volume across distinct documented origins, without assuming capacity.',
      different),
  ]
  const candidatesWithRoutes=candidates.flatMap(c=>{
    const route=routeFor(c.country)
    return route&&route.estimatedDays!==null?[{c,route}]:[]
  }).sort((a,b)=>a.route.estimatedDays!-b.route.estimatedDays!)
  if(candidatesWithRoutes.length)scenarios.push(derived('fastest','Fastest screened corridor',
    'Prioritizes the shortest available theoretical transport ETA, not a carrier commitment.',
    candidatesWithRoutes.slice(0,2).map(x=>x.c)))
  const priced=candidates.flatMap(c=>{
    const historical=origins.find(x=>x.countryCode===c.country)?.historicalUnitValueQarKg
    return historical!==null&&historical!==undefined?[{c,historical}]:[]
  }).sort((a,b)=>a.historical-b.historical)
  if(priced.length)scenarios.push(derived('historical','Lower historical import value',
    'Origin reference from annual Qatar customs unit values; not an offered price.',
    priced.slice(0,2).map(x=>x.c)))
  const qualified=candidates.filter(x=>x.approved).sort((a,b)=>
    (a.priceQarPerTonne??Infinity)-(b.priceQarPerTonne??Infinity))
  if(qualified.length)scenarios.push(derived('contract','Existing approved contracts',
    'Only this scenario can support a real pending purchase order after capacity checks.',
    qualified.slice(0,4)))
  return scenarios
}
export type PurchasePiece={contractId:string;tonnes:number;priceQarPerTonne:number}
export function planApprovedOrders(
  candidates:readonly Candidate[],selection:readonly string[],target:number|null,
):{lines:PurchasePiece[];shortfall:number|null;ready:boolean}{
  if(target===null||!Number.isFinite(target)||target<0.1||target>600)
    return {lines:[],shortfall:target,ready:false}
  let remaining=target
  const eligible=candidates.filter(item=>selection.includes(item.id)&&item.approved&&
    item.contractId!==null&&item.capacityTonnes!==null&&item.priceQarPerTonne!==null)
   .sort((a,b)=>(a.priceQarPerTonne??Infinity)-(b.priceQarPerTonne??Infinity))
  const lines:PurchasePiece[]=[]
  for(const candidate of eligible){
    if(remaining<=0.00001)break
    let cap=Math.min(remaining,candidate.capacityTonnes!)
    while(cap>=0.1&&lines.length<15){
      const quantity=Math.round(Math.min(200,cap)*1000)/1000
      lines.push({contractId:candidate.contractId!,tonnes:quantity,
        priceQarPerTonne:candidate.priceQarPerTonne!})
      cap=Math.round((cap-quantity)*1000)/1000
      remaining=Math.round((remaining-quantity)*1000)/1000
    }
  }
  return {lines,shortfall:remaining,ready:remaining<=0.00001&&lines.length>0}
}
export function sourcingBrief(crop:string,quantity:number|null,selected:readonly Candidate[],
  scenario:SourcingScenario|null){
  const lines=[
    'GROWA | SOURCING & QUALIFICATION BRIEF',
    'Commodity: '+crop,
    'Planning demand: '+(quantity===null?'NOT VERIFIED':quantity+' tonnes'),
    'Status: draft RFQ / supplier due diligence, NOT a purchase order',
    'Strategy: '+(scenario?.title??'Not selected'),
    'Origins: '+(scenario?.countries.join(', ')||'Not determined'),
    '',
    'SUPPLIER OPTIONS (none verified merely by this brief)',
  ]
  for(const item of selected){
    lines.push('- '+item.name+' ('+item.country+') | '+(item.approved?'Approved contract':'Unqualified lead')+
      ' | '+(item.sourceUrl??item.sourceName))
  }
  lines.push('','DOCUMENTS TO REQUEST: entity registration, agricultural product proof, export eligibility,',
    'quality certificate, phytosanitary/import permits, live capacity (tonnes), firm QAR quote,',
    'grade/specifications, Incoterms, freight quote, route & carrier booking, agreed delivery ETA.',
    'Only approved vendor + active approved contract may be used for live purchase orders.',
    'Independent procurement and order approval required.')
  return lines.join('\n')
}
