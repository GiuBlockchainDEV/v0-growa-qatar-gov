'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Bot, Check, ChevronRight, ClipboardCheck, FastForward, Play,
  RotateCcw, ShieldCheck, Sparkles,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { FoodBalanceResult } from '@/lib/food-security/balance'
import {
  ZERO_FOOD_SCENARIO, type FoodScenarioAdjustments,
} from '@/lib/food-security/scenario'
import { AGENT_REGISTRY } from '@/lib/ai/agents/registry'
import { CommodityAgentVerdict } from '@/components/dashboard/commodity-agent-verdict'
import { CommodityAgentProgress, CommodityScenarioCharts } from '@/components/dashboard/commodity-scenario-charts'
import { buildAgentFinalRecommendation } from '@/lib/nfii/agent-decision'
import type { OperationsSnapshot } from '@/lib/nfii/operations-types'
import {
  simulateCommodityAgents, type AgentStep, type CommodityAgentSimulation,
} from '@/lib/nfii/agent-operational-simulation'

const PRESETS = [
  {id:'baseline',en:'Baseline',ar:'الأساس',
    shocks:{...ZERO_FOOD_SCENARIO}},
  {id:'import',en:'Import disruption',ar:'اضطراب الواردات',
    shocks:{...ZERO_FOOD_SCENARIO,importReductionPercent:65}},
  {id:'climate',en:'Crop production loss',ar:'فقد الإنتاج المحلي',
    shocks:{...ZERO_FOOD_SCENARIO,productionReductionPercent:45}},
  {id:'compound',en:'Compound crisis',ar:'أزمة مركبة',
    shocks:{productionReductionPercent:40,importReductionPercent:65,
      demandIncreasePercent:20,openingStockLossPercent:10}},
] as const

const CONTROLS: Array<{key:keyof FoodScenarioAdjustments;en:string;ar:string}>=[
  {key:'productionReductionPercent',en:'Production reduction',ar:'انخفاض الإنتاج'},
  {key:'importReductionPercent',en:'Import disruption',ar:'اضطراب الواردات'},
  {key:'demandIncreasePercent',en:'Demand increase',ar:'زيادة الطلب'},
  {key:'openingStockLossPercent',en:'Stock loss',ar:'فقد المخزون'},
]

function fmt(n:number|null|undefined):string {
  return n===null||n===undefined||!Number.isFinite(n)?'—':
    n.toLocaleString('en-US',{maximumFractionDigits:1})
}

type AgentRunSession = {
  balance: FoodBalanceResult
  operations: OperationsSnapshot
  today: string
  shocks: FoodScenarioAdjustments
  result: CommodityAgentSimulation
}

function StepBadge({step,active,ar}:{step:AgentStep;active:boolean;ar:boolean}){
  const style=active?'border-line-accent bg-cream-100 text-sage-700':
    step.state==='needs_data'?'border-warning-line bg-warning-soft text-warning-strong':
      step.state==='review'?'border-line bg-muted text-content-soft':
        'border-line-accent bg-cream-100 text-sage-700'
  const label=active?(ar?'قيد التحليل':'Analyzing'):
    step.state==='needs_data'?(ar?'مصدر ناقص':'Evidence gap'):
      step.state==='review'?(ar?'مراجعة':'Review'):(ar?'مكتمل':'Complete')
  return <span className={'shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium '+style}>{label}</span>
}

export function CommodityAgentLab({
  balance,operations,today,
}:{
  balance:FoodBalanceResult|null
  operations:OperationsSnapshot
  today:string
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [shocks,setShocks]=useState<FoodScenarioAdjustments>({...ZERO_FOOD_SCENARIO})
  const [revealed,setRevealed]=useState(0)
  const [playing,setPlaying]=useState(false)
  const [decision,setDecision]=useState<'approve'|'reject'|null>(null)
  const [session,setSession]=useState<AgentRunSession|null>(null)

  // An actual click starts this read-only rehearsal. Before that point there
  // is no agent analysis or verdict, even though the scenario inputs are ready.
  // Reference checks also suppress stale results on the first render after a
  // commodity, source, organization or scenario change.
  const result=session &&
    session.balance===balance &&
    session.operations===operations &&
    session.today===today &&
    session.shocks===shocks ? session.result : null
  const workflowComplete=result!==null && !playing && revealed>=result.steps.length
  const recommendation=useMemo(
    ()=>workflowComplete && result ? buildAgentFinalRecommendation(result) : null,
    [workflowComplete,result],
  )

  useEffect(()=>{
    setSession(null);setRevealed(0);setPlaying(false);setDecision(null)
  },[balance,operations,today])

  useEffect(()=>{
    if(!playing||!result)return
    if(revealed>=result.steps.length){setPlaying(false);return}
    const timer=setTimeout(()=>setRevealed(n=>n+1),670)
    return ()=>clearTimeout(timer)
  },[playing,revealed,result])

  const clearRun=()=>{
    setSession(null);setPlaying(false);setRevealed(0);setDecision(null)
  }
  const adjust=(key:keyof FoodScenarioAdjustments,value:number)=>{
    clearRun()
    setShocks(prev=>({...prev,[key]:value}))
  }
  const choose=(next:FoodScenarioAdjustments)=>{
    clearRun()
    setShocks({...next})
  }
  const start=()=>{
    if(!balance)return
    const simulation=simulateCommodityAgents({
      commodityId:balance.commodityId,balance,operations,today,shocks,
    })
    setSession({balance,operations,today,shocks,result:simulation})
    setDecision(null);setRevealed(0);setPlaying(true)
  }
  const complete=()=>{
    if(!result)return
    setDecision(null);setRevealed(result.steps.length);setPlaying(false)
  }

  return (
    <section id="commodity-agent-lab" className="space-y-4" aria-label={tx('Agent operations simulation','محاكاة عمليات الوكلاء')}>
      <div className="rounded-xl border border-line bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-cream-100 p-2.5"><Bot className="h-5 w-5 text-sage-700" aria-hidden="true"/></span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-sage-700">
                {tx('Multi-agent operations simulator','محاكي عمليات الوكلاء المتعددين')}
              </p>
              <h2 className="mt-1 text-[20px] font-medium text-content">
                {tx('From commodity risk to human decision','من مخاطر السلعة إلى القرار البشري')}
              </h2>
              <p className="mt-1 max-w-[75ch] text-[12px] leading-relaxed text-content-soft">
                {tx('Run a transparent, step-by-step rehearsal of NFII specialist agents. Each agent shows the data it checks, its findings and any hand-off. No AI service, database write or real purchasing is triggered.',
                  'محاكاة واضحة خطوة بخطوة لعمل وكلاء NFII المتخصصين. يظهر كل وكيل البيانات والنتيجة والتسليم للوكيل التالي. لا يُستدعى نموذج AI ولا تُنفذ عمليات شراء أو كتابة في قاعدة البيانات.')}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-3 py-1.5 text-[10px] font-semibold text-warning-strong">
            <Sparkles className="h-3 w-3" aria-hidden="true"/>
            {tx('SIMULATION · READ ONLY','محاكاة · للقراءة فقط')}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map(preset=>{
            const selected=CONTROLS.every(control=>shocks[control.key]===preset.shocks[control.key])
            return <button key={preset.id} type="button" onClick={()=>choose(preset.shocks)}
              aria-pressed={selected}
              className={'rounded-full border px-3 py-2 text-[12px] transition-colors '+
                (selected?'border-ink bg-ink text-white':'border-line bg-card text-content hover:border-line-strong')}>
              {tx(preset.en,preset.ar)}
            </button>
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONTROLS.map(control=>(
            <label key={control.key} className="rounded-lg border border-line bg-background p-3">
              <span className="flex items-start justify-between gap-2 text-[12px] text-content">
                <span>{tx(control.en,control.ar)}</span>
                <strong className="tabular-nums text-sage-700">{shocks[control.key]}%</strong>
              </span>
              <input type="range" min={0} max={100} step={5} value={shocks[control.key]}
                className="mt-3 w-full accent-sage-700"
                onChange={e=>adjust(control.key,Number(e.target.value))}
                aria-label={tx(control.en,control.ar)}/>
            </label>
          ))}
        </div>

        {workflowComplete && result && <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {en:'Baseline closing stock',ar:'المخزون الأساسي النهائي',
              value:fmt(balance?.totals.projectedClosingStockTonnes),unit:'t'},
            {en:'Scenario closing stock',ar:'المخزون النهائي في السيناريو',
              value:fmt(result.scenario.totals.scenarioClosingStockTonnes),unit:'t'},
            {en:'Scenario shortage',ar:'العجز في السيناريو',
              value:fmt(result.scenario.totals.scenarioDeficitTonnes),unit:'t'},
            {en:'Days of coverage',ar:'أيام التغطية',
              value:fmt(result.scenario.totals.scenarioCoverageDays),unit:tx('days','يوم')},
          ].map(kpi=>(
            <div key={kpi.en} className="rounded-lg border border-line bg-muted/30 p-3">
              <p className="text-[11px] text-content-soft">{tx(kpi.en,kpi.ar)}</p>
              <p className="mt-1 text-[22px] font-medium tabular-nums text-content">{kpi.value}
                <span className="ms-1 text-[11px] font-normal text-content-soft">{kpi.unit}</span></p>
            </div>
          ))}
        </div>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!balance} onClick={start}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-5 py-2 text-[12px] font-medium text-white disabled:opacity-40">
            <Play className="h-4 w-4" aria-hidden="true"/>
            {result?tx('Restart simulation','إعادة تشغيل المحاكاة'):tx('Run agent sequence','تشغيل تسلسل الوكلاء')}
          </button>
          <button type="button" disabled={!result || workflowComplete} onClick={complete}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[12px] text-content hover:bg-muted disabled:opacity-40">
            <FastForward className="h-4 w-4" aria-hidden="true"/>
            {tx('Complete active simulation','إكمال المحاكاة الجارية')}
          </button>
          <button type="button" onClick={()=>choose(ZERO_FOOD_SCENARIO)}
            className="inline-flex min-h-10 items-center gap-2 px-3 text-[12px] text-content-soft hover:text-content">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true"/>
            {tx('Reset','إعادة ضبط')}
          </button>
          {result&&<span role="status" aria-live="polite" className="ms-auto text-[11px] tabular-nums text-content-soft">
            {revealed} / {result.steps.length} {tx('stages','مراحل')}
          </span>}
        </div>
      </div>

      {recommendation && workflowComplete && (
        <CommodityAgentVerdict
          recommendation={recommendation}
          workflowComplete={workflowComplete}
          humanChoice={decision}
        />
      )}

      {workflowComplete && result && session && (
        <CommodityScenarioCharts balance={session.balance} scenario={result.scenario}/>
      )}

      {!result ? (
        <div role="status" className="rounded-lg border border-line bg-card p-4 text-[12px] text-content-soft">
          {balance
            ? tx('Ready. Choose a scenario, then press Run agent sequence. No result has been produced yet.',
                'جاهز. اختر سيناريو ثم اضغط تشغيل تسلسل الوكلاء. لم تصدر أي نتيجة بعد.')
            : tx('Select a food balance source first. No fabricated baseline is used in Live mode.',
                'اختر مصدر بيانات الميزان أولاً. لا تُستخدم بيانات مخترعة في وضع البيانات الفعلية.')}
        </div>
      ) : (
        <div className="space-y-4">
          <CommodityAgentProgress
            completed={revealed}
            total={result.steps.length}
            labels={result.steps.map(step=>tx(step.areaEn,step.areaAr))}
          />
          {!workflowComplete && (
            <div role="status" aria-live="polite" className="rounded-lg border border-line-accent bg-cream-100 p-4 text-[12px] text-content">
              <strong>{tx('Agents are processing the selected scenario', 'الوكلاء يحللون السيناريو المختار')}</strong>
              <p className="mt-1 text-content-soft">
                {tx('The final recommendation and numeric scenario results will appear only after all stages complete.',
                  'ستظهر التوصية النهائية والنتائج الرقمية فقط بعد اكتمال جميع المراحل.')}
              </p>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(285px,.85fr)]">
          <div className="min-w-0 rounded-xl border border-line bg-card p-4">
            <h3 className="flex items-center gap-2 text-[15px] font-medium text-content">
              <Bot className="h-4 w-4 text-sage-700"/>
              {tx('Agent activity log','سجل نشاط الوكلاء')}
            </h3>
            <p className="mt-1 text-[11px] text-content-soft">
              {tx('Ten operational stages, with explicit evidence and specialist hand-offs.',
                'عشر مراحل تشغيلية مع الأدلة والتسليم بين الوكلاء.')}
            </p>
            <ol className="mt-4 space-y-2">
              {result.steps.map((step,index)=>{
                const shown=index<revealed
                const active=playing&&index===revealed-1
                return <li key={step.id}
                  className={'relative rounded-lg border p-3 transition-colors '+
                    (shown?'border-line bg-background':'border-line bg-muted/20 opacity-55')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium '+
                      (shown?'bg-ink text-white':'bg-muted text-content-soft')}>{index+1}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-sage-700">
                      {tx(step.areaEn,step.areaAr)}
                    </span>
                    <span className="text-[10px] text-content-soft">· {AGENT_REGISTRY[step.agent].label}</span>
                    {shown&&<span className="ms-auto"><StepBadge step={step} ar={ar} active={active}/></span>}
                  </div>
                  <h4 className="mt-2 text-[13px] font-medium text-content">
                    {tx(step.titleEn,step.titleAr)}
                  </h4>
                  {shown?(
                    <>
                      <p className="mt-1 text-[12px] leading-relaxed text-content-soft">
                        {tx(step.findingEn,step.findingAr)}
                      </p>
                      <details className="mt-2 text-[11px] text-content-soft">
                        <summary className="cursor-pointer font-medium text-sage-700">
                          {tx('Data and evidence checked','البيانات والأدلة')}
                        </summary>
                        <ul className="mt-1 list-disc space-y-1 ps-5">
                          {step.evidence.map((item,i)=><li key={i} className="break-all">{item}</li>)}
                        </ul>
                      </details>
                    </>
                  ):<p className="mt-1 text-[11px] text-content-soft">
                    {tx('Waiting for previous specialist','بانتظار الوكيل السابق')}
                  </p>}
                  {index<result.steps.length-1&&shown&&(
                    <ChevronRight className="absolute -bottom-3 start-5 z-10 h-4 w-4 rotate-90 bg-card text-sage-700" aria-hidden="true"/>
                  )}
                </li>
              })}
            </ol>
          </div>

          <aside className="min-w-0 space-y-3">
            <div className="rounded-xl border border-line bg-card p-4">
              <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
                <ClipboardCheck className="h-4 w-4 text-sage-700"/>
                {tx('Supporting agent proposals','مقترحات الوكلاء الداعمة')}
              </h3>
              <p className="mt-1 text-[11px] text-content-soft">
                {workflowComplete
                  ? tx('Additional follow-up recommendations. The final recommendation appears above. None is executed.',
                      'توصيات متابعة إضافية. تظهر التوصية النهائية أعلاه. لم يُنفذ أي إجراء.')
                  : tx('These follow-up proposals will appear after the simulation finishes.',
                      'ستظهر مقترحات المتابعة بعد اكتمال المحاكاة.')}
              </p>
              {workflowComplete ? (
                <ul className="mt-3 space-y-2">
                  {result.proposals.map(proposal=>(
                    <li key={proposal.id} className="rounded-lg border border-line bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[12px] text-content">{tx(proposal.titleEn,proposal.titleAr)}</strong>
                        <span className="rounded-full border border-warning-line bg-warning-soft px-2 py-0.5 text-[10px] text-warning-strong">
                          {tx('Human review','مراجعة بشرية')}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-content-soft">
                        {tx(proposal.whyEn,proposal.whyAr)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-lg bg-muted p-3 text-[12px] text-content-soft">
                  {tx('Awaiting the conclusion of the active agent run.',
                    'بانتظار اكتمال تشغيل الوكلاء الحالي.')}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
                <ShieldCheck className="h-4 w-4 text-sage-700"/>
                {tx('Human authorization gate','بوابة الموافقة البشرية')}
              </h3>
              <p className="mt-2 text-[12px] text-content-soft">
                {tx('The operational workflow stops here. Buttons only rehearse the reviewer outcome locally.',
                  'يتوقف سير العمل هنا. الأزرار تحاكي قرار المراجع محلياً فقط.')}
              </p>
              {workflowComplete && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={()=>setDecision('approve')}
                    className="rounded-full border border-line-accent bg-cream-100 px-3 py-2 text-[11px] font-medium text-sage-700">
                    <Check className="me-1 inline h-3.5 w-3.5"/>{tx('Rehearse approval','محاكاة الموافقة')}
                  </button>
                  <button type="button" onClick={()=>setDecision('reject')}
                    className="rounded-full border border-line-strong bg-card px-3 py-2 text-[11px] text-content">
                    {tx('Rehearse rejection','محاكاة الرفض')}
                  </button>
                </div>
              )}
              <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-muted p-3 text-[11px] text-content-soft">
                {decision===null
                  ?tx('Awaiting simulated human decision. No actual approval exists.',
                    'في انتظار القرار البشري في المحاكاة؛ لا توجد موافقة فعلية.')
                  :decision==='approve'
                    ?tx('Approval rehearsed locally. NO contract, purchase or reserve release was created.',
                      'تمت محاكاة الموافقة محلياً. لم يُنشأ أي عقد أو شراء أو صرف مخزون.')
                    :tx('Rejection rehearsed locally. No database or external state changed.',
                      'تمت محاكاة الرفض محلياً دون تغيير بيانات أو أنظمة خارجية.')}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card p-4">
              <h3 className="text-[13px] font-medium text-content">{tx('Simulation boundaries','حدود المحاكاة')}</h3>
              <ul className="mt-2 list-disc space-y-2 ps-4 text-[11px] leading-relaxed text-content-soft">
                {result.caveats.map(item=><li key={item}>{item}</li>)}
              </ul>
              <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-sage-700">
                {tx('No automatic execution', 'لا تنفيذ تلقائي')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true"/>
              </p>
            </div>
          </aside>
          </div>
        </div>
      )}
    </section>
  )
}
