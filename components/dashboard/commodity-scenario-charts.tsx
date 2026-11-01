'use client'

import {useI18n} from '@/lib/i18n'
import type {FoodBalanceResult} from '@/lib/food-security/balance'
import type {FoodScenarioImpact} from '@/lib/food-security/scenario'
import {agentProgressPercent,buildScenarioChartModel} from '@/lib/nfii/commodity-charts'

const fmt=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1})

function NetPositionBar({
  value,max,fill,label,
}:{
  value:number;max:number;fill:string;label:string
}){
  const width=50*Math.abs(value)/max
  const x=value<0?50-width:50
  return <svg viewBox="0 0 100 16" preserveAspectRatio="none"
    role="img" aria-label={label} className="block h-8 w-full">
    <rect x="0" y="1" width="100" height="14" rx="3"
      fill="var(--growa-stone-100)"/>
    {width>0&&<rect x={x} y="1" width={width} height="14"
      rx="2" fill={fill}/>}
    <line x1="50" y1="0" x2="50" y2="16"
      stroke="var(--growa-ink)" strokeWidth=".5"/>
  </svg>
}

function CoverageBar({days,max,label,fill}:{
  days:number|null;max:number;label:string;fill:string
}){
  if(days===null)return <p className="text-[11px] text-content-soft">
    {label}: —
  </p>
  const percentage=Math.max(0,Math.min(100,days/max*100))
  return <div>
    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
      <span className="text-content-soft">{label}</span>
      <strong className="font-medium tabular-nums text-content">{fmt(days)} d</strong>
    </div>
    <div className="relative h-4 overflow-hidden rounded-full bg-muted"
      style={{direction:'ltr'}}
      role="img" aria-label={label+': '+fmt(days)+' days'}>
      <div className="absolute inset-y-0 left-0 rounded-full"
        style={{width:percentage+'%',backgroundColor:fill}}/>
      <div className="absolute inset-y-0 border-s border-dashed border-content/55"
        style={{left:Math.min(100,30/max*100)+'%'}} aria-hidden="true"/>
    </div>
  </div>
}

/**
 * Rendering of scenario effects is deliberately gated by its parent.
 * These comparisons must NEVER be mounted before an explicit run completes.
 */
export function CommodityScenarioCharts({
  balance,scenario,
}:{
  balance:FoodBalanceResult
  scenario:FoodScenarioImpact
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const model=buildScenarioChartModel(scenario,balance)
  if(!model)return <div className="rounded-xl border border-line bg-card p-4 text-[12px] text-content-soft">
    {tx('Complete commodity balance inputs are needed for a scenario comparison.',
      'يتطلب الرسم بيانات مكتملة للميزان الغذائي.')}
  </div>

  const comparison=[
    {en:'Baseline',ar:'الوضع الأساسي',value:model.baselineNetTonnes,
      fill:'var(--growa-sage)'},
    {en:'After selected disruption',ar:'بعد الاضطراب المختار',
      value:model.scenarioNetTonnes,fill:model.scenarioNetTonnes<0?
        'var(--status-critical)':'var(--growa-ink)'},
  ]
  return <section aria-label={tx('Agent simulation outcome charts','رسوم نتائج محاكاة الوكلاء')}
    className="grid gap-4 xl:grid-cols-2">
    <div className="rounded-xl border border-line bg-card p-4 md:p-5">
      <h3 className="text-[15px] font-medium text-content">
        {tx('Net food balance: baseline vs disruption','الرصيد الغذائي: الأساس مقابل الاضطراب')}
      </h3>
      <p className="mt-1 text-[11px] text-content-soft">
        {tx('Period-end net tonnes; the centre line is zero. Left of zero means a modeled deficit.',
          'صافي الأطنان بنهاية الفترة. الخط الأوسط يساوي الصفر؛ اليسار يشير إلى عجز افتراضي.')}
      </p>
      <div className="mt-5 space-y-5">
        {comparison.map(row=>(
          <div key={row.en}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[12px] text-content-soft">{tx(row.en,row.ar)}</span>
              <strong className={'text-[13px] font-medium tabular-nums '+
                (row.value<0?'text-critical':'text-content')}>
                {fmt(row.value)} t
              </strong>
            </div>
            <NetPositionBar value={row.value} max={model.maxAbsNetTonnes}
              fill={row.fill}
              label={tx(row.en,row.ar)+': '+fmt(row.value)+' t'}/>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-content-soft">
        <span>−{fmt(model.maxAbsNetTonnes)} t</span>
        <span>0</span>
        <span>+{fmt(model.maxAbsNetTonnes)} t</span>
      </div>
      {model.scenarioDeficitTonnes>0&&<p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[11px] text-critical">
        {tx('Modeled shortfall to investigate: ','عجز افتراضي للتحقق: ')}
        <strong>{fmt(model.scenarioDeficitTonnes)} t</strong>
        {tx('. Not an approved procurement quantity.','. ليست كمية شراء معتمدة.')}
      </p>}
    </div>

    <div className="rounded-xl border border-line bg-card p-4 md:p-5">
      <h3 className="text-[15px] font-medium text-content">
        {tx('How stock coverage changes','كيف تتغير تغطية المخزون')}
      </h3>
      <p className="mt-1 text-[11px] text-content-soft">
        {tx('End-of-period remaining stock divided by average daily demand.',
          'مخزون نهاية الفترة مقسوماً على متوسط الاستهلاك اليومي.')}
      </p>
      <div className="mt-5 space-y-5">
        <CoverageBar days={model.baselineCoverageDays} max={model.coverageAxisDays}
          label={tx('Before disruption','قبل الاضطراب')}
          fill="var(--growa-sage)"/>
        <CoverageBar days={model.scenarioCoverageDays} max={model.coverageAxisDays}
          label={tx('After disruption','بعد الاضطراب')}
          fill={model.scenarioDeficitTonnes>0?'var(--status-critical)':'var(--growa-ink)'}/>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-content-soft">
        <span>0 d</span>
        <span>{fmt(model.coverageAxisDays)} d</span>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-content-soft">
        {tx('Dashed marker: illustrative 30-day review reference, NOT an official Qatar reserve policy. These are scenario comparisons, not forecasts of the exact stock-out date.',
          'العلامة المتقطعة مرجع إرشادي لمراجعة 30 يوماً وليست سياسة مخزون رسمية في قطر. هذه مقارنة سيناريوهات وليست توقعاً ليوم نفاد المخزون.')}
      </p>
    </div>
  </section>
}

/** Progress-only chart: safe to display while agents are running. */
export function CommodityAgentProgress({
  completed,total,labels,
}:{
  completed:number
  total:number
  labels:readonly string[]
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const percent=agentProgressPercent(completed,total)
  const capped=Math.max(0,Math.min(total,completed))
  return <section className="rounded-xl border border-line bg-card p-4"
    aria-label={tx('Agent run progress','تقدم تشغيل الوكلاء')}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-[13px] font-medium text-content">
          {tx('Agent workflow progress','تقدم سير عمل الوكلاء')}
        </h3>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('Completed specialist stages; the outcome appears only at 100%.',
            'المراحل المتخصصة المكتملة؛ تظهر النتيجة فقط عند بلوغ 100٪.')}
        </p>
      </div>
      <div className="text-end">
        <p className="text-[20px] font-medium tabular-nums text-content">{percent}%</p>
        <p className="text-[10px] text-content-soft">{capped}/{total}</p>
      </div>
    </div>
    <div className="mt-3 grid gap-1"
      style={{gridTemplateColumns:'repeat('+Math.max(1,total)+', minmax(0, 1fr))'}}
      role="progressbar" aria-valuemin={0} aria-valuemax={total}
      aria-valuenow={capped}
      aria-label={tx('Agent stages completed','مراحل الوكلاء المكتملة')}>
      {Array.from({length:total},(_,i)=>(
        <div key={i} className={'h-4 rounded-[3px] transition-colors '+
          (i<completed?'bg-sage-700':i===completed?'bg-cream-300':'bg-muted')}
          title={(labels[i]??tx('Agent stage','مرحلة وكيل'))+
            (i<completed?tx(' completed',' مكتملة'):tx(' pending',' قيد الانتظار'))}
          aria-hidden="true"/>
      ))}
    </div>
  </section>
}
