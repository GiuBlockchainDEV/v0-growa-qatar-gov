'use client'

import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {
  Activity,ArrowRight,ArrowUpRight,Bot,Check,ChevronRight,ClipboardCheck,
  Database,FastForward,FileCheck2,FileWarning,LockKeyhole,Play,RefreshCw,
  RotateCcw,ShieldAlert,ShieldCheck,Workflow,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {FoodPosture} from '@/lib/watchtower/food-posture'
import {buildResilienceDecisionQueue} from '@/lib/watchtower/resilience-queue'
import {
  simulateResilienceAgentTrace,type ResilienceAgentTrace,type AgentTraceStage,
} from '@/lib/watchtower/resilience-agent-trace'
import styles from './resilience-desk.module.css'

function commodityHref(id:string,organizationId:string){
  return '/dashboard?'+new URLSearchParams({
    module:'commodities',commodityId:id,organizationId,
  }).toString()
}
function statusName(state:AgentTraceStage['state'],ar:boolean){
  const labels={
    verified:['Completed','مكتمل'],
    attention:['Needs review','يتطلب المراجعة'],
    blocked:['Evidence gap','نقص الأدلة'],
    gate:['Human gate','بوابة بشرية'],
  }
  return labels[state][ar?1:0]
}
type Session={snapshot:FoodPosture;commodityId:string;trace:ResilienceAgentTrace}
export function WatchtowerResilienceDesk({posture}:{posture:FoodPosture}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const queue=useMemo(()=>buildResilienceDecisionQueue(posture),[posture])
  const initial=queue.procurementReview[0]?.commodityId??
    queue.evidenceReview[0]?.commodityId??posture.commodities[0]?.commodityId??''
  const [selectedCommodity,setSelectedCommodity]=useState(initial)
  const [session,setSession]=useState<Session|null>(null)
  const [revealed,setRevealed]=useState(0)
  const [running,setRunning]=useState(false)
  const [selectedStage,setSelectedStage]=useState(0)
  const [reviewChoice,setReviewChoice]=useState<'acknowledged'|'deferred'|null>(null)

  // No verdict or prior tenant/horizon trace can survive a new source snapshot.
  const selectionExists=posture.commodities.some(x=>x.commodityId===selectedCommodity)
  const effectiveCommodity=selectionExists?selectedCommodity:initial
  const trace=session&&session.snapshot===posture&&
    session.commodityId===effectiveCommodity?session.trace:null
  const completed=Boolean(trace)&&revealed===(trace?.steps.length??0)
  useEffect(()=>{
    setSession(null)
    setRunning(false)
    setRevealed(0)
    setSelectedStage(0)
    setReviewChoice(null)
  },[posture])

  useEffect(()=>{
    if(!running||!trace)return
    if(revealed>=trace.steps.length){
      setRunning(false)
      return
    }
    const timeout=setTimeout(()=>{
      setRevealed(value=>Math.min(value+1,trace.steps.length))
      setSelectedStage(value=>Math.min(value+1,trace.steps.length-1))
    },720)
    return ()=>clearTimeout(timeout)
  },[running,revealed,trace])

  const reset=()=>{
    setRunning(false);setSession(null);setRevealed(0)
    setSelectedStage(0);setReviewChoice(null)
  }
  const changeCommodity=(id:string)=>{setSelectedCommodity(id);reset()}
  const begin=()=>{
    if(!effectiveCommodity)return
    const built=simulateResilienceAgentTrace(posture,effectiveCommodity)
    setSession({snapshot:posture,commodityId:effectiveCommodity,trace:built})
    setRunning(true);setRevealed(0);setSelectedStage(0);setReviewChoice(null)
  }
  const skip=()=>{
    if(!trace)return
    setRevealed(trace.steps.length)
    setSelectedStage(trace.steps.length-1)
    setRunning(false)
  }
  const viewStage=trace?.steps[selectedStage]??null
  const viewedIsReady=Boolean(viewStage&&selectedStage<revealed)
  const doneCount=trace?Math.min(revealed,trace.steps.length):0

  return <section id="watchtower-response" className={styles.room}
    aria-label={tx('Resilience and procurement decision desk','مكتب قرارات المرونة والمشتريات')}
    dir={ar?'rtl':'ltr'}>
    <div className={styles.hero}>
      <div className={styles.heroTop}>
        <div>
          <div className={styles.heroEyebrow}><Bot size={16}/>
            {tx('GROWA / RESILIENCE INTELLIGENCE','جروا / استخبارات المرونة')}
          </div>
          <h3 className={styles.heroTitle}>
            {tx('Resilience & procurement decision desk','مكتب قرارات المرونة والمشتريات')}
          </h3>
          <p className={styles.heroDescription}>{tx(
            'Explore an auditable, step-by-step agent workflow from source verification to stock exposure, procurement alternatives and human authorization.',
            'استكشف سير عمل الوكلاء خطوة بخطوة من تدقيق المصادر إلى تقييم المخزون والبدائل والاعتماد البشري.')}</p>
        </div>
        <span className={styles.heroMode}><i/>
          {tx('READ-ONLY AGENT REHEARSAL','محاكاة للوكلاء · للقراءة فقط')}</span>
      </div>
      <div className={styles.heroMetrics}>
        {[
          {name:tx('P0 · Projected deficits','P0 · عجز متوقع'),value:queue.summary.p0,state:'critical',
            detail:tx('Review with verified inputs','مراجعة بمدخلات موثقة')},
          {name:tx('P1 · Short coverage','P1 · تغطية قصيرة'),value:queue.summary.p1,state:'attention',
            detail:tx('Reserve and replenishment','الاحتياطي وإعادة التوريد')},
          {name:tx('P2 · Buffer review','P2 · مراجعة الاحتياطي'),value:queue.summary.p2,state:'attention',
            detail:tx('Provisional screening','فحص أولي')},
          {name:tx('Evidence required','الأدلة المطلوبة'),value:queue.summary.evidence,state:'neutral',
            detail:tx('Not evidence of safety','لا يعني الأمان')},
        ].map(item=><div key={item.name} className={styles.heroMetric}
          data-state={item.state}>
          <span>{item.name}</span><strong>{item.value}</strong><small>{item.detail}</small>
        </div>)}
      </div>
      <div className={styles.heroFoot}>
        <span><Database size={12}/>{queue.summary.assessed} / {queue.summary.total}
          {' '}{tx('reviewed commodities','سلع مُراجعة')}</span>
        <span><LockKeyhole size={12}/>{tx(
          'No purchase orders, supplier claims or external AI calls',
          'لا أوامر شراء أو بيانات موردين غير موثقة أو اتصال بخدمات AI خارجية')}</span>
        <span><FileCheck2 size={12}/>{tx('Human approval required','موافقة بشرية مطلوبة')}</span>
      </div>
    </div>

    <div className={styles.console}>
      <div className={styles.consoleTop}>
        <div className={styles.consoleTitle}>
          <div className={styles.eyebrow}><Workflow size={13}/>
            {tx('SPECIALIST WORKFLOW','سير عمل المختصين')}</div>
          <h4>{tx('Run the analysis sequence','تشغيل تسلسل التحليل')}</h4>
          <p>{tx('11 transparent checks with recorded inputs, operations, outputs and handoffs. Results appear only after you start.',
            '11 فحصاً واضحاً للمدخلات والعمليات والمخرجات والتسليم. لا تظهر النتائج قبل التشغيل.')}</p>
        </div>
        <div className={styles.controls}>
          <label>{tx('Commodity under review','السلعة المراد مراجعتها')}
            <select value={effectiveCommodity} disabled={!posture.commodities.length}
              onChange={event=>changeCommodity(event.target.value)}
              aria-label={tx('Choose commodity for agent analysis','اختر السلعة للتحليل')}>
              {posture.commodities.map(row=><option value={row.commodityId}
                key={row.commodityId}>{ar?row.nameAr:row.name}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className={styles.runRow}>
        <button type="button" className={styles.primaryButton}
          onClick={begin} disabled={!posture.commodities.length}>
          <Play size={14}/>{trace?tx('Restart analysis','إعادة تشغيل التحليل'):
            tx('Run agent analysis','تشغيل تحليل الوكلاء')}</button>
        <button type="button" className={styles.secondaryButton}
          onClick={skip} disabled={!trace||completed}>
          <FastForward size={14}/>{tx('Complete sequence','إكمال التسلسل')}</button>
        <button type="button" className={styles.secondaryButton}
          onClick={reset} disabled={!trace}>
          <RotateCcw size={14}/>{tx('Reset','إعادة ضبط')}</button>
        <span className={styles.runLabel} role="status" aria-live="polite">
          {running&&<RefreshCw size={12} className="animate-spin"/>}
          {trace?doneCount+' / '+trace.steps.length+' '+
            tx('checks processed','فحوصات منفذة'):
            tx('Awaiting user initiation','بانتظار بدء المستخدم')}
        </span>
      </div>
      {trace&&<div className={styles.progressTrack} role="progressbar"
        aria-valuemin={0} aria-valuemax={trace.steps.length} aria-valuenow={doneCount}
        aria-label={tx('Completed simulation stages','مراحل المحاكاة المكتملة')}>
        <span style={{width:(doneCount/trace.steps.length*100)+'%'}}/>
      </div>}
      {!trace&&<div className={styles.idle}>
        <Bot size={27}/>
        <div><strong>{tx('Agent room ready','غرفة الوكلاء جاهزة')}</strong>
          <p>{tx('Choose a commodity and run the sequence. Nothing is treated as analyzed before initiation.',
            'اختر سلعة وابدأ التحليل. لا تُعد أي مرحلة منفذة قبل البدء.')}</p>
        </div>
      </div>}
    </div>

    {trace&&<div className={styles.workArea}>
      <section className={styles.pipeline}>
        <div className={styles.sectionTop}><strong><Workflow size={14}/>
          {tx('Agent execution timeline','الجدول الزمني للوكلاء')}</strong>
          <small>{doneCount}/{trace.steps.length}</small>
        </div>
        <div className={styles.timeline}>
          {trace.steps.map((step,index)=>{
            const shown=index<doneCount
            const active=running&&index===doneCount
            return <button type="button" key={step.id}
              className={styles.timelineRow} data-selected={selectedStage===index}
              data-status={shown?'done':active?'running':'queued'}
              disabled={!shown&&!active} onClick={()=>setSelectedStage(index)}>
              <span className={styles.timelineIndex}>{shown?<Check size={12}/>:index+1}</span>
              <div className={styles.timelineContent}>
                <strong>{ar?step.titleAr:step.title}</strong>
                <span>{ar?step.agentAr:step.agent}</span>
                {shown&&<small className={styles.state} data-state={step.state}>
                  {statusName(step.state,ar)}</small>}
                {active&&<small className={styles.state}>
                  <Activity size={10}/>{tx('Processing','جارٍ التنفيذ')}</small>}
              </div>
              <ChevronRight size={13}/>
            </button>
          })}
        </div>
      </section>
      <section className={styles.stagePanel} aria-label={tx('Agent process inspector','مفتش عمليات الوكلاء')}>
        <div className={styles.sectionTop}><strong><Activity size={14}/>
          {tx('Process inspector','مفتش العمليات')}</strong>
          <small>{tx('Stage','المرحلة')} {selectedStage+1}/{trace.steps.length}</small>
        </div>
        {!viewedIsReady||!viewStage?
          <div className={styles.waiting}><RefreshCw size={23}/>
            {tx('Awaiting completion of this specialist check.',
              'بانتظار إكمال الفحص المتخصص.')}</div>:
          <div className={styles.stageBody}>
            <div>
              <div className={styles.stepEyebrow}>{ar?viewStage.agentAr:viewStage.agent}
                {' · '}{statusName(viewStage.state,ar)}</div>
              <h4 className={styles.stepTitle}>{ar?viewStage.titleAr:viewStage.title}</h4>
              <p className={styles.stepDescription}>
                {ar?viewStage.operationAr:viewStage.operation}</p>
            </div>
            <div className={styles.finding} data-state={viewStage.state}>
              <span>{tx('OBSERVED RESULT / LIMITATION','النتيجة / الحدود')}</span>
              <p>{ar?viewStage.findingAr:viewStage.finding}</p>
            </div>
            <div className={styles.traceGrid}>
              <div className={styles.traceBox}><h5><Database size={12}/>
                {tx('INPUTS INSPECTED','المدخلات المفحوصة')}</h5>
                <ul>{viewStage.input.map((v,i)=><li key={i}>{v}</li>)}</ul>
              </div>
              <div className={styles.traceBox}><h5><FileCheck2 size={12}/>
                {tx('OUTPUTS & EVIDENCE','المخرجات والأدلة')}</h5>
                <ul>{viewStage.output.map((v,i)=><li key={i}>{v}</li>)}</ul>
              </div>
            </div>
            <div className={styles.handoff}><ArrowRight size={14}/>
              <span><strong>{tx('Agent handoff: ','التسليم بين الوكلاء: ')}</strong>
                {ar?viewStage.handoffAr:viewStage.handoff}</span></div>
          </div>}
      </section>
    </div>}

    {completed&&trace&&<section className={styles.verdict}>
      <div className={styles.verdictTop}>
        <div>
          <span className={styles.verdictTag}>{tx('FINAL SYNTHESIS · HUMAN REVIEW REQUIRED',
            'الخلاصة النهائية · تتطلب مراجعة بشرية')}</span>
          <h4>{ar?trace.verdict.titleAr:trace.verdict.title}</h4>
        </div>
        <span className={styles.priorityBadge} data-priority={trace.verdict.priority}>
          {trace.verdict.priority}</span>
      </div>
      <p>{ar?trace.verdict.rationaleAr:trace.verdict.rationale}</p>
      <div className={styles.nextAction}>
        <strong><ClipboardCheck size={13}/>{tx('Recommended next investigation','التحقيق التالي المقترح')}</strong>
        <p>{ar?trace.verdict.nextActionAr:trace.verdict.nextAction}</p>
      </div>
      <div className={styles.reviewControls}>
        <button type="button" className={styles.secondaryButton}
          onClick={()=>setReviewChoice('acknowledged')}>
          <ShieldCheck size={14}/>{tx('Mark reviewed (local only)','تحديد كمُراجع (محلي فقط)')}</button>
        <button type="button" className={styles.secondaryButton}
          onClick={()=>setReviewChoice('deferred')}>
          <FileWarning size={14}/>{tx('Defer assessment','تأجيل التقييم')}</button>
        <Link href={commodityHref(trace.commodityId,trace.organizationId)}
          className={styles.secondaryButton}>
          {tx('Investigate commodity','تحليل السلعة')}<ArrowUpRight size={13}/></Link>
      </div>
      <p className={styles.reviewStatus}>{reviewChoice==='acknowledged'?
        tx('Marked reviewed in this browser session only. No authorization or order has been sent.',
          'تمت المراجعة في هذه الجلسة فقط دون اعتماد أو طلب شراء.'):
        reviewChoice==='deferred'?
          tx('Assessment deferred in this browser session only. No database state was changed.',
            'تم تأجيل التقييم في هذه الجلسة فقط دون تغيير البيانات.'):
          tx('Awaiting a human reviewer. No procurement actions have been executed.',
            'بانتظار المراجع البشري. لم تُنفذ إجراءات شراء.')}</p>
    </section>}

    <section className={styles.backlog}>
      <div className={styles.backlogHead}><h4>{tx('Evidence & procurement review backlog',
        'قائمة مراجعة الأدلة والمشتريات')}</h4>
        <span>{queue.procurementReview.length} {tx('supply signals','إشارات توريد')}
          {' · '}{queue.evidenceReview.length} {tx('evidence gaps','فجوات أدلة')}</span>
      </div>
      <div className={styles.backlogGrid}>
        <div><div className={styles.eyebrow}><ShieldAlert size={13}/>
          {tx('SUPPLY INVESTIGATIONS','تحقيقات التوريد')}</div>
          {queue.procurementReview.length===0?
            <p className={styles.emptyBacklog}>{queue.summary.assessed===0?
              tx('No reviewed supply balances. No shortage classification is possible.',
                'لا توجد موازين إمداد مُراجعة، ولا يمكن تصنيف العجز.'):
              tx('No current screening triggers among assessed commodities.',
                'لا توجد مؤشرات فحص ضمن السلع المُقيّمة.')}</p>:
            <ul className={styles.backlogList}>{queue.procurementReview.slice(0,6).map(action=>
              <li key={action.commodityId}><div><strong>
                {ar?action.nameAr:action.name}</strong><span> · {action.priority}</span></div>
                <Link href={commodityHref(action.commodityId,posture.organizationId)}>
                  {tx('Review','مراجعة')}<ArrowUpRight size={12}/></Link>
              </li>)}</ul>}
        </div>
        <div><div className={styles.eyebrow}><FileWarning size={13}/>
          {tx('SOURCE VERIFICATION','التحقق من المصادر')}</div>
          {queue.evidenceReview.length===0?
            <p className={styles.emptyBacklog}>{tx('No identified evidence gaps in this assessed horizon.',
              'لا توجد فجوات أدلة محددة في هذه الفترة.')}</p>:
            <ul className={styles.backlogList}>{queue.evidenceReview.slice(0,6).map(action=>
              <li key={action.commodityId}><div><strong>
                {ar?action.nameAr:action.name}</strong>
                <span> · {tx('not assessed','غير مقيّم')}</span></div>
                <Link href={commodityHref(action.commodityId,posture.organizationId)}>
                  {tx('Verify','تحقق')}<ArrowUpRight size={12}/></Link>
              </li>)}</ul>}
        </div>
      </div>
    </section>
    <footer className={styles.foot}>
      <span>{tx('This is a deterministic agent-workflow simulation, not a live multi-agent LLM execution. Supplier search, shipping quotes and purchasing require separate connected workflows and authorization.',
        'هذه محاكاة محددة وليست تشغيل نماذج LLM حية. يتطلب البحث عن الموردين وعروض الشحن والشراء خدمات متصلة وموافقة منفصلة.')}</span>
      <Link href="/dashboard?module=data-health">{tx('Data governance & source health','حوكمة البيانات وصحة المصادر')}
        <ArrowUpRight size={12}/></Link>
    </footer>
  </section>
}
