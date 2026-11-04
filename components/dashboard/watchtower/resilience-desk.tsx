'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import {
  Activity,ArrowRight,ArrowUpRight,Bot,Check,ChevronRight,ClipboardCheck,
  Database,FastForward,FileCheck2,FileWarning,LockKeyhole,Play,RefreshCw,
  RotateCcw,ShieldAlert,ShieldCheck,Terminal,Radio,Workflow,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {FoodPosture} from '@/lib/watchtower/food-posture'
import {buildResilienceDecisionQueue} from '@/lib/watchtower/resilience-queue'
import {
  simulateResilienceAgentTrace,type ResilienceAgentTrace,type AgentTraceStage,
} from '@/lib/watchtower/resilience-agent-trace'
import {buildAgentPlaybackEvents,activeAgentStage,completedAgentStages,
  revealedAgentFinding,type AgentPlaybackLog} from '@/lib/watchtower/resilience-agent-playback'
import {WatchtowerProcurementMission} from './procurement-mission'
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
  const [eventCursor,setEventCursor]=useState(0)
  const [eventLog,setEventLog]=useState<AgentPlaybackLog[]>([])
  const [followActive,setFollowActive]=useState(true)
  const logEndRef=useRef<HTMLDivElement|null>(null)
  const [running,setRunning]=useState(false)
  const [selectedStage,setSelectedStage]=useState(0)
  const [reviewChoice,setReviewChoice]=useState<'acknowledged'|'deferred'|null>(null)

  // No verdict or prior tenant/horizon trace can survive a new source snapshot.
  const selectionExists=posture.commodities.some(x=>x.commodityId===selectedCommodity)
  const effectiveCommodity=selectionExists?selectedCommodity:initial
  const trace=session&&session.snapshot===posture&&
    session.commodityId===effectiveCommodity?session.trace:null
  const playbackEvents=useMemo(()=>trace?buildAgentPlaybackEvents(trace):[],[trace])
  const visibleEvents=useMemo(()=>playbackEvents.slice(0,eventCursor),[playbackEvents,eventCursor])
  const revealed=completedAgentStages(visibleEvents)
  const activeIndex=activeAgentStage(visibleEvents,trace?.steps.length??0)
  const completed=Boolean(trace)&&eventCursor===playbackEvents.length
  const viewedStage=trace?.steps[selectedStage]??null
  const viewedHasStarted=visibleEvents.some(event=>event.stageIndex===selectedStage)
  const viewedIsReady=Boolean(viewedStage&&revealedAgentFinding(visibleEvents,viewedStage.id))
  const doneCount=trace?Math.min(revealed,trace.steps.length):0
  const activeStep=trace?.steps[activeIndex]??null
  const currentMessage=eventLog.at(-1)??null

  useEffect(()=>{
    setSession(null);setRunning(false);setEventCursor(0);setEventLog([])
    setSelectedStage(0);setFollowActive(true);setReviewChoice(null)
  },[posture])

  // Timed disclosure of precomputed, source-backed messages.
  // This is audit playback, not actual processing time or LLM thought.
  useEffect(()=>{
    if(!running||!trace)return
    if(eventCursor>=playbackEvents.length){setRunning(false);return}
    const timeout=setTimeout(()=>{
      const event=playbackEvents[eventCursor]
      if(!event)return
      const nextCursor=eventCursor+1
      setEventLog(current=>[...current,{...event,emittedAt:Date.now()}])
      setEventCursor(nextCursor)
      if(followActive)setSelectedStage(activeAgentStage(
        playbackEvents.slice(0,nextCursor),trace.steps.length))
      if(nextCursor===playbackEvents.length)setRunning(false)
    },eventCursor===0?250:340)
    return ()=>clearTimeout(timeout)
  },[running,eventCursor,trace,playbackEvents,followActive])

  useEffect(()=>{
    if(running&&followActive)logEndRef.current?.scrollIntoView({
      behavior:'smooth',block:'nearest',
    })
  },[eventLog.length,running,followActive])

  const reset=()=>{
    setRunning(false);setSession(null);setEventCursor(0);setEventLog([])
    setSelectedStage(0);setFollowActive(true);setReviewChoice(null)
  }
  const changeCommodity=(id:string)=>{setSelectedCommodity(id);reset()}
  const begin=()=>{
    if(!effectiveCommodity)return
    const built=simulateResilienceAgentTrace(posture,effectiveCommodity)
    setSession({snapshot:posture,commodityId:effectiveCommodity,trace:built})
    setRunning(true);setEventCursor(0);setEventLog([])
    setSelectedStage(0);setFollowActive(true);setReviewChoice(null)
  }
  const skip=()=>{
    if(!trace)return
    setEventLog(current=>[...current,...playbackEvents.slice(eventCursor)
      .map(event=>({...event,emittedAt:null,expanded:true}))])
    setEventCursor(playbackEvents.length)
    setSelectedStage(trace.steps.length-1);setFollowActive(true);setRunning(false)
  }
  const inspectStage=(index:number)=>{setSelectedStage(index);setFollowActive(false)}
  const returnToLive=()=>{setFollowActive(true);setSelectedStage(activeIndex)}
  const formatLogTime=(log:AgentPlaybackLog)=>
    log.emittedAt===null?tx('Expanded','موسع'):
      new Date(log.emittedAt).toLocaleTimeString(ar?'ar-QA':'en-GB',{
        hour:'2-digit',minute:'2-digit',second:'2-digit',
      })
  return <section id="watchtower-response" className={styles.room}
    aria-label={tx('Resilience and procurement decision desk','مكتب قرارات المرونة والمشتريات')}
    dir={ar?'rtl':'ltr'}>
    <WatchtowerProcurementMission key={posture.organizationId+':'+posture.generatedAt} posture={posture}/>
    <details className={styles.legacyAudit}>
      <summary>{tx('Diagnostic agent audit · source validation playback',
        'تدقيق الوكلاء التشخيصي · مراجعة التحقق من المصادر')}</summary>
      <div className={styles.legacyAuditContent}>
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
          <p>{tx('11 source-backed specialist checks, unfolding as progressive input, validation, findings and handoffs after you start.',
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
            tx('stages complete','مراحل مكتملة')+' · '+eventCursor+'/'+playbackEvents.length+' '+
            tx('audit events','أحداث تدقيق'):
            tx('Awaiting user initiation','بانتظار بدء المستخدم')}
        </span>
      </div>
      {trace&&<div className={styles.progressTrack} role="progressbar"
        aria-valuemin={0} aria-valuemax={playbackEvents.length} aria-valuenow={eventCursor}
        aria-label={tx('Completed simulation stages','مراحل المحاكاة المكتملة')}>
        <span style={{width:(playbackEvents.length?eventCursor/playbackEvents.length*100:0)+'%'}}/>
      </div>}
      {!trace&&<div className={styles.idle}>
        <Bot size={27}/>
        <div><strong>{tx('Agent room ready','غرفة الوكلاء جاهزة')}</strong>
          <p>{tx('Choose a commodity and run the sequence. Nothing is treated as analyzed before initiation.',
            'اختر سلعة وابدأ التحليل. لا تُعد أي مرحلة منفذة قبل البدء.')}</p>
        </div>
      </div>}
    </div>

    {trace&&<section className={styles.liveConsole}
      aria-label={tx('Live agent audit console','وحدة تدقيق الوكلاء المباشرة')}>
      <div className={styles.liveConsoleHead}>
        <div className={styles.liveConsoleHeading}>
          <Terminal size={15}/>
          <div><strong>{tx('Agent operations stream','تدفق عمليات الوكلاء')}</strong>
            <small>{tx('Source-backed replay · visual timestamps, not measured compute time',
              'إعادة عرض مبنية على المصادر · أوقات العرض ليست وقت الحوسبة')}</small>
          </div>
        </div>
        <div className={styles.liveConsoleActions}>
          <span className={styles.liveStatus} data-running={running}>
            <i/>{running?tx('REPLAYING','جارٍ العرض'):
              completed?tx('REPLAY COMPLETE','اكتمل العرض'):tx('PAUSED','متوقف')}</span>
          <button className={styles.followButton} type="button" onClick={returnToLive}
            aria-pressed={followActive}><Radio size={12}/>
            {tx('Follow active','متابعة الحالي')}</button>
        </div>
      </div>
      <div className={styles.activeOperation}>
        <span className={styles.activeOperationIcon}><Bot size={18}/></span>
        <div>
          <small>{running?tx('CURRENT SPECIALIST','الوكيل الحالي'):
            completed?tx('WORKFLOW REPLAY COMPLETE','اكتملت إعادة العرض'):
              tx('WAITING','بانتظار')}</small>
          <strong>{activeStep?(ar?activeStep.agentAr:activeStep.agent):
            tx('Scope controller','مراقب النطاق')}</strong>
          <span>{currentMessage?(ar?currentMessage.textAr:currentMessage.text):
            tx('Preparing the first documented check…','تحضير أول فحص موثق…')}</span>
        </div>
        <span className={styles.activeOperationPulse} data-active={running}>
          <Activity size={16}/></span>
      </div>
      <div className={styles.logScroll} role="log"
        aria-label={tx('Progressive audit events','أحداث التدقيق التدريجية')}
        aria-live="off" aria-relevant="additions text">
        {eventLog.length===0&&<p className={styles.emptyLog}>
          {tx('Awaiting the first documented audit event…','بانتظار أول حدث تدقيق موثق…')}</p>}
        {eventLog.map((log,index)=><div key={log.id} className={styles.logLine}
          data-kind={log.kind} data-state={log.resultState}
          data-expanded={log.expanded===true}>
          <time dateTime={log.emittedAt===null?undefined:new Date(log.emittedAt).toISOString()}>
            {formatLogTime(log)}</time>
          <span className={styles.logIndex}>{String(index+1).padStart(3,'0')}</span>
          <span className={styles.logKind}>{log.kind.toUpperCase()}</span>
          <span className={styles.logText}>{ar?log.textAr:log.text}</span>
        </div>)}
        {running&&<div className={styles.logCursor}>
          <span className={styles.cursorBlock}/>
          {tx('Replaying next documented check…','عرض الفحص الموثق التالي…')}
        </div>}
        <div ref={logEndRef}/>
      </div>
      <div className={styles.liveConsoleFoot}>
        <span>{eventCursor} / {playbackEvents.length} {tx('events displayed','حدث معروض')}</span>
        <span>{tx('No external LLM, supplier or route services invoked',
          'لم تُستدع خدمات نماذج AI أو الموردين أو المسارات الخارجية')}</span>
      </div>
    </section>}

    {trace&&<div className={styles.workArea}>
      <section className={styles.pipeline}>
        <div className={styles.sectionTop}><strong><Workflow size={14}/>
          {tx('Agent execution timeline','الجدول الزمني للوكلاء')}</strong>
          <small>{doneCount}/{trace.steps.length}</small>
        </div>
        <div className={styles.timeline}>
          {trace.steps.map((step,index)=>{
            const shown=index<doneCount
            const active=running&&index===activeIndex
            return <button type="button" key={step.id}
              className={styles.timelineRow} data-selected={selectedStage===index}
              data-status={shown?'done':active?'running':'queued'}
              disabled={!shown&&!active} onClick={()=>inspectStage(index)}>
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
        {!viewedHasStarted||!viewedStage?
          <div className={styles.waiting}><RefreshCw size={23}/>
            {tx('Awaiting this specialist stage and its audit events.',
              'بانتظار هذه المرحلة وأحداث التدقيق.')}</div>:
          <div className={styles.stageBody}>
            <div>
              <div className={styles.stepEyebrow}>{ar?viewedStage.agentAr:viewedStage.agent}
                {' · '}{viewedIsReady?statusName(viewedStage.state,ar):
                  tx('Inspecting inputs','فحص المدخلات')}</div>
              <h4 className={styles.stepTitle}>{ar?viewedStage.titleAr:viewedStage.title}</h4>
              <p className={styles.stepDescription}>
                {ar?viewedStage.operationAr:viewedStage.operation}</p>
            </div>
            <div className={styles.finding} data-state={viewedIsReady?viewedStage.state:'pending'}>
              <span>{tx('OBSERVED RESULT / LIMITATION','النتيجة / الحدود')}</span>
              <p>{viewedIsReady?(ar?viewedStage.findingAr:viewedStage.finding):
                tx('Inspecting documented source inputs…','فحص مدخلات المصدر الموثقة…')}</p>
            </div>
            <div className={styles.traceGrid}>
              <div className={styles.traceBox}><h5><Database size={12}/>
                {tx('INPUTS INSPECTED','المدخلات المفحوصة')}</h5>
                <ul>{visibleEvents.filter(v=>v.stageId===viewedStage.id&&v.kind==='input')
                  .map((v,i)=><li key={i}>{ar?v.textAr:v.text}</li>)}</ul>
              </div>
              <div className={styles.traceBox}><h5><FileCheck2 size={12}/>
                {tx('OUTPUTS & EVIDENCE','المخرجات والأدلة')}</h5>
                <ul>{visibleEvents.filter(v=>v.stageId===viewedStage.id&&v.kind==='output')
                  .map((v,i)=><li key={i}>{ar?v.textAr:v.text}</li>)}</ul>
              </div>
            </div>
            {visibleEvents.some(v=>v.stageId===viewedStage.id&&v.kind==='handoff')&&
              <div className={styles.handoff}><ArrowRight size={14}/>
                <span><strong>{tx('Agent handoff: ','التسليم بين الوكلاء: ')}</strong>
                  {ar?viewedStage.handoffAr:viewedStage.handoff}</span></div>}
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
    </div>
    </details>
  </section>
}
