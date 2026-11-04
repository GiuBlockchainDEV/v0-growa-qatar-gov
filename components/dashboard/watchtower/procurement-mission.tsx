'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import {
 ArrowLeft,ArrowUpRight,Bot,Check,ClipboardCheck,Copy,
 PackageCheck,Play,RefreshCw,ShieldCheck,Terminal,XCircle,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {FoodPosture} from '@/lib/watchtower/food-posture'
import {
 rankSourcingCandidates,diverseShortlist,buildSourcingScenarios,
 planApprovedOrders,sourcingBrief,
 type SourcingLead,type EligibleContract,type OriginReference,type RouteReview,
 type Candidate,type SourcingScenario,
} from '@/lib/watchtower/sourcing-autopilot'
import {CARGO_SPECS} from '@/lib/nfii/logistics-lanes'
import styles from './procurement-mission.module.css'

type LedgerResult={options:EligibleContract[];available:boolean;error?:string}
type LeadsResult={results:SourcingLead[];researchStatus:string;error?:string}
type OriginResult={shortlist:OriginReference[];dataStatus:string;error?:string}
type RouteResult={routes:RouteReview[];error?:string}
type ReviewRecord={id:string;status:string;target_id?:string;target_type?:string}
type OrderRecord={id:string;order_ref:string;status:string}
type Submitted={ref:string;contractId:string;tonnes:number;status:'pending'|'failed';detail:string}
type LogEntry={id:number;agent:string;text:string;state:'working'|'complete'|'gap'|'approval';when:string}
type Phase='idle'|'researching'|'shortlist'|'planning'|'plan_approval'|'approved'
type WorkflowReport={
 candidates:Candidate[]
 origins:OriginReference[]
 routes:Record<string,RouteReview[]>
 scenarios:SourcingScenario[]
 errors:string[]
}
const money=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})+' QAR'
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1})
const errorText=(cause:unknown)=>cause instanceof Error?cause.message:'Source unavailable'
const errorPayload=(body:unknown,fallback:string):string=>
 body&&typeof body==='object'&&'error'in body&&typeof body.error==='string'?
 body.error:fallback
async function getJson(url:string,signal:AbortSignal):Promise<unknown>{
 const response=await fetch(url,{cache:'no-store',signal})
 const payload:unknown=await response.json()
 if(!response.ok)throw Error(errorPayload(payload,'Provider returned '+response.status))
 return payload
}
function nowLabel(){return new Date().toLocaleTimeString('en-GB',{hour12:false})}

export function WatchtowerProcurementMission({posture}:{posture:FoodPosture}){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const tx=(en:string,arabic:string)=>ar?arabic:en
 const [commodityId,setCommodityId]=useState(posture.commodities[0]?.commodityId??'')
 const commodity=posture.commodities.find(c=>c.commodityId===commodityId)??
  posture.commodities[0]
 const selectedCommodity=commodity?.commodityId??''
 const supported=Boolean(selectedCommodity&&CARGO_SPECS[selectedCommodity])
 const verifiedDemand=commodity?.status==='complete'&&
  commodity.deficitTonnes!==null&&commodity.deficitTonnes>0?
  commodity.deficitTonnes:null
 const [quantity,setQuantity]=useState('')
 const requiredQty=quantity.trim()!==''&&Number.isFinite(Number(quantity))&&
  Number(quantity)>0&&Number(quantity)<=600?Number(quantity):verifiedDemand
 const [phase,setPhase]=useState<Phase>('idle')
 const [report,setReport]=useState<WorkflowReport|null>(null)
 const [selectedIds,setSelectedIds]=useState<string[]>([])
 const [scenarioId,setScenarioId]=useState<SourcingScenario['id']>('diversified')
 const [logs,setLogs]=useState<LogEntry[]>([])
 const [notice,setNotice]=useState('')
 const [reviewNote,setReviewNote]=useState('')
 const [brief,setBrief]=useState('')
 const [orders,setOrders]=useState<Submitted[]>([])
 const [orderStates,setOrderStates]=useState<OrderRecord[]>([])
 const [approvalRecords,setApprovalRecords]=useState<ReviewRecord[]>([])
 const [submitting,setSubmitting]=useState(false)
 const [reviewBusy,setReviewBusy]=useState(false)
 const runId=useRef(0)
 const requestController=useRef<AbortController|null>(null)
 const logId=useRef(0)
 const logBottom=useRef<HTMLDivElement|null>(null)
 const [follow,setFollow]=useState(true)
 const log=(agent:string,text:string,state:LogEntry['state']='complete')=>{
  setLogs(prev=>[...prev,{id:++logId.current,agent,text,state,when:nowLabel()}])
 }
 const cancel=()=>{
  runId.current+=1
  requestController.current?.abort()
  requestController.current=null
 }
 const reset=()=>{
  cancel();setPhase('idle');setReport(null);setSelectedIds([])
  setScenarioId('diversified');setLogs([]);setBrief('');setNotice('')
  setReviewNote('');setOrders([]);setOrderStates([]);setApprovalRecords([])
  setSubmitting(false);setReviewBusy(false)
 }
 useEffect(()=>{
  // A new authorized organization snapshot must never inherit prior analyses.
  runId.current+=1;requestController.current?.abort()
  // Reset via state setters only; no network calls.
  setPhase('idle');setReport(null);setSelectedIds([])
  setLogs([]);setBrief('');setOrders([]);setOrderStates([])
  setApprovalRecords([]);setQuantity('');setNotice('')
  return ()=>{runId.current+=1;requestController.current?.abort()}
 },[posture])
 useEffect(()=>{
  if(follow)logBottom.current?.scrollIntoView({behavior:'smooth',block:'nearest'})
 },[logs.length,follow])
 const changeCommodity=(id:string)=>{
  reset();setCommodityId(id);setQuantity('')
 }
 const run=async()=>{
  if(!supported||!selectedCommodity)return
  cancel()
  const id=runId.current
  const controller=new AbortController()
  requestController.current=controller
  const signal=controller.signal
  setPhase('researching');setReport(null);setSelectedIds([])
  setOrders([]);setLogs([]);setNotice('');setBrief('')
  setOrderStates([]);setApprovalRecords([])
  log('Orchestrator','Authorized organization snapshot and commodity: '+selectedCommodity)
  log('Demand agent',requiredQty!==null?
   'Planning target '+fmt(requiredQty)+' tonnes. Source: '+
    (quantity.trim()? 'operator-supplied quantity':'reviewed projected deficit'):
   'No verified demand volume. Discovery and RFQ research will continue without inventing tonnage.',
   requiredQty!==null?'complete':'gap')
  const org=posture.organizationId
  const base=new URLSearchParams({organizationId:org,commodity:selectedCommodity})
  const discovery=[
   {name:'Supplier registry',url:'/api/nfii/procurement/crop-producers?'+
     new URLSearchParams({...Object.fromEntries(base),research:'curated'})},
   {name:'Authorized contracts',url:'/api/watchtower/procurement-agent?'+base},
   {name:'Trade intelligence',url:'/api/nfii/procurement/origin-prices?'+base},
  ]
  log('Research orchestrator','Querying three independent sourcing evidence feeds.','working')
  const sources=await Promise.allSettled(discovery.map(async x=>getJson(x.url,signal)))
  if(signal.aborted||runId.current!==id)return
  const errors:string[]=[]
  const source=<T,>(index:number,name:string):T|null=>{
   const item=sources[index]
   if(item.status==='rejected'){
    errors.push(name+': '+errorText(item.reason))
    log(name,'Source unavailable: '+errorText(item.reason),'gap')
    return null
   }
   log(name,'Source response received and validated.','complete')
   return item.value as T
  }
  const registry=source<LeadsResult>(0,'Supplier registry')
  const ledger=source<LedgerResult>(1,'Authorized contracts')
  const origin=source<OriginResult>(2,'Trade intelligence')
  const leads=Array.isArray(registry?.results)?registry.results:[]
  const contracts=Array.isArray(ledger?.options)?ledger.options:[]
  const origins=Array.isArray(origin?.shortlist)?origin.shortlist:[]
  if(registry&&registry.researchStatus!=='available'&&
   registry.researchStatus!=='not_requested')
   log('Registry auditor','Publisher coverage: '+registry.researchStatus,'gap')
  log('Supplier qualification agent',leads.length+' documented unqualified leads; '+
   contracts.length+' active approved contract positions.')
  const candidates=rankSourcingCandidates(leads,contracts,origins)
  const shortlist=diverseShortlist(candidates,8)
  log('Candidate ranking agent',shortlist.length+' diverse sourcing candidates prepared. '+
   'Lead ranking considers source strength and historical Qatar import evidence.')
  const countries=[...new Set(shortlist.map(x=>x.country).filter(x=>x!=='QA'))].slice(0,5)
  const routes:Record<string,RouteReview[]>={}
  if(countries.length){
   log('Logistics orchestrator','Screening up to '+countries.length+
    ' candidate origins in parallel, without assuming bookings.','working')
   const perOrigin=await Promise.allSettled(countries.map(async country=>{
    const tonnes=requiredQty===null?20:Math.min(200,Math.max(.1,requiredQty))
    const params=new URLSearchParams({
     organizationId:org,commodity:selectedCommodity,country,
     tonnes:String(tonnes),
     limitDays:String(CARGO_SPECS[selectedCommodity].maxTransitDays),
     supplierScope:'documented',
    })
    const result=await getJson('/api/nfii/logistics/corridors?'+params,signal) as RouteResult
    if(!Array.isArray(result.routes))throw Error('Invalid route evidence')
    return {country,routes:result.routes}
   }))
   if(signal.aborted||runId.current!==id)return
   for(const [index,response] of perOrigin.entries()){
    const country=countries[index]
    if(response.status==='fulfilled'){
     routes[country]=response.value.routes
     log('Corridor agent',country+': '+routes[country].length+
      ' route alternatives screened. These are not booked shipments.')
    }else{
     const detail=country+': '+errorText(response.reason)
     errors.push(detail);log('Corridor agent',detail,'gap')
    }
   }
  }else log('Logistics orchestrator',
   'No validated documented foreign-origin candidates to route.','gap')
  if(signal.aborted||runId.current!==id)return
  const scenarios=buildSourcingScenarios(candidates,routes,origins,requiredQty)
  log('Strategy agent',scenarios.length+
   ' evidence-limited sourcing strategies assembled; no supplier capacity inferred.')
  if(!contracts.length)
   log('Governance agent','No approved contracts: RFQ and qualification pathways remain available. '+
    'Direct purchase orders are correctly blocked until approval.','approval')
  if(!candidates.length)
   log('Evidence auditor','No source-backed candidates available. Research coverage is incomplete.','gap')
  setReport({candidates,origins,routes,scenarios,errors})
  setSelectedIds(shortlist.map(x=>x.id))
  setScenarioId(scenarios[0]?.id??'diversified')
  setPhase('shortlist')
  log('Governance gate','Supplier shortlist available for human approval or rejection.','approval')
 }
 const chosen=useMemo(()=>report?.candidates.filter(x=>selectedIds.includes(x.id))??[],
  [report,selectedIds])
 const scenarios=useMemo(()=>report?buildSourcingScenarios(chosen,report.routes,
  report.origins,requiredQty):[],[report,chosen,requiredQty])
 const selectedScenario=scenarios.find(x=>x.id===scenarioId)??scenarios[0]??null
 const approvedContracts=chosen.filter(x=>x.approved)
 const purchasePlan=planApprovedOrders(report?.candidates??[],selectedIds,requiredQty)
 const approvedGoodsValue=purchasePlan.lines.reduce((sum,line)=>
  sum+line.tonnes*line.priceQarPerTonne,0)
 const prospectCount=chosen.filter(x=>!x.approved).length
 const approveShortlist=()=>{
  if(!chosen.length){setNotice('Choose at least one documented candidate.');return}
  log('Human checkpoint','Approved '+chosen.length+
   ' candidates for sourcing analysis, not for legal supplier qualification.','approval')
  log('Strategy agent',scenarios.length+
   ' approaches recalculated using the approved shortlist.','complete')
  setPhase('plan_approval');setNotice('')
 }
 const rejectShortlist=()=>{
  log('Human checkpoint','Shortlist rejected. Research remains visible for re-selection.','approval')
  setNotice('Shortlist returned for revision.')
 }
 const rejectPlan=()=>{
  log('Human checkpoint','Commercial strategy rejected. Returning to shortlist and re-evaluation.','approval')
  setPhase('shortlist');setBrief('');setNotice('Revise and approve a new shortlist.')
 }
 const approvePlan=()=>{
  if(!selectedScenario){setNotice('No defensible sourcing scenario available.');return}
  const draft=sourcingBrief(commodity.name,requiredQty,chosen,selectedScenario)
  setBrief(draft);setPhase('approved');setNotice('')
  log('Human checkpoint','Sourcing strategy approved for RFQ preparation; no external requests sent.','approval')
  log('Procurement agent',purchasePlan.ready?
   'Approved contracts can support pending purchase-order proposals after explicit submission.':
   'No fully funded approved-contract allocation. Supplier qualification and RFQ required.','complete')
 }
 const submitPending=async()=>{
  if(submitting||orders.length||!purchasePlan.ready||!brief||
   reviewNote.trim().length<8)return
  setSubmitting(true);setNotice('')
  log('Order agent','Submitting '+purchasePlan.lines.length+
   ' separate purchase-order proposals as PENDING, never as approved.','working')
  const saved:Submitted[]=[]
  for(const [index,line] of purchasePlan.lines.entries()){
   const ref='GROW-'+Date.now().toString(36).toUpperCase()+'-'+String(index+1).padStart(2,'0')
   try{
    const response=await fetch('/api/nfii/operations',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({organizationId:posture.organizationId,kind:'purchase_order',data:{
      contractId:line.contractId,orderRef:ref,orderedTonnes:line.tonnes,
     }}),
    })
    const body:unknown=await response.json()
    if(!response.ok)throw Error(errorPayload(body,'PO proposal rejected'))
    saved.push({ref,contractId:line.contractId,tonnes:line.tonnes,
     status:'pending',detail:'Created, awaiting independent approval'})
    log('Order agent',ref+' submitted in PENDING status.','approval')
   }catch(error){
    saved.push({ref,contractId:line.contractId,tonnes:line.tonnes,
     status:'failed',detail:errorText(error)})
    log('Order agent',ref+': '+errorText(error),'gap')
   }
   setOrders([...saved])
  }
  setSubmitting(false)
  setNotice('Only successfully created Pending proposals require reviewer approval. '+
   'Failed submissions were not retried automatically.')
 }
 const refreshReviews=async()=>{
  try{
   const response=await fetch('/api/nfii/operations?'+new URLSearchParams({
    organizationId:posture.organizationId,
   }),{cache:'no-store'})
   const data:unknown=await response.json()
   if(!response.ok)throw Error(errorPayload(data,'Operational register unavailable'))
   const snapshot=(data as {snapshot?:{
    purchaseOrders?:OrderRecord[];approvals?:ReviewRecord[]}}).snapshot
   const refs=new Set(orders.filter(o=>o.status==='pending').map(o=>o.ref))
   const activeOrders=(snapshot?.purchaseOrders??[]).filter(o=>refs.has(o.order_ref))
   setOrderStates(activeOrders)
   const ids=new Set(activeOrders.map(x=>x.id))
   setApprovalRecords((snapshot?.approvals??[]).filter(x=>
    x.target_type==='purchase_order'&&ids.has(x.target_id??'')))
   setNotice(activeOrders.length?
    activeOrders.map(x=>x.order_ref+': '+x.status).join(' · '):
    'No matching orders returned. Check the official Procurement approval queue.')
  }catch(error){setNotice(errorText(error))}
 }
 const handleReview=async(id:string,decision:'approve'|'reject')=>{
  if(reviewBusy||reviewNote.trim().length<8){
   setNotice('Independent reviewer must document at least 8 characters.');return
  }
  setReviewBusy(true)
  try{
   const response=await fetch('/api/nfii/operations/action',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({organizationId:posture.organizationId,kind:'approval',
     id,action:decision,note:reviewNote.trim()}),
   })
   const data:unknown=await response.json()
   if(!response.ok)throw Error(errorPayload(data,'Reviewer authorization failed'))
   log('Governance agent','Independent reviewer recorded: '+decision.toUpperCase(),'approval')
   await refreshReviews()
   if(decision==='reject'){
    setPhase('plan_approval');setBrief('');setOrders([])
    log('Strategy agent','Rejected order returns to plan approval; an existing rejected order cannot be edited.','gap')
   }
  }catch(error){setNotice(errorText(error))}
  setReviewBusy(false)
 }
 const copyBrief=()=>{
  if(!brief)return
  void navigator.clipboard.writeText(brief).then(()=>{
   setNotice('Qualification / RFQ brief copied. It has not been sent.')
  }).catch(()=>setNotice('Copy failed; select the brief text manually.'))
 }
 if(!commodity)return <div className={styles.empty}>No reviewed commodities available.</div>
 return <section className={styles.mission} dir={ar?'rtl':'ltr'}
  aria-label={tx('Automated food sourcing and procurement','المشتريات والتوريد الآلي')}>
  <header className={styles.hero}>
   <div><span className={styles.eyebrow}><Bot size={15}/>
    GROWA / SUPPLY AUTOPILOT</span>
    <h3>{tx('From supply gap to procurement decision',
      'من فجوة الإمداد إلى قرار الشراء')}</h3>
    <p>{tx('Source-backed supplier discovery, multi-origin logistics and autonomous scenario research. Human approval is required for sourcing decisions and purchase commitments.',
      'البحث عن الموردين وتحليل الخيارات اللوجستية والسيناريوهات تلقائياً مع اعتماد بشري للقرارات.')}</p>
   </div>
   <span className={styles.missionMode}>AUTOMATED RESEARCH · HUMAN GOVERNANCE</span>
  </header>
  <div className={styles.metrics}>
   <div><small>Commodity</small><strong>{ar?commodity.nameAr:commodity.name}</strong>
    <span>Organization-scoped · {posture.days} days</span></div>
   <div><small>Reviewed shortage</small><strong>{verifiedDemand===null?'—':fmt(verifiedDemand)+' t'}</strong>
    <span>{verifiedDemand===null?'Not independently established':'Period-end forecast'}</span></div>
   <div><small>Discovered options</small><strong>{report?.candidates.length??'—'}</strong>
    <span>{report?report.candidates.filter(x=>x.approved).length+
     ' approved contracts · '+report.candidates.filter(x=>!x.approved).length+' leads':
      'Run research to populate'}</span></div>
   <div><small>Strategies evaluated</small><strong>{report?.scenarios.length??'—'}</strong>
    <span>{phase==='researching'?'Analyzing source feeds…':phase==='idle'?'Not started':'Evidence-limited models'}</span></div>
  </div>
  <section className={styles.autopilotControl}>
   <div className={styles.autopilotInputs}>
    <label>Commodity
     <select value={selectedCommodity} onChange={e=>changeCommodity(e.target.value)}
      disabled={phase==='researching'||submitting}>
      {posture.commodities.map(row=><option key={row.commodityId} value={row.commodityId}>
       {ar?row.nameAr:row.name}</option>)}
     </select>
    </label>
    <label>Required tonnes <small>Defaults to reviewed deficit if available</small>
     <input type="number" value={quantity} min=".1" max="600" step=".1"
      placeholder={verifiedDemand===null?'Unknown · research still possible':fmt(verifiedDemand)}
      disabled={phase==='researching'||submitting}
      onChange={e=>setQuantity(e.target.value)}/>
    </label>
    <button className={styles.primary} type="button" disabled={!supported||phase==='researching'}
     onClick={()=>void run()}>
     {phase==='researching'?<RefreshCw size={15} className="animate-spin"/>:<Play size={15}/>}
     {phase==='researching'?'Agents analyzing…':report?'Rerun sourcing agents':'Launch autonomous research'}
    </button>
   </div>
   {!supported&&<p className={styles.warning}>This commodity has no supported routing profile.
    No inferred trade routes or supplier availability will be generated.</p>}
   <div className={styles.autopilotSteps}>
    {[
     ['01','Demand','Inspect verified shortage'],
     ['02','Supplier intelligence','Query actual sources'],
     ['03','Trade analysis','Review origin records'],
     ['04','Transport','Compare screened routes'],
     ['05','Synthesis','Produce strategy options'],
     ['06','Governance','Approve or return'],
    ].map(([id,title,description],i)=><div key={id} data-active={
     phase==='researching'&&i<=4||phase==='shortlist'&&i===5||
      phase==='plan_approval'&&i===5||phase==='approved'&&i===5}
     className={styles.autopilotStep}>
      <span>{id}</span><div><strong>{title}</strong><small>{description}</small></div>
     </div>)}
   </div>
  </section>
  <section className={styles.agentConsole} aria-label="Live sourcing operations log">
   <div className={styles.agentHeader}><div><Terminal size={15}/>
    <strong>Live agent operations</strong><small>{logs.length} recorded observations</small></div>
    <span data-running={phase==='researching'} className={styles.agentState}>
     <i/>{phase==='researching'?'RESEARCH IN PROGRESS':phase==='idle'?'IDLE':'HUMAN REVIEW'}</span>
   </div>
   <div className={styles.agentLog} role="log" aria-live="polite" aria-relevant="additions">
    {!logs.length&&<p className={styles.muted}>Start sourcing to see source checks and agent conclusions as each response arrives.</p>}
    {logs.map(row=><div key={row.id} className={styles.agentLine} data-state={row.state}>
     <time>{row.when}</time><span>{row.agent}</span><p>{row.text}</p>
    </div>)}
    <div ref={logBottom}/>
   </div>
   <label className={styles.followCheck}><input type="checkbox" checked={follow}
    onChange={e=>setFollow(e.target.checked)}/> Follow active analysis</label>
  </section>
  {report&&<section className={styles.analysisResults}>
   <div className={styles.heading}><span>AGENT EVIDENCE & OPTIONS</span>
    <h4>{tx('Supplier intelligence','ذكاء الموردين')}</h4>
    <p>{report.candidates.length} sourced candidates across {
     new Set(report.candidates.map(x=>x.country)).size} countries.
     The system distinguishes approved contracts from unqualified producer leads.</p>
   </div>
   {report.errors.length>0&&<div className={styles.warning}>
    Partial coverage: {report.errors.slice(0,4).join(' · ')}
   </div>}
   {report.candidates.length===0&&<div className={styles.warning}>
    No source-backed supplier candidates were available. This is a coverage gap,
    not proof that global suppliers do not exist.
   </div>}
   <div className={styles.sourceComparison}>
    {report.candidates.slice(0,18).map(candidate=>
     <label className={styles.candidateCard} data-selected={selectedIds.includes(candidate.id)}
      key={candidate.id}>
      <input type="checkbox" checked={selectedIds.includes(candidate.id)}
       disabled={phase==='approved'||submitting||phase==='researching'}
       onChange={e=>{
        setSelectedIds(prev=>e.target.checked?
         [...prev,candidate.id]:prev.filter(x=>x!==candidate.id))
        if(phase==='plan_approval')setPhase('shortlist')
       }}/>
      <div><div className={styles.candidateTop}>
        <strong>{candidate.name}</strong>
        <span data-qualified={candidate.approved}>
         {candidate.approved?'APPROVED CONTRACT':'SOURCE LEAD · UNQUALIFIED'}
        </span></div>
       <small>{candidate.countryName} · Source relevance {candidate.relevance}/100 (evidence ranking, not vendor reliability)</small>
       <p>{candidate.evidence}</p>
       <div className={styles.candidateFacts}>
        <span>Capacity: {candidate.capacityTonnes===null?'Unverified':fmt(candidate.capacityTonnes)+' t'}</span>
        <span>Price: {candidate.priceQarPerTonne===null?'No quote':money(candidate.priceQarPerTonne)+'/t'}</span>
       </div>
       {candidate.sourceUrl&&<a href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer"
        onClick={event=>event.stopPropagation()}>Original source <ArrowUpRight size={12}/></a>}
      </div>
     </label>)}
   </div>
   <div className={styles.gate}>
    <div><strong><ClipboardCheck size={14}/> Supplier shortlist checkpoint</strong>
     <p>The agent recommends multiple origins. Approval confirms a research shortlist,
      not certification or a purchase decision.</p></div>
    <button className={styles.primary} type="button" onClick={approveShortlist}
     disabled={!selectedIds.length||phase==='approved'}>
     <Check size={14}/> Approve shortlist & evaluate</button>
    <button className={styles.reject} type="button" onClick={rejectShortlist}
     disabled={phase==='approved'}><ArrowLeft size={14}/> Reject / revise</button>
   </div>
  </section>}
  {(phase==='plan_approval'||phase==='approved')&&<section className={styles.analysisResults}>
   <div className={styles.heading}><span>STRATEGY ORCHESTRATOR</span>
    <h4>Multiple procurement pathways</h4>
    <p>Evidence-backed alternatives for selected candidates. Estimated routes are not
     carrier bookings; historical customs prices are not supplier quotations.</p>
   </div>
   <div className={styles.strategyGrid}>
    {scenarios.map(s=><button key={s.id} type="button" className={styles.scenario}
     data-selected={selectedScenario?.id===s.id}
     disabled={phase==='approved'}
     onClick={()=>setScenarioId(s.id)}>
     <strong>{s.title}</strong><p>{s.description}</p>
     <span>{s.countries.join(' · ')}</span>
     <div><small>Screened ETA</small><strong>{s.estimatedDays===null?'N/A':fmt(s.estimatedDays)+' days'}</strong></div>
     <div><small>Historical import value</small><strong>{
      s.historicalUnitValueQarKg===null?'N/A':money(s.historicalUnitValueQarKg)+'/kg'
     }</strong></div>
     <small>{s.blockers.length} unresolved evidence / contractual conditions</small>
    </button>)}
   </div>
   {selectedScenario&&<div className={styles.analysisGrid}>
    <div className={styles.summary}>
     <strong>Proposed sourcing allocation</strong>
     {selectedScenario.allocation.map(a=>{
      const candidate=chosen.find(x=>x.id===a.candidateId)
      return <p key={a.candidateId}>{candidate?.name??a.candidateId} · {
       a.plannedTonnes===null?'Quantity pending':fmt(a.plannedTonnes)+' t planning share'
      }</p>
     })}
     <small>Any unapproved supplier allocation is conditional, never a stock commitment.</small>
    </div>
    <div className={styles.summary}>
     <strong>Approval conditions</strong>
     {selectedScenario.blockers.map(x=><p key={x}>• {x}</p>)}
     {!selectedScenario.blockers.length&&<p>Review legal and operational conditions before committing.</p>}
    </div>
   </div>}
   {phase==='plan_approval'&&<div className={styles.gate}>
    <div><strong><ShieldCheck size={14}/> Strategy approval gate</strong>
     <p>Approve to prepare a sourcing/RFQ brief and, only where eligible, a Pending order plan.</p></div>
    <button className={styles.primary} onClick={approvePlan} type="button"
     disabled={!selectedScenario}><Check size={14}/> Approve strategy</button>
    <button className={styles.reject} onClick={rejectPlan} type="button">
     <XCircle size={14}/> Reject · return to shortlist</button>
   </div>}
  </section>}
  {phase==='approved'&&<section className={styles.analysisResults}>
   <div className={styles.heading}><span>DECISION PACK / GOVERNANCE</span>
    <h4>RFQ and purchase-order readiness</h4>
    <p>Qualified contracts and new prospects have different routes.
     Neither creates an order automatically.</p>
   </div>
   <div className={styles.gridTwo}>
    <div className={styles.summary}>
     <strong>Supplier qualification / RFQ brief</strong>
     <p>{prospectCount} shortlisted unqualified producer leads. Verify
      legal entity, product quality, firm capacity, export authorization and pricing.</p>
     <textarea value={brief} readOnly rows={7}
      aria-label="Copyable source-backed sourcing RFQ brief"/>
     <button type="button" className={styles.secondary} onClick={copyBrief}>
      <Copy size={13}/> Copy research brief</button>
     <Link href="/dashboard/procurement">Supplier onboarding & approvals <ArrowUpRight size={12}/></Link>
    </div>
    <div className={styles.summary}>
     <strong>Direct pending order eligibility</strong>
     <p>{approvedContracts.length} eligible contract options ·
      {requiredQty===null?'Quantity unavailable':fmt(requiredQty)+' t'} demand.</p>
     <p>{purchasePlan.ready?
      purchasePlan.lines.length+' bounded pending purchase-order proposals supported.':
      'No complete approved-contract allocation. Sourcing and RFQ remain actionable.'}</p>
     <p>Uncovered quantity: {purchasePlan.shortfall===null?
      'Not established':fmt(purchasePlan.shortfall)+' t'}</p>
     {purchasePlan.ready&&<p>Goods value: {money(approvedGoodsValue)}. Freight,
      duties and insurance excluded until independently quoted.</p>}
    </div>
   </div>
   {purchasePlan.ready&&<div className={styles.orderGate}>
    <h5><PackageCheck size={16}/> Final human authorization: submit PENDING proposals</h5>
    <p>Independent order approval is still mandatory. No binding supplier confirmation,
     logistics booking or payment is executed.</p>
    <label>Documented justification (minimum eight characters)
     <textarea value={reviewNote} rows={2}
      onChange={e=>setReviewNote(e.target.value)}
      placeholder="Review need, evidence, and contractual basis…"/>
    </label>
    <button type="button" className={styles.primary}
     disabled={submitting||Boolean(orders.length)||reviewNote.trim().length<8}
     onClick={()=>void submitPending()}>
     {submitting?<RefreshCw size={14} className="animate-spin"/>:<PackageCheck size={14}/>}
     Submit proposals for independent review
    </button>
    {orders.map(o=><p key={o.ref}>{o.ref} · {o.status.toUpperCase()} · {o.detail}</p>)}
    {orders.some(x=>x.status==='pending')&&
     <button type="button" className={styles.secondary}
      onClick={()=>void refreshReviews()}>
      <RefreshCw size={13}/> Check independent approval queue</button>}
    {orderStates.map(order=>{
     const approval=approvalRecords.find(a=>a.target_id===order.id&&
      a.target_type==='purchase_order')
     return <div key={order.id} className={styles.reviewOrder}>
      <strong>{order.order_ref} · {order.status}</strong>
      {approval?.status==='pending'&&<>
       <button type="button" className={styles.primary} disabled={reviewBusy}
        onClick={()=>void handleReview(approval.id,'approve')}>
        Approve (authorized reviewer)</button>
       <button type="button" className={styles.reject} disabled={reviewBusy}
        onClick={()=>void handleReview(approval.id,'reject')}>
        Reject · return to plan</button>
      </>}
     </div>
    })}
   </div>}
  </section>}
  {notice&&<div className={styles.status} role="status">{notice}</div>}
  <footer className={styles.foot}>
   <span>Research and screening run automatically on requested data sources.
    Supplier quotes, actual capacity and legal approvals are never inferred.
    No live LLM model is executing hidden reasoning in this module.</span>
   <Link href="/dashboard/procurement">Procurement workspace <ArrowUpRight size={12}/></Link>
  </footer>
 </section>
}
