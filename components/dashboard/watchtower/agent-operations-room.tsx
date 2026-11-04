'use client'
import Link from 'next/link'
import {useCallback,useMemo,useRef,useState,useEffect} from 'react'
import {ArrowRight,ArrowUpRight,Bot,CheckCircle2,Database,
 FileCheck2,RefreshCw,ShieldAlert,Ship,ShoppingBasket,Warehouse,
 Activity,PlayCircle} from 'lucide-react'
import {CommodityAgentLab,type AgentMissionTelemetry} from '@/components/dashboard/commodity-agent-lab'
import {useCommodityCase} from '@/hooks/use-commodity-case'
import {useI18n} from '@/lib/i18n'
import {COMMODITY_CATALOG} from '@/lib/platform/commodity-catalog'
import {linkCommodityOperations} from '@/lib/nfii/commodity-links'
import styles from './agent-operations-room.module.css'

const initial:AgentMissionTelemetry={phase:'idle',completed:0,total:10,steps:[],verdict:null}
const fmt=(n:number|null|undefined)=>
 typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:1}):'N/A'
const workstreams=[
 {id:'evidence',en:'Understand the evidence',ar:'التحقق من الأدلة',
  steps:['orchestrate','quality','food'],icon:Database},
 {id:'availability',en:'Assess food availability',ar:'تقييم توافر الغذاء',
  steps:['agronomy','procurement','logistics','reserves'],icon:Warehouse},
 {id:'exposure',en:'Model the exposure',ar:'تقييم المخاطر',
  steps:['weather','watchtower'],icon:Activity},
 {id:'decision',en:'Prepare the decision',ar:'إعداد القرار',
  steps:['report'],icon:FileCheck2},
] as const

/** One mission, one launch action, one executive recommendation.
 * The simulator owns the scenario configuration and the actual run.
 * The overview simply consumes revealed, read-only telemetry.
 */
export function WatchtowerAgentOperationsRoom(){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const tx=(en:string,arabic:string)=>ar?arabic:en
 const [commodityId,setCommodityId]=useState('rice')
 const [days,setDays]=useState<7|30|90|180>(30)
 const [telemetry,setTelemetry]=useState<AgentMissionTelemetry>(initial)
 const flowRef=useRef<HTMLDivElement|null>(null)
 const reviewRef=useRef<HTMLDivElement|null>(null)
 const {balance,operations,organizationId,loading,hasVerifiedBalance,
  foodError,operationsError,refresh,today}=useCommodityCase(commodityId,days)
 const links=useMemo(()=>linkCommodityOperations(commodityId,operations,today),
  [commodityId,operations,today])
 const onTelemetry=useCallback((next:AgentMissionTelemetry)=>setTelemetry(next),[])
 const ready=Boolean(balance?.status==='complete'&&hasVerifiedBalance)
 const finished=telemetry.phase==='completed'&&telemetry.verdict!==null
 const verdict=finished?telemetry.verdict:null
 const underway=telemetry.phase==='running'
 const lastStep=telemetry.steps.at(-1)
 const detailHref='/dashboard?'+new URLSearchParams({
  module:'commodities',commodityId,view:'agents',
  ...(organizationId?{organizationId}:{}),
 }).toString()
 useEffect(()=>{
  if(!finished||!reviewRef.current)return
  const node=reviewRef.current
  const viewport=node.closest<HTMLElement>('[data-watchtower-flow-scroll]')
  if(!viewport)return
  const frame=requestAnimationFrame(()=>{
   // Only move the scoped Watchtower pane, not the entire document.
   const top=viewport.scrollTop+node.getBoundingClientRect().top-
    viewport.getBoundingClientRect().top-18
   viewport.scrollTo({top:Math.max(0,top),
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
  })
  return ()=>cancelAnimationFrame(frame)
 },[finished])
 const changeCommodity=(id:string)=>{setTelemetry(initial);setCommodityId(id)}
 const changeDays=(value:7|30|90|180)=>{setTelemetry(initial);setDays(value)}
 return <section id="watchtower-agents" className={styles.room}
  aria-label={tx('Agent Operations','عمليات الوكلاء')}>
  <header className={styles.flowHero}>
   <div className={styles.flowHeroTop}>
    <div>
     <p className={styles.flowEyebrow}><Bot size={15}/> GROWA · AI OPERATIONS</p>
     <h2>{tx('Agent Operations','عمليات الوكلاء')}</h2>
     <p className={styles.flowDescription}>{tx(
      'One clear workflow: define a commodity mission, inspect specialist work, and review a proposed decision.',
      'سير عمل واحد: تحديد مهمة السلعة ثم مراجعة تحليل الوكلاء والقرار المقترح.')}</p>
    </div>
    <span className={styles.flowRunStatus} data-phase={telemetry.phase}>
     {underway?'ANALYSIS IN PROGRESS':finished?'REVIEW READY':'NOT STARTED'}
    </span>
   </div>
   <div className={styles.flowStepper} aria-label="Mission stages">
    <div data-active={telemetry.phase==='idle'}><span>01</span> {tx('Configure','التحضير')}</div>
    <div data-active={underway}><span>02</span> {tx('Analyze','التحليل')}</div>
    <div data-active={finished}><span>03</span> {tx('Review','المراجعة')}</div>
   </div>
  </header>

  <div className={styles.flowSetup}>
   <div className={styles.flowTitle}><span className={styles.flowNumber}>01</span>
    <div><h3>{tx('Define the mission','حدد المهمة')}</h3>
     <p>{tx('Select a commodity and time window, then choose an assessment below.',
      'اختر السلعة والفترة ثم حدد نوع التقييم بالأسفل.')}</p></div></div>
   <div className={styles.flowSelectors}>
    <label>{tx('Commodity','السلعة')}
     <select value={commodityId} onChange={e=>changeCommodity(e.target.value)}>
      {COMMODITY_CATALOG.map(c=><option key={c.id} value={c.id}>
       {ar?c.nameAr:c.name}</option>)}
     </select>
    </label>
    <label>{tx('Analysis horizon','الفترة الزمنية')}
     <select value={days} onChange={e=>changeDays(Number(e.target.value) as 7|30|90|180)}>
      {[7,30,90,180].map(n=><option value={n} key={n}>{n} {tx('days','يوم')}</option>)}
     </select>
    </label>
    <div className={styles.flowSetupActions}>
     <button type="button" disabled={loading}
      onClick={()=>{setTelemetry(initial);refresh()}}>
      <RefreshCw size={14} className={loading?'animate-spin':''}/>
      {tx('Refresh data','Aggiorna dati')}</button>
     <Link href={detailHref}>{tx('Commodity details','Dettagli della coltura')}
      <ArrowUpRight size={13}/></Link>
    </div>
   </div>
   <div className={styles.flowEvidence} data-ready={ready}>
    {ready?<CheckCircle2 size={17}/>:<ShieldAlert size={17}/>}
    <div><strong>{ready?'Reviewed data ready':'Evidence incomplete'}</strong>
     <p>{ready?
      fmt(balance?.evidence.sourceRefs.length)+' balance references · '+
       fmt(links.approvedContractTonnes)+' t contracted · '+
       fmt(links.availableReserveTonnes)+' t uncommitted reserves':
      'A missing baseline limits the recommendations. No missing quantities are treated as zero.'}</p>
    </div>
   </div>
   {foodError&&<p className={styles.flowError}>{foodError}</p>}
   {operationsError&&<p className={styles.flowError}>{operationsError}</p>}
   <div className={styles.flowLaunch} ref={flowRef}>
    <CommodityAgentLab key={commodityId+':'+days} mode="watchtower"
     balance={balance} operations={operations} today={today} onTelemetry={onTelemetry}/>
   </div>
  </div>

  <div className={styles.flowAnalysis} aria-live="polite">
   <div className={styles.flowTitle}><span className={styles.flowNumber}>02</span>
    <div><h3>{tx('Specialist analysis','تحليل الوكلاء')}</h3>
     <p>{tx('Four operational workstreams organize the ten underlying specialist checks.',
      'أربع مجموعات عمل تنظم عشر عمليات تحقق متخصصة.')}</p></div></div>
   <div className={styles.flowProgress}>
    <div><strong>{telemetry.completed} / {telemetry.total}</strong>
     <span>{underway?'Evaluating specialist findings':finished?'Analysis complete':'Run an assessment to begin'}</span></div>
    <div className={styles.flowProgressTrack}><i style={{width:
     (telemetry.completed/Math.max(1,telemetry.total)*100)+'%'}}/></div>
   </div>
   <div className={styles.flowStreams}>
    {workstreams.map((work,index)=>{
     const Icon=work.icon
     const seen=telemetry.steps.filter(s=>work.steps.some(id=>id===s.id))
     const done=seen.length===work.steps.length
     const gaps=seen.filter(s=>s.state==='needs_data').length
     const inProgress=underway&&seen.length>0&&!done
     return <div key={work.id} className={styles.flowStream} data-state={
      done?'complete':inProgress?'active':seen.length?'active':'pending'}>
      <div className={styles.flowStreamTop}><span><Icon size={18}/>{String(index+1).padStart(2,'0')}</span>
       <small>{seen.length}/{work.steps.length} CHECKS</small></div>
      <h4>{tx(work.en,work.ar)}</h4>
      <div className={styles.flowStreamStatus}>{done?
       gaps?gaps+' evidence gap(s) found':'Checks completed':
       seen.length?seen.length+' checks reviewed':'Waiting for assessment'}</div>
     </div>
    })}
   </div>
   {lastStep&&<p className={styles.flowRecent}>
    <strong>Latest finding · {tx(lastStep.areaEn,lastStep.areaAr)}</strong>
    {tx(lastStep.findingEn,lastStep.findingAr)}
   </p>}
  </div>

  <div ref={reviewRef} className={styles.flowDecision} data-state={finished?'ready':'pending'}>
   <div className={styles.flowTitle}><span className={styles.flowNumber}>03</span>
    <div><h3>{tx('Decision & next action','القرار والخطوة التالية')}</h3>
     <p>{tx('Only completed analysis produces a recommendation. Execution stays under human control.',
      'تظهر التوصية بعد اكتمال التحليل فقط، والتنفيذ يتطلب موافقة بشرية.')}</p></div></div>
   {verdict?<div className={styles.flowVerdict}>
    <div><span>PRIORITY · {verdict.priority.toUpperCase()}</span>
     <h4>{tx(verdict.headlineEn,verdict.headlineAr)}</h4>
     <p>{tx(verdict.reasonEn,verdict.reasonAr)}</p></div>
    <div className={styles.flowNext}><small>NEXT RECOMMENDED ACTION</small>
     <strong>{tx(verdict.nextStepEn,verdict.nextStepAr)}</strong>
     <p>{tx(verdict.ownerEn,verdict.ownerAr)} · Requires authorized human review</p></div>
   </div>:<div className={styles.flowPending}>
    <PlayCircle size={22}/>
    <span>{underway?'Review becomes available after all specialist checks.':
     'No recommendation has been produced. Configure the mission and run an assessment above.'}</span>
   </div>}
   {verdict&&<div className={styles.flowHandoffs}>
    <Link href="/dashboard/procurement">Procurement <ArrowRight size={14}/></Link>
    <Link href="/dashboard/logistics">Logistics <ArrowRight size={14}/></Link>
    <Link href="/dashboard/reserves">Strategic reserves <ArrowRight size={14}/></Link>
   </div>}
   <div className={styles.flowFoot}>This page provides deterministic, read-only scenario analysis.
    No live LLM agent execution, procurement approvals, purchases or reserve transfers occur here.</div>
  </div>
 </section>
}
