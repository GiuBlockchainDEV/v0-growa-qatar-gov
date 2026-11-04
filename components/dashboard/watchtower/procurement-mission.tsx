'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {
  ArrowLeft,ArrowUpRight,Check,CheckCircle2,ClipboardCheck,
  FileCheck2,Globe2,PackageCheck,RefreshCw,
  ShieldCheck,Ship,Truck,XCircle,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {FoodPosture} from '@/lib/watchtower/food-posture'
import {CARGO_SPECS} from '@/lib/nfii/logistics-lanes'
import {
  MISSION_STEPS,validateAllocations,estimatedGoodsValue,validRouteChoices,
  previousMissionStep,nextMissionStep,
  type ContractOption,type SourceLead,type Allocation,type RouteCandidate,
  type MissionAction,
} from '@/lib/watchtower/procurement-mission'
import styles from './procurement-mission.module.css'

type ApprovedResponse={
  organizationId:string;commodity:string;source:'organization_procurement_ledger'
  available:boolean;options:ContractOption[];error?:string
}
type LeadResponse={
  results:SourceLead[];researchStatus:string;note?:string
  error?:string
}
type CorridorResponse={routes:RouteCandidate[];context?:{country:string};error?:string}
type Submitted={contractId:string;quantity:number;orderRef:string;status:'pending'|'error';message:string}
type ReviewStatus={id:string;status:string;target_type?:string;target_id?:string}
const number=(n:number,dp=1)=>n.toLocaleString('en-US',{maximumFractionDigits:dp})
const gateText=[
 ['Confirm demand','تأكيد الطلب'],
 ['Approve supplier research','الموافقة على البحث عن الموردين'],
 ['Approve shortlist','الموافقة على القائمة المختصرة'],
 ['Approve quantity allocation','الموافقة على توزيع الكميات'],
 ['Approve logistics scenarios','الموافقة على السيناريوهات اللوجستية'],
 ['Approve commercial review','الموافقة على المراجعة التجارية'],
 ['Submit for independent PO approval','إرسال الطلب للموافقة المستقلة'],
] as const
function errorText(error:unknown){
 return error instanceof Error?error.message:'A verified source is unavailable'
}
function formatPrice(n:number){return number(n,2)+' QAR'}
function responseError(payload:unknown,fallback:string){
 if(payload&&typeof payload==='object'&&'error'in payload&&
  typeof payload.error==='string')return payload.error
 return fallback
}
export function WatchtowerProcurementMission({posture}:{posture:FoodPosture}){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const tx=(en:string,arabic:string)=>ar?arabic:en
 const [commodityId,setCommodityId]=useState(posture.commodities[0]?.commodityId??'')
 const validCommodity=posture.commodities.find(x=>x.commodityId===commodityId)
 const commodity=validCommodity??posture.commodities[0]
 const supported=Boolean(commodity&&CARGO_SPECS[commodity.commodityId])
 const [stage,setStage]=useState(0)
 const [targetText,setTargetText]=useState('')
 const [leadRows,setLeadRows]=useState<SourceLead[]>([])
 const [contracts,setContracts]=useState<ContractOption[]>([])
 const [shortlist,setShortlist]=useState<string[]>([])
 const [allocations,setAllocations]=useState<Record<string,string>>({})
 const [routes,setRoutes]=useState<Record<string,RouteCandidate[]>>({})
 const [routeSelected,setRouteSelected]=useState<Record<string,string>>({})
 const [researchStatus,setResearchStatus]=useState<'idle'|'loading'|'ready'|'partial'|'error'>('idle')
 const [routeStatus,setRouteStatus]=useState<'idle'|'loading'|'ready'|'partial'|'error'>('idle')
 const [sourceErrors,setSourceErrors]=useState<string[]>([])
 const [routeErrors,setRouteErrors]=useState<string[]>([])
 const [decisions,setDecisions]=useState<MissionAction[]>([])
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [reason,setReason]=useState('')
 const [submission,setSubmission]=useState<Submitted[]>([])
 const [submitted,setSubmitted]=useState(false)
 const [reviewRows,setReviewRows]=useState<ReviewStatus[]>([])
 const org=posture.organizationId
 const selectedCommodity=commodity?.commodityId??''
 const target=Number(targetText)
 const chosen=useMemo(()=>contracts.filter(item=>shortlist.includes(item.id)),
  [contracts,shortlist])
 const selectedAllocations=useMemo<Allocation[]>(()=>chosen.flatMap(item=>{
  const value=Number(allocations[item.id]??0)
  return value>0?[{contractId:item.id,tonnes:value}]:[]
 }),[chosen,allocations])
 const allocationError=validateAllocations(chosen,selectedAllocations,target)
 const origins=useMemo(()=>[...new Set(selectedAllocations.map(a=>
  contracts.find(c=>c.id===a.contractId)?.countryCode)
  .filter((x):x is string=>Boolean(x)))].filter(x=>x!=='QA'),
  [selectedAllocations,contracts])
 const logisticsValid=validRouteChoices(selectedAllocations,contracts,routeSelected,routes)
 const totalGoods=estimatedGoodsValue(contracts,selectedAllocations)
 const latestSubmitted=useMemo(()=>submission.filter(x=>x.status==='pending'),[submission])
 const completed=decisions.filter(x=>x.decision==='approved').length
 const selectedLeadRows=leadRows.slice(0,80)
 const approvedChoices=contracts.filter(c=>c.availableTonnes>0)
 const dateLabel=posture.fromDate+' → '+posture.toDate

 // Scope, source and selected-commodity updates invalidate previous local gates.
 const resetMission=()=>{
  setStage(0);setTargetText('');setLeadRows([]);setContracts([])
  setShortlist([]);setAllocations({});setRoutes({});setRouteSelected({})
  setResearchStatus('idle');setRouteStatus('idle');setSourceErrors([])
  setRouteErrors([]);setDecisions([]);setBusy(false);setMessage('')
  setReason('');setSubmission([]);setSubmitted(false);setReviewRows([]);setOrderStates([]);setReviewBusy(null)
 }
 useEffect(()=>{resetMission()},[posture])
 const changeCommodity=(id:string)=>{setCommodityId(id);resetMission()}
 const fetchSuppliers=useCallback(async()=>{
  if(!supported||!selectedCommodity)return
  setResearchStatus('loading');setSourceErrors([])
  const base={organizationId:org,commodity:selectedCommodity}
  const urls=[
   '/api/watchtower/procurement-agent?'+new URLSearchParams(base),
   '/api/nfii/procurement/crop-producers?'+new URLSearchParams({
    ...base,research:'curated',
   }),
  ]
  const responses=await Promise.allSettled(urls.map(async url=>{
   const response=await fetch(url,{cache:'no-store'})
   const body:unknown=await response.json()
   if(!response.ok)throw Error(responseError(body,'Supplier source unavailable'))
   return body
  }))
  const issues:string[]=[]
  const approved=responses[0].status==='fulfilled'?
   responses[0].value as ApprovedResponse:null
  const leads=responses[1].status==='fulfilled'?
   responses[1].value as LeadResponse:null
  if(!approved||!Array.isArray(approved.options)){
   issues.push(responses[0].status==='rejected'?errorText(responses[0].reason):
    'Approved contracts unavailable')
  }
  if(!leads||!Array.isArray(leads.results)){
   issues.push(responses[1].status==='rejected'?errorText(responses[1].reason):
    'Public crop-sector leads unavailable')
  }
  setContracts(approved?.options??[])
  setLeadRows(leads?.results??[])
  setSourceErrors(issues)
  setResearchStatus(issues.length===2?'error':issues.length?'partial':'ready')
 },[org,selectedCommodity,supported])
 useEffect(()=>{
  if(stage===1&&researchStatus==='idle')void fetchSuppliers()
 },[stage,researchStatus,fetchSuppliers])

 const fetchCorridors=useCallback(async()=>{
  if(!supported||!origins.length){setRoutes({});setRouteStatus('ready');return}
  if(!selectedAllocations.length){setRouteStatus('error');return}
  setRouteStatus('loading');setRouteErrors([])
  const results=await Promise.allSettled(origins.map(async country=>{
   const tonnes=selectedAllocations.filter(a=>
    contracts.find(x=>x.id===a.contractId)?.countryCode===country)
    .reduce((sum,a)=>sum+a.tonnes,0)
   if(tonnes<0.1||tonnes>200)throw Error(country+': country volume must be between 0.1 and 200 tonnes')
   const limitDays=CARGO_SPECS[selectedCommodity]?.maxTransitDays??60
   const params=new URLSearchParams({
    organizationId:org,commodity:selectedCommodity,country,
    tonnes:String(tonnes),limitDays:String(limitDays),supplierScope:'approved',
   })
   const response=await fetch('/api/nfii/logistics/corridors?'+params,{cache:'no-store'})
   const body:unknown=await response.json()
   if(!response.ok)throw Error(country+': '+responseError(body,'Corridor not available'))
   const payload=body as CorridorResponse
   if(!Array.isArray(payload.routes))throw Error(country+': Invalid route response')
   return {country,routes:payload.routes}
  }))
  const next:Record<string,RouteCandidate[]>={},issues:string[]=[]
  results.forEach((result,index)=>{
   if(result.status==='fulfilled')next[result.value.country]=result.value.routes
   else issues.push(origins[index]+': '+errorText(result.reason))
  })
  setRoutes(next);setRouteErrors(issues)
  setRouteStatus(issues.length===origins.length?'error':issues.length?'partial':'ready')
 },[origins,selectedAllocations,contracts,org,selectedCommodity,supported])
 useEffect(()=>{
  if(stage===4&&routeStatus==='idle')void fetchCorridors()
 },[stage,routeStatus,fetchCorridors])

 const approve=()=>{
  if(busy||submitted)return
  const error=stage===0?
   (!Number.isFinite(target)||target<0.1||target>600?
    'Set required quantity between 0.1 and 600 tonnes.':null):
   stage===1?
    (researchStatus==='loading'||researchStatus==='idle'?'Supplier research is running.':
     researchStatus==='error'?'Supplier sources unavailable.':
     !leadRows.length&&!approvedChoices.length?'No sourced candidates to review.':null):
   stage===2?
    (!shortlist.length?'Select multiple or at least one approved contract.':
     shortlist.some(id=>!contracts.some(c=>c.id===id))?'Invalid selection.':null):
   stage===3?allocationError:
   stage===4?
    (routeStatus==='loading'||routeStatus==='idle'?'Route screening is running.':
     !logisticsValid?'Select a valid screened route for each origin.':null):
   stage===5?
    (!logisticsValid?'Route screening must be approved first.':allocationError):null
  if(error){setMessage(error);return}
  setMessage('')
  setDecisions(prev=>[...prev.filter(x=>MISSION_STEPS.findIndex(s=>s.id===x.stage)<stage),
   {stage:MISSION_STEPS[stage].id,decision:'approved',at:new Date().toISOString(),
    note:'Approved local planning checkpoint, not an NFII legal authorization.'}])
  if(stage===3){setRouteStatus('idle');setRoutes({});setRouteSelected({})}
  setStage(nextMissionStep(stage))
 }
 const reject=()=>{
  if(busy||submitted||stage===0)return
  const returnTo=previousMissionStep(stage)
  setDecisions(prev=>[...prev.filter(x=>MISSION_STEPS.findIndex(s=>s.id===x.stage)<returnTo),
   {stage:MISSION_STEPS[stage].id,decision:'rejected',at:new Date().toISOString(),
    note:reason.trim()||'User requested revision'}])
  if(returnTo<=3){setRoutes({});setRouteSelected({});setRouteStatus('idle')}
  setStage(returnTo);setMessage('Returned to the previous checkpoint for revision.')
  setReason('')
 }
 const updateAllocation=(contractId:string,v:string)=>{
  setAllocations(prev=>({...prev,[contractId]:v}))
  setRouteStatus('idle');setRoutes({});setRouteSelected({})
 }
 const createPendingOrders=async()=>{
  if(submitted||busy)return
  if(stage!==6||!selectedAllocations.length||allocationError||!logisticsValid){
   setMessage('Complete all reviewed allocation and logistics checkpoints first.')
   return
  }
  if(decisions.filter(x=>x.decision==='approved').length!==6){
   setMessage('One or more intermediate approvals are missing.');return
  }
  const note=reason.trim()
  if(note.length<8){setMessage('Provide an 8-character minimum submission justification.');return}
  setBusy(true);setMessage('Submitting individual purchase order proposals…')
  const saved:Submitted[]=[]
  // Deliberately serial to avoid duplicate writes on repeated clicks and to
  // clearly display partial results. No bulk order or auto approval.
  for(const [index,allocation] of selectedAllocations.entries()){
   const ref='GRW-'+Date.now().toString(36).toUpperCase()+'-'+
    String(index+1).padStart(2,'0')
   try{
    const response=await fetch('/api/nfii/operations',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({organizationId:org,kind:'purchase_order',data:{
      contractId:allocation.contractId,orderRef:ref,orderedTonnes:allocation.tonnes,
     }}),
    })
    const body:unknown=await response.json()
    if(!response.ok)throw Error(responseError(body,'PO proposal rejected by server'))
    saved.push({contractId:allocation.contractId,quantity:allocation.tonnes,
     orderRef:ref,status:'pending',message:'Created in pending independent approval'})
   }catch(error){
    saved.push({contractId:allocation.contractId,quantity:allocation.tonnes,
     orderRef:ref,status:'error',message:errorText(error)})
   }
   setSubmission([...saved])
  }
  const success=saved.filter(x=>x.status==='pending').length
  if(success){
   setDecisions(prev=>[...prev,{stage:'submission',decision:'approved',
    note:note.slice(0,400),at:new Date().toISOString()}])
  }
  setSubmitted(true);setBusy(false)
  setMessage(success+' / '+selectedAllocations.length+
   ' proposals submitted as PENDING. Independent authorized approval is required.')
 }
 const reviewOrder=async(approvalId:string,decision:'approve'|'reject')=>{
  if(reviewBusy||reason.trim().length<8){
   setMessage('A review note of at least 8 characters is required.');return
  }
  setReviewBusy(approvalId);setMessage('Submitting independent review…')
  try{
   const response=await fetch('/api/nfii/operations/action',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     organizationId:org,kind:'approval',id:approvalId,action:decision,note:reason.trim(),
    }),
   })
   const body:unknown=await response.json()
   if(!response.ok)throw Error(responseError(body,
    'Independent approval refused. A proposer cannot approve their own order.'))
   setMessage('Review recorded by the authorized independent reviewer.')
   if(decision==='reject'){
    // A rejected persisted order cannot be edited in place. Go back
    // to commercial review and require a newly approved proposal.
    setStage(previousMissionStep(6));setSubmitted(false)
    setSubmission([]);setDecisions(prev=>prev.filter(x=>x.stage!=='submission'))
   }
   await refreshApprovals()
  }catch(error){setMessage(errorText(error))}
  finally{setReviewBusy(null)}
 }
 const refreshApprovals=async()=>{
  try{
   const response=await fetch('/api/nfii/operations?'+new URLSearchParams({
    organizationId:org,
   }),{cache:'no-store'})
   const raw:unknown=await response.json()
   if(!response.ok)throw Error(responseError(raw,'Review register unavailable'))
   const body=raw as {snapshot?:{purchaseOrders?:Array<{
    id:string;order_ref?:string;status?:string
   }> ;approvals?:ReviewStatus[]}}
   const refs=new Set(latestSubmitted.map(s=>s.orderRef))
   const orders=body.snapshot?.purchaseOrders?.filter(o=>o.order_ref&&refs.has(o.order_ref))??[]
   setReviewRows((body.snapshot?.approvals??[]).filter(a=>orders.some(o=>o.id===a.target_id)))
   setOrderStates(orders.filter((o):o is {id:string;order_ref:string;status:string}=>
    typeof o.order_ref==='string'&&typeof o.status==='string'))
   setMessage(orders.map(o=>o.order_ref+': '+o.status).join(' · ')||
    'No matching orders returned; confirm approval status in Procurement.')
  }catch(error){setMessage(errorText(error))}
 }
 if(!commodity)return <div className={styles.empty}>No commodities in the reviewed organization snapshot.</div>
 const unit=commodity.deficitTonnes!==null&&commodity.status==='complete'?
  commodity.deficitTonnes:null
 return <section className={styles.mission} aria-label="Growa sourcing-to-order multi-agent mission">
  <div className={styles.hero}>
   <div><span className={styles.eyebrow}><Globe2 size={14}/> GROWA / PROCUREMENT ORCHESTRATION</span>
    <h3>{tx('Source → plan → approve → order','المصدر ← التخطيط ← الموافقة ← الطلب')}</h3>
    <p>{tx('A guided, multi-supplier food security sourcing mission. Human gates stop each stage; live provider results are never fabricated.',
      'مسار توريد لعدة موردين مع توقف إلزامي عند كل موافقة دون اختلاق بيانات.')}</p>
   </div>
   <span className={styles.missionMode}>SOURCE-BACKED · APPROVAL GATED</span>
  </div>
  <div className={styles.metrics}>
   <div><small>Current commodity</small><strong>{commodity.name}</strong>
    <span>{dateLabel}</span></div>
   <div><small>Verified projected deficit</small><strong>
    {unit===null?'—':number(unit)+' t'}</strong><span>
     {unit===null?'Not assessed':'Period-end forecast'}</span></div>
   <div><small>Selected suppliers / contracts</small><strong>{shortlist.length}</strong>
    <span>{contracts.length} eligible contract options</span></div>
   <div><small>Planning checkpoints</small><strong>{completed} / 7</strong>
    <span>Independent order approval separate</span></div>
  </div>
  <div className={styles.stageStrip} role="group" aria-label="Procurement stages">
   {MISSION_STEPS.map((step,index)=><div key={step.id} className={styles.stage}
     data-active={stage===index} data-complete={decisions.some(d=>d.stage===step.id&&d.decision==='approved')}>
    <span>{index+1}</span>
    <strong>{step.title}</strong>
   </div>)}
  </div>
  <div className={styles.workArea}>
   <div className={styles.heading}>
    <span>CHECKPOINT {stage+1} / {MISSION_STEPS.length}</span>
    <h4>{MISSION_STEPS[stage].title}</h4>
    <p>{MISSION_STEPS[stage].details}</p>
   </div>
   {stage===0&&<div className={styles.section}>
    <label>Food commodity
     <select value={commodity.commodityId} onChange={e=>changeCommodity(e.target.value)}>
      {posture.commodities.map(row=><option value={row.commodityId} key={row.commodityId}>
       {ar?row.nameAr:row.name}</option>)}
     </select>
    </label>
    <div className={styles.gridTwo}>
     <div className={styles.summary}><strong>Reviewed food balance</strong>
      <p>Deficit: {unit===null?'Not verified':number(unit)+' t'}</p>
      <p>Coverage: {commodity.coverageDays===null?'Not available':
       number(commodity.coverageDays)+' days'}</p>
      <p>Evidence: {commodity.evidenceSourceRefs.length} reviewed references</p>
     </div>
     <label>Required procurement quantity · tonnes
      <input value={targetText} type="number" min="0.1" max="600" step="0.1"
       placeholder={unit!==null&&unit>0?String(unit):'Enter verified requirement'}
       onChange={e=>setTargetText(e.target.value)}/>
      <small>Manually confirmed requirement; it is never inferred from missing records.</small>
     </label>
    </div>
    {!supported&&<div className={styles.warning}>No supported shipping profile for this food.
      Select a supported commodity for global routing and procurement.</div>}
   </div>}
   {stage===1&&<div className={styles.section}>
    <div className={styles.actions}>
     <span>Directory research + organization-approved contracts</span>
     <button type="button" className={styles.secondary}
      disabled={researchStatus==='loading'} onClick={()=>void fetchSuppliers()}>
      <RefreshCw size={14}/> Refresh sources</button>
    </div>
    {researchStatus==='loading'&&<p className={styles.status}><RefreshCw size={14} className="animate-spin"/>
      Retrieving supplier evidence…</p>}
    {sourceErrors.map((e,i)=><p className={styles.warning} key={i}>{e}</p>)}
    <div className={styles.gridTwo}>
     <div className={styles.summary}><strong>{leadRows.length} documented leads</strong>
      <p>Public evidence only. No available tonnage or export eligibility confirmed.</p></div>
     <div className={styles.summary}><strong>{approvedChoices.length} contracted options</strong>
      <p>Only approved supplier + current approved contract can proceed to PO drafting.</p></div>
    </div>
    <div className={styles.leads}>
     {selectedLeadRows.slice(0,25).map(lead=><div className={styles.lead} key={lead.recordId}>
      <div><strong>{lead.organizationName}</strong><small>{lead.countryName} · {lead.matchedProduct}
       </small></div><a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer">
       Source <ArrowUpRight size={12}/></a>
     </div>)}
    </div>
    {leadRows.length>25&&<p className={styles.muted}>
     Showing first 25 sourced leads. Use Procurement for extended qualification.</p>}
   </div>}
   {stage===2&&<div className={styles.section}>
    <p>Select several approved supplier-contract options. Documented public leads cannot be
     used for purchase orders until registered and independently approved.</p>
    {approvedChoices.length===0?<div className={styles.warning}>
     No eligible approved contracts with available quantities. Qualify more suppliers in Procurement.
     <Link href="/dashboard/procurement">Open Procurement <ArrowUpRight size={12}/></Link>
    </div>:<div className={styles.options}>
     {approvedChoices.map(option=><label className={styles.option} key={option.id}
       data-selected={shortlist.includes(option.id)}>
       <input type="checkbox" checked={shortlist.includes(option.id)}
        onChange={e=>setShortlist(prev=>e.target.checked?
         [...prev,option.id]:prev.filter(id=>id!==option.id))}/>
       <div><strong>{option.supplierName??'Approved supplier'}</strong>
        <small>{option.countryCode} · Contract {option.contractRef??option.id.slice(0,8)}
        </small><span>Remaining: {number(option.availableTonnes)} t ·
         {formatPrice(option.priceQarPerTonne)}/t · Through {option.validTo}</span></div>
       <ShieldCheck size={17}/>
      </label>)}
    </div>}
    <p className={styles.muted}>{shortlist.length} contract options shortlisted for allocation.</p>
   </div>}
   {stage===3&&<div className={styles.section}>
    <p>Allocate the approved demand across several selected suppliers.
     Only available contractual capacity is permitted.</p>
    {chosen.map(option=><div className={styles.allocation} key={option.id}>
     <div><strong>{option.supplierName}</strong>
      <small>{option.countryCode} · Up to {number(option.availableTonnes)} t</small></div>
     <label>Tonnes
      <input type="number" min="0" max={option.availableTonnes}
       step="0.1" value={allocations[option.id]??''}
       onChange={e=>updateAllocation(option.id,e.target.value)}/>
     </label>
    </div>)}
    <div className={styles.totals}>
     <span>Target: {number(target)} t</span>
     <span>Allocated: {number(selectedAllocations.reduce((sum,x)=>sum+x.tonnes,0))} t</span>
     <strong>Goods value: {formatPrice(totalGoods)}</strong>
    </div>
    {allocationError&&<p className={styles.warning}>{allocationError}</p>}
   </div>}
   {stage===4&&<div className={styles.section}>
    <p>Comparing modeled transport corridors for each selected origin.
     Carrier booking, customs clearance and arrival are not confirmed.</p>
    {routeStatus==='loading'&&<div className={styles.status}><RefreshCw size={14} className="animate-spin"/>
     Retrieving logistics corridors, freight benchmarks and source-backed advisories…</div>}
    {routeErrors.map((e,i)=><p className={styles.warning} key={i}>{e}</p>)}
    {origins.length===0&&<p className={styles.summary}>Qatar local supply selected. International corridor screening not required.</p>}
    {origins.map(country=><div className={styles.country} key={country}>
     <h5><Ship size={14}/> Origin: {country}</h5>
     <div className={styles.routeList}>
      {(routes[country]??[]).map(route=><label className={styles.route} key={route.id}
       data-selected={routeSelected[country]===route.id}>
       <input type="radio" name={'route-'+country} value={route.id}
        checked={routeSelected[country]===route.id} onChange={()=>
         setRouteSelected(prev=>({...prev,[country]:route.id}))}/>
       <div><strong>{route.mode.toUpperCase()}{route.via?' via '+route.via:''}</strong>
        <span>{route.estimatedDays===null?'ETA unavailable':
         number(route.estimatedDays)+' planning days'} ·
         {route.costEstimate?
          formatPrice(route.costEstimate.minQar)+'–'+formatPrice(route.costEstimate.maxQar):
          'Carrier price unavailable'}</span>
        <small>Exposure {route.exposure.index===null?'not assessed':
         route.exposure.index+'/100 (index)'} ·
         {route.feasibleBeforeDeadline===false?'Exceeds planning deadline':
          'No carrier booking confirmed'}</small></div>
       <Truck size={16}/>
      </label>)}
     </div>
     {!routes[country]?.length&&routeStatus!=='loading'&&
      <p className={styles.warning}>No screened corridors available for this origin.</p>}
    </div>)}
   </div>}
   {stage===5&&<div className={styles.section}>
    <p>Compare the selected suppliers, quantities, source-backed routing alternatives and
     uncovered procurement terms before preparing a pending order.</p>
    <div className={styles.compare}>
     {selectedAllocations.map(a=>{
      const option=contracts.find(x=>x.id===a.contractId)
      if(!option)return null
      const route=routes[option.countryCode]?.find(x=>x.id===routeSelected[option.countryCode])
      return <div key={a.contractId} className={styles.compareRow}>
       <div><strong>{option.supplierName}</strong><small>
        {option.countryCode} · {number(a.tonnes)} t</small></div>
       <div>Goods <strong>{formatPrice(a.tonnes*option.priceQarPerTonne)}</strong>
        <small>{route?route.mode+' / '+(route.estimatedDays??'N/A')+' planning days':
         option.countryCode==='QA'?'Local':'Route unavailable'}</small></div>
       <div>{route?.costEstimate?
        'Freight benchmark: '+formatPrice(route.costEstimate.minQar)+'–'+
        formatPrice(route.costEstimate.maxQar):'Freight quote not verified'}
       </div>
      </div>
     })}
    </div>
    <div className={styles.warning}>Estimated logistics costs are not carrier offers.
     The purchase order uses approved contract goods prices only.
     Obtain binding freight rates, quality certificates, delivery and Incoterms separately.</div>
    <div className={styles.totals}><span>Suppliers: {selectedAllocations.length}</span>
     <span>Total: {number(target)} t</span><strong>Goods: {formatPrice(totalGoods)}</strong></div>
   </div>}
   {stage===6&&<div className={styles.section}>
    <div className={styles.summary}><strong>Proposed purchase orders</strong>
     <p>One PENDING purchase order for each allocated approved contract.
      Submission is a real database write and requires supply.edit permission;
      independent decisions.approve permission is needed to approve it.</p>
     <p>Total {number(target)} t · Goods contract value {formatPrice(totalGoods)}</p>
    </div>
    {selectedAllocations.map(a=>{
     const contract=contracts.find(c=>c.id===a.contractId)
     return <div className={styles.lead} key={a.contractId}>
      <div><strong>{contract?.supplierName??a.contractId}</strong>
       <small>{number(a.tonnes)} t · {contract?formatPrice(contract.priceQarPerTonne*a.tonnes):'N/A'}</small></div>
       <FileCheck2 size={16}/>
      </div>
    })}
    <label>Final submission justification
     <textarea rows={2} value={reason} disabled={submitted||busy}
      onChange={e=>setReason(e.target.value)}
      placeholder="Explain the need and supporting source records (8 characters minimum)"/>
    </label>
    {!submitted?<button type="button" className={styles.primary}
     disabled={busy||Boolean(allocationError)||!logisticsValid}
     onClick={()=>void createPendingOrders()}>
     {busy?<RefreshCw size={15} className="animate-spin"/>:<PackageCheck size={15}/>}
     Submit pending order proposals</button>:
     <div className={styles.submission}>
      {submission.map(item=><div key={item.orderRef}>
       {item.status==='pending'?<CheckCircle2 size={15}/>:<XCircle size={15}/>}
       <strong>{item.orderRef}</strong><span>{item.message}</span>
      </div>)}
      <button type="button" className={styles.secondary} onClick={()=>void refreshApprovals()}>
       <RefreshCw size={13}/> Refresh independent approval status</button>
      {orderStates.map(order=>{
       const approval=reviewRows.find(a=>a.target_id===order.id&&
        a.target_type==='purchase_order')
       return <div className={styles.reviewOrder} key={order.id}>
        <strong>{order.order_ref} · {order.status.toUpperCase()}</strong>
        {approval?.status==='pending'&&<>
         <button type="button" className={styles.primary}
          disabled={Boolean(reviewBusy)} onClick={()=>void reviewOrder(approval.id,'approve')}>
          <Check size={13}/> Approve (authorized reviewer)</button>
         <button type="button" className={styles.reject}
          disabled={Boolean(reviewBusy)} onClick={()=>void reviewOrder(approval.id,'reject')}>
          <XCircle size={13}/> Reject & return</button>
        </>}
       </div>
      })}
      <Link href="/dashboard/procurement">Open approval queue <ArrowUpRight size={12}/></Link>
     </div>}
   </div>}
   {message&&<p className={styles.status} role="status">{message}</p>}
   {!submitted&&<div className={styles.gate}>
    <div><strong><ClipboardCheck size={15}/> Human review checkpoint</strong>
     <p>Nothing advances without an explicit Approve. Rejected returns to the
      previous stage and invalidates downstream choices.</p></div>
    {stage<6&&<button type="button" className={styles.primary}
     disabled={busy||researchStatus==='loading'&&stage===1||routeStatus==='loading'&&stage===4}
     onClick={approve}><Check size={15}/>{ar?gateText[stage][1]:gateText[stage][0]}</button>}
    {stage>0&&<button type="button" className={styles.reject} onClick={reject}
     disabled={busy}><ArrowLeft size={14}/> Reject / Return</button>}
   </div>}
  </div>
  <footer className={styles.foot}>
   <span>Planning-stage approvals are local only. Independent server-side
    approval remains mandatory before an order can become approved.</span>
   <Link href="/dashboard/procurement">Procurement operations <ArrowUpRight size={12}/></Link>
  </footer>
 </section>
}
