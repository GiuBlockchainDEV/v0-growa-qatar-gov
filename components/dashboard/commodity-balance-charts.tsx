'use client'

import {useId} from 'react'
import {useI18n} from '@/lib/i18n'
import type {FoodBalanceResult} from '@/lib/food-security/balance'
import {buildBalanceChartModel,type BalanceChartModel} from '@/lib/nfii/commodity-charts'

const money=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1})

function StackedQuantityBar({
  segments,max,description,
}:{
  segments:readonly {name:string;value:number;fill:string}[]
  max:number
  description:string
}){
  return <svg role="img" aria-label={description}
    className="block h-9 w-full overflow-visible"
    viewBox="0 0 100 18" preserveAspectRatio="none">
    <rect x="0" y="1" width="100" height="16" rx="3"
      fill="var(--growa-stone-100)"/>
    {segments.map((seg,index)=>{
      const width=max<=0?0:Math.max(0,seg.value/max*100)
      const current=segments.slice(0,index)
        .reduce((sum,previous)=>sum+(max<=0?0:Math.max(0,previous.value/max*100)),0)
      return width>0?(
        <rect key={seg.name} x={current} y="1" width={width} height="16"
          fill={seg.fill}>
          <title>{seg.name}: {money(seg.value)} t</title>
        </rect>
      ):null
    })}
  </svg>
}

function Legend({items}:{items:readonly {name:string;fill:string}[]}){
  return <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
    {items.map(item=>(
      <span key={item.name} className="inline-flex items-center gap-1.5 text-[11px] text-content-soft">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{backgroundColor:item.fill}}/>
        {item.name}
      </span>
    ))}
  </div>
}

function SupplyDemandChart({model}:{model:BalanceChartModel}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const supply=[
    {name:tx('Opening stock','المخزون الافتتاحي'),
      value:model.inflows[0],fill:'var(--growa-ink)'},
    {name:tx('Local production','الإنتاج المحلي'),
      value:model.inflows[1],fill:'var(--growa-sage)'},
    {name:tx('Imports','الواردات'),value:model.inflows[2],
      fill:'var(--growa-cream-300)'},
  ] as const
  const outflows=[
    {name:tx('Consumption','الاستهلاك'),value:model.outflows[0],
      fill:'var(--growa-stone-600)'},
    {name:tx('Losses','الفاقد'),value:model.outflows[1],
      fill:'var(--status-critical)'},
  ] as const
  return <div className="rounded-xl border border-line bg-card p-4 md:p-5">
    <h3 className="text-[15px] font-medium text-content">
      {tx('What is available versus what is needed','الإمدادات المتاحة مقارنة بالاحتياجات')}
    </h3>
    <p className="mt-1 text-[11px] leading-relaxed text-content-soft">
      {tx('All quantities cover the selected period. Both bars use the same tonne scale.',
        'جميع الكميات تخص الفترة المختارة. يستخدم الشريطان المقياس نفسه بالطن.')}
    </p>
    <div className="mt-5 space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-medium text-content">
            {tx('Available: stock + production + imports','المتاح: المخزون + الإنتاج + الواردات')}
          </span>
          <span className="shrink-0 text-[14px] font-medium tabular-nums text-content">
            {money(model.availableTonnes)} t
          </span>
        </div>
        <StackedQuantityBar segments={supply} max={model.maxTonnes}
          description={tx('Available tonnes split between opening stock, local production and imports',
            'تقسيم الكمية المتاحة بين المخزون والإنتاج المحلي والواردات')}/>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[12px] font-medium text-content">
            {tx('Required: consumption + losses','المطلوب: الاستهلاك + الفاقد')}
          </span>
          <span className="shrink-0 text-[14px] font-medium tabular-nums text-content">
            {money(model.requiredTonnes)} t
          </span>
        </div>
        <StackedQuantityBar segments={outflows} max={model.maxTonnes}
          description={tx('Required tonnes split between consumption and losses',
            'تقسيم الكمية المطلوبة بين الاستهلاك والفاقد')}/>
      </div>
    </div>
    <Legend items={[...supply,...outflows]}/>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <p className="text-[11px] text-content-soft">
        {tx('End-of-period usable stock','المخزون المتاح بنهاية الفترة')}
      </p>
      <strong className="text-[18px] font-medium tabular-nums text-content">
        {money(model.closingTonnes)} t
      </strong>
    </div>
    {model.deficitTonnes>0&&<p className="mt-1 text-[11px] text-critical">
      {tx('Unmet requirement (modeled deficit): ','العجز الافتراضي: ')}
      {money(model.deficitTonnes)} t
    </p>}
  </div>
}

const STEP_COLORS:Record<BalanceChartModel['bridge'][number]['key'],string>={
  opening:'var(--growa-ink)',
  domestic:'var(--growa-sage)',
  imports:'var(--growa-sage-400)',
  consumption:'var(--growa-stone-600)',
  losses:'var(--status-critical)',
  net:'var(--growa-ink)',
}

/** A waterfall, NOT a daily stock curve. Net can be below zero. */
function BalanceBridgeChart({model}:{model:BalanceChartModel}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const unique=useId()
  const names=[
    tx('Opening','الافتتاحي'),tx('Production','الإنتاج'),
    tx('Imports','الواردات'),tx('Demand','الاستهلاك'),
    tx('Losses','الفاقد'),tx('Net','الصافي'),
  ] as const
  const height=192
  const top=18
  const bottom=16
  const left=18
  const span=Math.max(1,model.maxBridge-model.minBridge)
  const y=(value:number)=>top+(model.maxBridge-value)/span*(height-top-bottom)
  const zeroY=y(0)
  const xs=model.bridge.map((_,index)=>left+index*106)
  const w=56
  return <div className="rounded-xl border border-line bg-card p-4 md:p-5">
    <h3 className="text-[15px] font-medium text-content">
      {tx('How the food balance changes','كيف يتغير الميزان الغذائي')}
    </h3>
    <p className="mt-1 text-[11px] leading-relaxed text-content-soft">
      {tx('Waterfall by accounting component, not a daily inventory forecast.',
        'تسلسل مكونات الميزان المحاسبية وليس توقعاً يومياً للمخزون.')}
    </p>
    <div className="mt-3 overflow-x-auto">
    <div className="min-w-[520px]">
    <svg className="w-full" viewBox="0 0 664 192" role="img"
      aria-labelledby={unique+'-title '+unique+'-desc'}>
      <title id={unique+'-title'}>
        {tx('Food balance waterfall chart','مخطط شلال الميزان الغذائي')}
      </title>
      <desc id={unique+'-desc'}>
        {tx('Opening stock plus production and imports, minus consumption and losses, equals net balance.',
          'المخزون الافتتاحي مع الإنتاج والواردات ناقص الاستهلاك والفاقد يساوي الرصيد الصافي.')}
      </desc>
      <line x1="5" x2="657" y1={zeroY} y2={zeroY}
        stroke="var(--growa-stone-500)" strokeWidth="1" strokeDasharray="4 3"/>
      {model.bridge.map((step,index)=>{
        const yy=Math.min(y(step.start),y(step.end))
        const bh=Math.max(2,Math.abs(y(step.start)-y(step.end)))
        const fill=step.key==='net'&&step.end<0?
          'var(--status-critical)':STEP_COLORS[step.key]
        return <g key={step.key}>
          {index>0&&index<5&&<line
            x1={xs[index-1]+w} x2={xs[index]}
            y1={y(step.start)} y2={y(step.start)}
            stroke="var(--growa-stone-500)" strokeDasharray="3 3"/>}
          <rect x={xs[index]} y={yy} width={w} height={bh}
            rx="3" fill={fill}>
            <title>{names[index]}: {money(step.amount)} t</title>
          </rect>
        </g>
      })}
    </svg>
    <div className="grid grid-cols-6 gap-1 border-t border-line pt-2">
      {model.bridge.map((step,index)=>(
        <div key={step.key} className="min-w-0 text-center">
          <p className="truncate text-[10px] text-content-soft" title={names[index]}>
            {names[index]}
          </p>
          <p className={'mt-1 text-[11px] font-medium tabular-nums '+
            (step.key==='net'&&step.end<0?'text-critical':'text-content')}>
            {step.amount>0&&index>0&&index<3?'+':''}{money(step.amount)}
          </p>
        </div>
      ))}
    </div>
    </div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-content-soft">
      {tx('The last column is net stock (which may be negative), not physical inventory. Any negative balance is reported separately as unmet demand.',
        'العمود الأخير هو الرصيد الصافي وقد يكون سالباً، وليس المخزون الفعلي. يُعرض العجز بشكل منفصل.')}
    </p>
  </div>
}

export function CommodityBalanceCharts({balance}:{balance:FoodBalanceResult|null}){
  const {locale}=useI18n()
  const model=buildBalanceChartModel(balance)
  if(!model)return <div className="rounded-xl border border-line bg-card p-4 text-[12px] text-content-soft">
    {locale==='ar'
      ? 'لا يمكن إنشاء رسوم بيانية موثوقة قبل اكتمال بيانات المخزون وتدفقات السلعة.'
      : 'A complete opening stock and all commodity flows are required before charting this balance. Missing values are not zero.'}
  </div>
  return <section aria-label={locale==='ar'?'رسوم الميزان الغذائي':'Food balance charts'}
    className="grid gap-4 xl:grid-cols-2">
    <SupplyDemandChart model={model}/>
    <BalanceBridgeChart model={model}/>
  </section>
}
