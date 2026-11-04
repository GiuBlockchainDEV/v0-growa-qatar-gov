'use client'

import Link from 'next/link'
import {useCallback,useMemo,useState} from 'react'
import {Activity,ArrowUpRight,Bot,Database,FileCheck2,
  Globe2,Leaf,Network,RefreshCw,ShieldAlert,ShieldCheck,Ship,
  ShoppingBasket,Sparkles,Warehouse} from 'lucide-react'
import {CommodityAgentLab,type AgentMissionTelemetry} from '@/components/dashboard/commodity-agent-lab'
import {useCommodityCase} from '@/hooks/use-commodity-case'
import {useI18n} from '@/lib/i18n'
import {COMMODITY_CATALOG} from '@/lib/platform/commodity-catalog'
import {linkCommodityOperations} from '@/lib/nfii/commodity-links'
import styles from './agent-operations-room.module.css'

type MissionState='waiting'|'active'|'complete'|'gap'
const stages=[
 {id:'orchestrate',en:'Coordination',ar:'التنسيق',icon:Network},
 {id:'quality',en:'Source validation',ar:'التحقق من المصادر',icon:Database},
 {id:'food',en:'Food security',ar:'الأمن الغذائي',icon:ShieldCheck},
 {id:'agronomy',en:'Local production',ar:'الإنتاج المحلي',icon:Leaf},
 {id:'procurement',en:'Procurement',ar:'المشتريات',icon:ShoppingBasket},
 {id:'logistics',en:'Logistics',ar:'الخدمات اللوجستية',icon:Ship},
 {id:'reserves',en:'Strategic reserves',ar:'الاحتياطيات',icon:Warehouse},
 {id:'weather',en:'Climate exposure',ar:'مخاطر المناخ',icon:Globe2},
 {id:'watchtower',en:'Stress assessment',ar:'تقييم المخاطر',icon:Activity},
 {id:'report',en:'Decision brief',ar:'ملخص القرار',icon:FileCheck2},
] as const
const emptyTelemetry:AgentMissionTelemetry={
 phase:'idle',completed:0,total:10,steps:[],verdict:null,
}
const fmt=(n:number|null|undefined)=>
 typeof n==='number'&&Number.isFinite(n)?
 n.toLocaleString('en-US',{maximumFractionDigits:1}):'N/A'

export function WatchtowerAgentOperationsRoom(){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const tx=(en:string,arabic:string)=>ar?arabic:en
 const [commodityId,setCommodityId]=useState('rice')
 const [days,setDays]=useState<7|30|90|180>(30)
 const [telemetry,setTelemetry]=useState<AgentMissionTelemetry>(emptyTelemetry)
 const {balance,operations,organizationId,loading,hasVerifiedBalance,
  foodError,operationsError,refresh,today}=useCommodityCase(commodityId,days)
 const linked=useMemo(()=>linkCommodityOperations(commodityId,operations,today),
  [commodityId,operations,today])
 const onTelemetry=useCallback((next:AgentMissionTelemetry)=>setTelemetry(next),[])
 const complete=telemetry.phase==='completed'&&telemetry.verdict!==null
 const detailHref='/dashboard?'+new URLSearchParams({
  module:'commodities',commodityId,view:'agents',
  ...(organizationId?{organizationId}:{}),
 }).toString()
 const changeCommodity=(id:string)=>{
  setTelemetry(emptyTelemetry)
  setCommodityId(id)
 }
 const changeHorizon=(value:7|30|90|180)=>{
  setTelemetry(emptyTelemetry)
  setDays(value)
 }
 const badge=telemetry.phase==='running'?'STAGES IN PROGRESS':
  complete?'DECISION BRIEF READY':'AWAITING AGENT RUN'
 const reviewedSources=balance?.evidence.sourceRefs.length??0
 const ready=Boolean(balance&&balance.status==='complete'&&hasVerifiedBalance)
 const latest=telemetry.steps.at(-1)
 const verdict=complete?telemetry.verdict:null
 return <section id="watchtower-agents" className={styles.room}
  aria-label={tx('Agent operations command center','مركز عمليات الوكلاء')}>
  <div className={styles.hero}>
   <div className={styles.ambient}/>
   <div className={styles.heroTop}>
    <div>
     <div className={styles.eyebrow}><Sparkles size={14}/> GROWA / INTELLIGENCE OPERATIONS</div>
     <h2>{tx('Agent Operations','عمليات الوكلاء')} <span>{tx('Command Center','مركز القيادة')}</span></h2>
     <p>{tx('A coordinated, evidence-led view of ten specialist analysis stages, from commodity health to procurement, logistics and human review.',
      'عرض منسق لعشر مراحل تحليل متخصصة تعتمد على الأدلة من توافر السلع حتى المشتريات والخدمات اللوجستية والمراجعة البشرية.')}</p>
    </div>
    <span className={styles.heroState} data-phase={telemetry.phase} aria-live="polite">
     <i/>{badge}</span>
   </div>
   <div className={styles.heroStats}>
    <div><small>MISSION PROGRESSION</small>
     <strong>{telemetry.completed}<em> / {telemetry.total}</em></strong>
     <p>Stages revealed after run</p></div>
    <div><small>REVIEWED FOOD BASELINE</small>
     <strong>{ready?'READY':'N/A'}</strong>
     <p>{ready?'Organization-scoped records':'Incomplete or unavailable'}</p></div>
    <div><small>OPERATIONAL EVIDENCE</small>
     <strong>{reviewedSources}</strong>
     <p>Food balance source references</p></div>
    <div><small>HUMAN GOVERNANCE</small>
     <strong>{complete?'REVIEW':'REQUIRED'}</strong>
     <p>No orders, releases or payments</p></div>
   </div>
  </div>

  <div className={styles.missionBoard}>
   <div className={styles.missionHead}>
    <div><h3>{tx('Specialist agent constellation','شبكة الوكلاء المتخصصين')}</h3>
     <p>{tx('Stages light up as the simulation progresses. Findings are visible only after their step is revealed.',
      'تظهر المراحل تدريجياً مع تقدم المحاكاة، ولا تظهر النتائج قبل اكتمال المرحلة.')}</p></div>
    <span>{Math.round(100*telemetry.completed/Math.max(1,telemetry.total))}% COMPLETE</span>
   </div>
   <div className={styles.pipeline}>
    {stages.map((stage,index)=>{
     const Icon=stage.icon
     const seen=telemetry.steps.find(s=>s.id===stage.id)
     const active=telemetry.phase==='running'&&telemetry.completed===index
     const state:MissionState=seen?
      seen.state==='needs_data'?'gap':'complete':active?'active':'waiting'
     return <div key={stage.id} className={styles.node} data-state={state}>
      <div className={styles.nodeTop}><Icon size={19}/>
       <small>{String(index+1).padStart(2,'0')} / 10</small></div>
      <div><strong>{tx(stage.en,stage.ar)}</strong>
       <p>{seen?tx(seen.titleEn,seen.titleAr):
        active?tx('Processing next…','جارٍ التحليل…'):
        tx('Awaiting previous stage','بانتظار المرحلة السابقة')}</p></div>
      <span className={styles.nodeState}>{state==='gap'?'EVIDENCE GAP':
       state==='complete'?'ANALYZED':state==='active'?'UP NEXT':'QUEUED'}</span>
     </div>
    })}
   </div>
   <div className={styles.controls}>
    <div className={styles.controlInputs}>
     <label>{tx('Commodity','السلعة')}
      <select value={commodityId} onChange={e=>changeCommodity(e.target.value)}
       aria-label={tx('Choose commodity','اختر سلعة')}>
       {COMMODITY_CATALOG.map(x=><option key={x.id} value={x.id}>
        {ar?x.nameAr:x.name}</option>)}
      </select>
     </label>
     <label>{tx('Analysis horizon','فترة التحليل')}
      <select value={days} onChange={e=>changeHorizon(Number(e.target.value) as 7|30|90|180)}
       aria-label={tx('Choose horizon','اختر الفترة')}>
       {[7,30,90,180].map(x=><option key={x} value={x}>{x} {tx('days','يوم')}</option>)}
      </select>
     </label>
    </div>
    <div className={styles.controlLinks}>
     <button type="button" onClick={()=>{setTelemetry(emptyTelemetry);refresh()}}
      disabled={loading}><RefreshCw size={14} className={loading?'animate-spin':''}/>
      {tx('Refresh evidence','تحديث الأدلة')}</button>
     <Link href={detailHref}>{tx('Commodity intelligence','معلومات السلعة')}
      <ArrowUpRight size={13}/></Link>
    </div>
   </div>
  </div>

  <div className={styles.briefGrid}>
   <div className={styles.brief} data-state={complete?'completed':!ready?'blocked':'pending'}>
    <div className={styles.sectionLabel}><Bot size={15}/> EXECUTIVE INTELLIGENCE BRIEF</div>
    <h3>{verdict?tx(verdict.headlineEn,verdict.headlineAr):
     telemetry.phase==='running'?
      tx('Specialists are evaluating the mission','الوكلاء يحللون المهمة'):
      ready?tx('Ready for a coordinated assessment','جاهز للتقييم المشترك'):
      tx('Evidence is needed before a decision','يلزم استكمال الأدلة قبل القرار')}</h3>
    <p>{verdict?tx(verdict.reasonEn,verdict.reasonAr):
     telemetry.phase==='running'?
      tx('The verified inputs and selected shocks are moving through the specialist workflow. Final recommendations remain hidden until completion.',
       'يُجرى تحليل المدخلات والصدمات المختارة، وتبقى التوصيات النهائية مخفية حتى اكتمال التحليل.'):
     ready?tx('Select a scenario below and run the agent sequence to generate a traceable recommendation.',
      'حدد سيناريو ثم شغل تسلسل الوكلاء لإعداد توصية قابلة للتتبع.'):
     tx('The organization food balance lacks the reviewed stock or flow coverage necessary for reliable risk conclusions.',
      'تنقص بيانات المخزون أو التدفقات المراجعة اللازمة لاستنتاج المخاطر.')}</p>
    {verdict&&<>
     <span className={styles.verdictTag}>PRIORITY · {verdict.priority.toUpperCase()} · HUMAN REVIEW</span>
     <div className={styles.verdictNext}><strong>NEXT RECOMMENDED ACTION</strong>
      {tx(verdict.nextStepEn,verdict.nextStepAr)}</div>
    </>}
    {!verdict&&latest&&<div className={styles.verdictNext}>
     <strong>LATEST COMPLETED SPECIALIST HANDOFF</strong>
     {tx(latest.findingEn,latest.findingAr)}</div>}
    {foodError&&<p role="status">{foodError}</p>}
   </div>
   <div className={styles.evidence}>
    <div className={styles.sectionLabel}><ShieldCheck size={15}/> SOURCE & EXECUTION GUARDRAILS</div>
    <h3>Operational readiness</h3>
    <p>Actual linked records are kept separate from simulation outcomes.</p>
    <ul>
     <li><span>Reviewed commodity baseline</span><strong>{ready?'COMPLETE':'INCOMPLETE'}</strong></li>
     <li><span>Linked approved contracts</span>
      <strong>{fmt(linked.approvedContractTonnes)} t</strong></li>
     <li><span>Delayed shipments</span><strong>{linked.delayedShipments}</strong></li>
     <li><span>Uncommitted reserve lots</span>
      <strong>{fmt(linked.availableReserveTonnes)} t</strong></li>
     <li><span>Decisions executed by this page</span><strong>0</strong></li>
    </ul>
    {operationsError&&<p role="status" className={styles.evidenceFooter}>{operationsError}</p>}
    <p className={styles.evidenceFooter}>
     No LLM or external agent service is called by the scenario simulation.
     Results are deterministic, read-only and require an authorized reviewer before real action.
    </p>
   </div>
  </div>

  <div className={styles.simulatorSlot}>
   <div className={styles.simulatorHeading}>
    <div><h3>{tx('Mission execution studio','استوديو تشغيل المهمة')}</h3>
     <p>{tx('Configure shocks, run the ten-stage analysis, inspect evidence and review the final recommendation.',
      'اضبط الصدمات وشغل تحليل المراحل العشر وراجع الأدلة والتوصية النهائية.')}</p></div>
    <span className={styles.readonly}><ShieldAlert size={13} className="inline me-1"/>READ ONLY · HUMAN-GATED</span>
   </div>
   <CommodityAgentLab key={commodityId+':'+days} balance={balance}
    operations={operations} today={today} onTelemetry={onTelemetry}/>
  </div>
 </section>
}
