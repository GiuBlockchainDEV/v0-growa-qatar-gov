'use client'

import {useEffect,useMemo,useState} from 'react'
import {
 AlertTriangle,ArrowUpRight,BarChart3,CheckCircle2,
 ChevronDown,Database,Factory,Globe2,PackageCheck,RefreshCw,
 ShieldAlert,ShieldCheck,SlidersHorizontal,Sparkles,Truck,
} from 'lucide-react'
import {
 USD_QAR_REFERENCE,FERTILIZER_PRODUCTS,DEFAULT_FERTILIZER_STRESS,
 WORLD_BANK_FERTILIZER_SOURCE,QATAR_FERTILIZER_TRADE_SOURCE,
 assessFertilizerStock,averageFertilizerBenchmark,fertilizerMarketPressure,
 fertilizerPriceChange,latestFertilizerPrice,modeledDeliveredPrice,
 shortTermRecommendations,emptyStock,
 type FertilizerHorizon,type FertilizerId,type FertilizerPrice,
 type FertilizerSnapshot,type FertilizerStock,
 type FertilizerStress,type FertilizerRisk,
} from '@/lib/analytics/qatar-fertilizer'
const money=(v:number|null|undefined,decimals=0)=>
 v===null||v===undefined||!Number.isFinite(v)?'N/A':
 v.toLocaleString('en-US',{maximumFractionDigits:decimals})
const compact=(v:number|null|undefined)=>
 v===null||v===undefined||!Number.isFinite(v)?'N/A':
 Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v)
const signed=(v:number|null)=>
 v===null?'N/A':(v>0?'+':'')+v.toFixed(1)+'%'
const tone=(r:FertilizerRisk)=>r==='high'?
 'text-[#a74435] bg-[#fff3ee] border-[#ebc8be]':
 r==='watch'?'text-[#89620a] bg-[#fff8e9] border-[#ebdbb4]':
 r==='normal'?'text-[#2d7650] bg-[#eff8f2] border-[#c8dfcf]':
 'text-content-soft bg-background border-line'
const horizons:[FertilizerHorizon,string,string][]=[
 [30,'SHORT-TERM','30 DAYS'],[90,'MID-TERM','90 DAYS'],[365,'LONG-TERM','12 MONTHS'],
]
const parseInput=(value:string):number|null=>{
 if(!value.trim())return null
 const parsed=Number(value)
 return Number.isFinite(parsed)&&parsed>=0?parsed:null
}
function PriceHistory({prices,label}:{prices:FertilizerPrice[];label:string}){
 if(prices.length<2)return <div className="grid min-h-[260px] place-items-center rounded-xl border border-dashed border-line text-center text-xs text-content-soft">
  No comparable historical benchmark for this grade. Enter a supplier quotation.
 </div>
 const selected=prices.at(-1)!
 const w=780,h=276,left=50,right=758,top=22,bottom=226
 const low=Math.min(...prices.map(x=>x.usdPerTonne)),high=Math.max(...prices.map(x=>x.usdPerTonne))
 const min=Math.max(0,low-(high-low)*.12),max=high+(high-low)*.12
 const x=(i:number)=>left+i/Math.max(1,prices.length-1)*(right-left)
 const y=(v:number)=>bottom-(v-min)/Math.max(1,max-min)*(bottom-top)
 const coordinates=prices.map((p,i)=>[x(i),y(p.usdPerTonne)])
 const poly=coordinates.map(([a,b])=>a+','+b).join(' ')
 const area=poly+' '+right+','+bottom+' '+left+','+bottom
 return <div>
  <div className="flex items-end justify-between gap-3">
   <div><div className="text-[10px] font-bold tracking-[.12em] text-content-soft">WORLD BANK REFERENCE PRICE</div>
    <div className="mt-1 flex items-baseline gap-2"><strong className="text-3xl tabular-nums">{money(selected.usdPerTonne,1)}</strong>
     <span className="text-xs text-content-soft">USD / tonne</span></div>
    <div className="mt-1 text-xs text-content-soft">{label} · {selected.month} · price at source basis, not Qatar landed quotation</div>
   </div>
   <div className="text-right">
    <span className="text-[10px] font-semibold text-content-soft">INDICATIVE QAR / T</span>
    <strong className="block text-xl tabular-nums">{money(selected.usdPerTonne*USD_QAR_REFERENCE)}</strong>
    <span className="text-[10px] text-content-soft">FX conversion only, excludes freight</span>
   </div>
  </div>
  <svg viewBox={'0 0 '+w+' '+h} role="img" aria-label={'Published monthly '+label+' benchmark price trend'}
   className="mt-2 h-auto w-full overflow-visible">
   <defs><linearGradient id={'fert-area-'+label.toLowerCase().replace(/[^a-z]/g,'')} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#749b84" stopOpacity=".24"/><stop offset="100%" stopColor="#749b84" stopOpacity=".015"/>
   </linearGradient></defs>
   {[0,.25,.5,.75,1].map(f=><g key={f}>
    <line x1={left} x2={right} y1={top+f*(bottom-top)} y2={top+f*(bottom-top)}
     stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5"/>
    <text x={left-8} y={top+f*(bottom-top)+4} fontSize="11" fill="currentColor" textAnchor="end" opacity=".7">
     {money(max-f*(max-min))}</text>
   </g>)}
   <polygon points={area} fill={'url(#fert-area-'+label.toLowerCase().replace(/[^a-z]/g,'')+')'}/>
   <polyline points={poly} fill="none" stroke="#497f69" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
   {prices.map((p,i)=><g key={p.month}>
    <circle cx={x(i)} cy={y(p.usdPerTonne)} r={i===prices.length-1?5:3}
     fill={i===prices.length-1?'#244d3d':'#749b84'} stroke="#f7faf7" strokeWidth="1">
     <title>{p.month} · USD {money(p.usdPerTonne,1)}/t</title></circle>
    {(i===0||i===prices.length-1||i===5)&&<text x={x(i)} y={h-13} fontSize="11"
      fill="currentColor" textAnchor={i===0?'start':i===prices.length-1?'end':'middle'} opacity=".75">{p.month}</text>}
   </g>)}
  </svg>
 </div>
}
function Metric({eyebrow,value,note,icon:Icon}:{
 eyebrow:string;value:string;note:string;icon:typeof BarChart3
}){
 return <div className="min-w-0 rounded-xl border border-line bg-card p-4">
  <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-content-soft">
   {eyebrow}<Icon size={15}/></div>
  <strong className="mt-3 block text-2xl tabular-nums">{value}</strong>
  <p className="mt-2 text-[10px] leading-5 text-content-soft">{note}</p>
 </div>
}
function NumberInput({label,value,onChange,unit,placeholder}:{
 label:string;value:string;onChange:(value:string)=>void;unit:string;placeholder:string
}){
 return <label className="block min-w-0"><span className="block text-[10px] font-bold tracking-wide text-content-soft">{label}</span>
  <div className="mt-1 flex overflow-hidden rounded-lg border border-line bg-background">
   <input inputMode="decimal" type="number" min="0" step="any"
    value={value} onChange={event=>onChange(event.target.value)}
    placeholder={placeholder} className="w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-sage-700"/>
   <span className="flex items-center border-l border-line px-2 text-[10px] text-content-soft">{unit}</span>
  </div>
 </label>
}
const loadStock=(form:{stock:string;use:string;inbound:string;lead:string;confirmed:boolean}):FertilizerStock=>({
 stockTonnes:parseInput(form.stock),weeklyUseTonnes:parseInput(form.use),
 inboundTonnes:parseInput(form.inbound),leadDays:parseInput(form.lead),confirmed:form.confirmed,
})
export function FertilizerIntelligence(){
 const [snapshot,setSnapshot]=useState<FertilizerSnapshot|null>(null)
 const [fetchError,setFetchError]=useState('')
 const [loading,setLoading]=useState(true)
 const [reload,setReload]=useState(0)
 const [selectedId,setSelectedId]=useState<FertilizerId>('urea')
 const [horizon,setHorizon]=useState<FertilizerHorizon>(90)
 const [stress,setStress]=useState<FertilizerStress>(DEFAULT_FERTILIZER_STRESS)
 const [form,setForm]=useState({stock:'',use:'',inbound:'',lead:'',confirmed:false})
 const [currency,setCurrency]=useState<'USD'|'QAR'>('USD')
 const [expanded,setExpanded]=useState(false)

 useEffect(()=>{
  const controller=new AbortController();let active=true
  setLoading(true);setFetchError('')
  void (async()=>{
   try{
    const response=await fetch('/api/analytics/qatar-fertilizers',{
     cache:'no-store',signal:controller.signal,
    })
    if(!response.ok)throw Error('Fertilizer data HTTP '+response.status)
    const result=await response.json() as FertilizerSnapshot
    if(result.scope!=='qatar-national-fertilizers'||!Array.isArray(result.benchmarks))
     throw Error('Invalid fertilizer source response')
    if(active)setSnapshot(result)
   }catch(error){
    if(active&&!controller.signal.aborted)setFetchError(error instanceof Error?error.message:'Unavailable')
   }finally{if(active)setLoading(false)}
  })()
  return()=>{active=false;controller.abort()}
 },[reload])
 const products=snapshot?.benchmarks??FERTILIZER_PRODUCTS
 const selected=products.find(p=>p.id===selectedId)??products[0]
 const stock=useMemo(()=>loadStock(form),[form])
 const assessed=useMemo(()=>horizons.map(([days,name])=>({
  days,name,
  result:assessFertilizerStock(stock,days,stress),
  market:fertilizerMarketPressure(selected,stress,days),
 })),[stock,stress,selected])
 const focused=assessed.find(a=>a.days===horizon)??assessed[1]
 const actions=useMemo(()=>shortTermRecommendations(selected,stock,stress),[selected,stock,stress])
 const trade=snapshot?.trade.at(-1)??null
 const average=averageFertilizerBenchmark(products)
 const current=latestFertilizerPrice(selected)
 const latestChange=fertilizerPriceChange(selected)
 const delivered=modeledDeliveredPrice(selected,stress)
 const conversion=currency==='QAR'?USD_QAR_REFERENCE:1
 const setNumber=(key:'stock'|'use'|'inbound'|'lead',value:string)=>
  setForm(prev=>({...prev,[key]:value}))
 return <section className="overflow-hidden rounded-2xl border border-line bg-card text-content" aria-label="Fertilizer supply intelligence">
  <div className="relative overflow-hidden border-b border-line bg-[linear-gradient(116deg,#133d35_0%,#1e514a_57%,#45664d_100%)] p-5 text-white md:p-7">
   <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full border border-white/10"/>
   <div className="pointer-events-none absolute -right-8 -top-10 size-60 rounded-full border border-white/10"/>
   <div className="relative flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-2xl">
     <span className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-white/65"><Globe2 size={15}/> QATAR NATIONAL AGRICULTURAL INPUTS</span>
     <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
      Fertilizer <span className="text-[#b9e4c0]">Intelligence</span>
     </h2>
     <p className="mt-2 max-w-xl text-xs leading-6 text-white/75">
      Global commodity price intelligence, Qatar production and trade context, supply availability evidence, and 30/90/365-day decision scenarios.
     </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <span className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-[10px] font-semibold tracking-wide">WORLD BANK · OCT 2026</span>
     <button type="button" onClick={()=>setReload(v=>v+1)} aria-label="Refresh fertilizer trade sources"
      className="rounded-lg border border-white/25 p-2 text-white hover:bg-white/15"><RefreshCw size={16}/></button>
    </div>
   </div>
   <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-4 text-[10px] text-white/75">
    <span className="flex items-center gap-2"><CheckCircle2 size={13}/> Verified monthly benchmark references</span>
    <span className="flex items-center gap-2"><Database size={13}/> Qatar annual trade records</span>
    <span className="flex items-center gap-2"><AlertTriangle size={13}/> Physical inventory unverified until entered</span>
   </div>
  </div>

  <div className="space-y-5 p-4 md:p-6">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Metric eyebrow="Average benchmark" value={average===null?'N/A':'$'+money(average,1)+'/t'}
     note="Arithmetic mean of urea, DAP and potash reference series. Not an average local selling price." icon={BarChart3}/>
    <Metric eyebrow="QAFCO urea design capacity"
     value={snapshot?compact(snapshot.production.capacityTonnesPerYear)+' t/y':'5.6M t/y'}
     note="Nominal national production capacity, not the current operating rate or available stock." icon={Factory}/>
    <Metric eyebrow="Qatar annual imports"
     value={trade?.importsQar!==null&&trade?.importsQar!==undefined?compact(trade.importsQar)+' QAR':'N/A'}
     note={trade?'Published '+trade.year+' trade value (not tonnes).':'Official annual fertilizer import value pending.'} icon={Globe2}/>
    <Metric eyebrow="On-hand availability" value={stock.stockTonnes===null?'UNVERIFIED':money(stock.stockTonnes,1)+' t'}
     note="User-entered scenario inventory only. No verified countrywide fertilizer stock feed." icon={PackageCheck}/>
   </div>

   {loading&&<p className="text-[11px] text-content-soft">Refreshing official Qatar fertilizer trade records…</p>}
   {fetchError&&<div role="alert" className="rounded-xl border border-[#ecc8b8] bg-[#fff7f3] p-3 text-xs text-[#895242]">
    Official Qatar trade endpoint unavailable: {fetchError}. The commodity benchmark display uses the clearly dated static World Bank reference series.
   </div>}

   <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.8fr)]">
    <article className="min-w-0 rounded-xl border border-line bg-background p-4 md:p-5">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><span className="text-[10px] font-bold tracking-wider text-content-soft">FERTILIZER MARKET TERMINAL</span>
       <h3 className="mt-1 text-lg font-semibold">Reference price discovery</h3></div>
      <div className="flex rounded-lg border border-line p-1 text-xs">
       {(['USD','QAR'] as const).map(cur=><button type="button" key={cur} onClick={()=>setCurrency(cur)}
        aria-pressed={currency===cur}
        className={'rounded-md px-3 py-1.5 '+(currency===cur?'bg-ink text-white':'text-content-soft')}>{cur}</button>)}
      </div>
     </div>
     <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {products.map(p=>{
       const latest=latestFertilizerPrice(p),change=fertilizerPriceChange(p,1)
       return <button type="button" key={p.id} onClick={()=>{setSelectedId(p.id);setForm({stock:'',use:'',inbound:'',lead:'',confirmed:false})}}
        aria-pressed={selectedId===p.id}
        className={'min-w-0 rounded-lg border p-3 text-left transition-all '+(selectedId===p.id?
         'border-[#648c76] bg-[#e9f4ed] ring-1 ring-[#648c76]':'border-line bg-card hover:bg-muted')}>
        <strong className="block truncate text-xs">{p.name}</strong>
        <span className="mt-1 block truncate text-[9px] text-content-soft">{p.formula}</span>
        <strong className="mt-3 block text-base tabular-nums">{latest?money(latest.usdPerTonne*conversion,0):'N/A'}</strong>
        <span className="mt-1 block text-[10px] text-content-soft">{currency}/t {latest&&change!==null?'· '+signed(change):''}</span>
       </button>
      })}
     </div>
     <div className="mt-5">
      <PriceHistory key={selected.id} prices={selected.prices} label={selected.name}/>
     </div>
     <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] text-content-soft">
      <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-sage-700 underline underline-offset-2">
       World Bank Pink Sheet <ArrowUpRight size={11}/></a>
      <span>{selected.basis}</span>
     </div>
    </article>

    <article className="rounded-xl border border-line bg-background p-4 md:p-5">
     <div className="flex items-center justify-between gap-2">
      <div><span className="text-[10px] font-bold tracking-wider text-content-soft">FORWARD RISK RADAR</span>
       <h3 className="mt-1 text-lg font-semibold">Supply exposure</h3></div>
      <ShieldAlert className="text-content-soft" size={22}/>
     </div>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">
      Transparent rules-based screening, not a forecast probability. Switch time horizons to inspect price, transport and stock conditions.
     </p>
     <div className="mt-4 grid grid-cols-3 gap-2">
      {assessed.map(({days,name,result,market})=><button type="button" key={days}
       onClick={()=>setHorizon(days)} aria-pressed={horizon===days}
       className={'rounded-xl border p-3 text-center '+(horizon===days?'border-[#547b63] bg-[#e9f4ed]':'border-line bg-card')}>
       <span className="block text-[9px] font-bold text-content-soft">{name}</span>
       <span className="mt-1 block text-xl font-bold tabular-nums">{market.score}<small className="text-xs font-normal">/100</small></span>
       <span className={'mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold uppercase '+tone(market.risk)}>
        {market.risk}</span>
      </button>)}
     </div>
     <div className="mt-4 rounded-xl border border-line bg-card p-4">
      <div className="flex justify-between gap-3">
       <div className="text-[10px] font-bold text-content-soft">MARKET STRESS INDEX · {horizon} DAYS</div>
       <span className="text-[11px] font-bold tabular-nums">{focused.market.score}/100</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#dde5dc]">
       <div className="h-full rounded-full bg-[linear-gradient(to_right,#548b6d,#d4a642,#c05b45)]"
        style={{width:focused.market.score+'%'}}/>
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-content-soft"><span>Normal</span><span>Watch</span><span>High</span></div>
      <div className="mt-4 space-y-2">
       {focused.market.drivers.map((driver,i)=><div key={i} className="flex items-start gap-2 text-[11px]">
        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#c78c45]"/>{driver}</div>)}
      </div>
     </div>
     <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-line bg-card p-3">
       <div className="text-[10px] text-content-soft">MODELED PRICE AFTER SHOCK</div>
       <strong className="mt-1 block text-lg tabular-nums">{delivered===null?'N/A':'$'+money(delivered,1)}</strong>
       <div className="text-[9px] text-content-soft">USD/t · benchmark, not a quote</div>
      </div>
      <div className="rounded-lg border border-line bg-card p-3">
       <div className="text-[10px] text-content-soft">STOCK COVERAGE</div>
       <strong className="mt-1 block text-lg tabular-nums">{focused.result.coverageDays===null?'N/A':money(focused.result.coverageDays,0)+' d'}</strong>
       <div className="text-[9px] text-content-soft">Only based on entered inventory</div>
      </div>
     </div>
    </article>
   </div>

   <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <article className="rounded-xl border border-line bg-card p-4 md:p-5">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><SlidersHorizontal className="text-sage-700" size={19}/>
       <h3 className="text-base font-semibold">Supply continuity laboratory</h3></div>
      <button type="button" onClick={()=>{setForm({stock:'',use:'',inbound:'',lead:'',confirmed:false});setStress(DEFAULT_FERTILIZER_STRESS)}}
       className="text-[11px] font-semibold text-sage-700 underline">Reset model</button>
     </div>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">
      Enter your own verified inventory and consumption. Changes affect scenario mathematics only; nothing is written to national datasets or supplier records.
     </p>
     <div className="mt-4 grid grid-cols-2 gap-3">
      <NumberInput label="STOCK ON HAND" value={form.stock} onChange={v=>setNumber('stock',v)} unit="t" placeholder="Unknown"/>
      <NumberInput label="WEEKLY CONSUMPTION" value={form.use} onChange={v=>setNumber('use',v)} unit="t/w" placeholder="Unknown"/>
      <NumberInput label="CONFIRMED INBOUND" value={form.inbound} onChange={v=>setNumber('inbound',v)} unit="t" placeholder="Unknown"/>
      <NumberInput label="SUPPLIER LEAD TIME" value={form.lead} onChange={v=>setNumber('lead',v)} unit="days" placeholder="Unknown"/>
     </div>
     <label className="mt-3 flex items-center gap-2 text-[11px] text-content-soft">
      <input type="checkbox" checked={form.confirmed}
       onChange={e=>setForm(prev=>({...prev,confirmed:e.target.checked}))}
       className="size-4 accent-[#47785a]"/> Only include inbound quantities when a delivery is confirmed
     </label>
     <div className="mt-5 border-t border-line pt-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold"><Truck size={15}/> Stress scenarios</h4>
      {([
       ['logisticsDelayDays','Additional logistics delay','days',0,45,1],
       ['demandShockPct','Demand increase','%',0,60,5],
       ['priceShockPct','International price shock','%',0,75,5],
      ] as const).map(([key,label,unit,min,max,step])=><div key={key} className="mt-3">
       <div className="mb-2 flex justify-between gap-3 text-[11px]">
        <label htmlFor={'fert-'+key} className="text-content-soft">{label}</label>
        <strong className="tabular-nums">+{stress[key]} {unit}</strong>
       </div>
       <input id={'fert-'+key} type="range" min={min} max={max} step={step}
        value={stress[key]} onChange={event=>setStress(v=>({...v,[key]:Number(event.target.value)}))}
        className="w-full accent-[#47785a]"/>
      </div>)}
     </div>
    </article>

    <article className="rounded-xl border border-line bg-card p-4 md:p-5">
     <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Sparkles size={18} className="text-sage-700"/>
       <h3 className="text-base font-semibold">Decision intelligence</h3></div>
      <span className="rounded-full border border-line px-2 py-1 text-[10px] text-content-soft">Rules + evidence</span>
     </div>
     <p className="mt-2 text-[11px] text-content-soft">Actionable screening of procurement exposure. Each finding is traceable to the user scenario or public commodity references.</p>
     <div className="mt-4 space-y-2">
      {actions.map((action,i)=><div key={i} className="rounded-xl border border-line bg-background p-3">
       <div className="flex items-center gap-2 text-xs font-semibold">
        {action.priority==='critical'?<ShieldAlert size={16} className="text-[#b65742]"/>:
         action.priority==='watch'?<AlertTriangle size={16} className="text-[#b88b2e]"/>:
         <ShieldCheck size={16} className="text-[#5d876c]"/>}
        {action.title}
       </div>
       <p className="mt-1.5 text-[11px] leading-5 text-content-soft">{action.detail}</p>
      </div>)}
     </div>
     <div className="mt-4 grid grid-cols-3 gap-2">
      {assessed.map(x=><button key={x.days} type="button" onClick={()=>setHorizon(x.days)}
       aria-pressed={horizon===x.days}
       className={'rounded-xl border p-2 text-left '+(horizon===x.days?'border-[#618c76] bg-[#e8f3ea]':'border-line')}>
       <span className="block text-[9px] font-bold text-content-soft">{x.days} D</span>
       <span className={'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase '+tone(x.result.risk)}>
        {x.result.risk}</span>
       <span className="mt-1 block truncate text-xs tabular-nums">
        {x.result.shortfallTonnes===null?'Inventory unknown':money(x.result.shortfallTonnes,1)+' t deficit'}
       </span>
      </button>)}
     </div>
     <div className="mt-4 rounded-lg border border-line bg-background p-3 text-[11px] leading-5">
      <strong className="block">Horizon analysis · {horizon} days</strong>
      <span className="text-content-soft">{focused.result.reason}</span>
      {focused.result.balanceTonnes!==null&&<div className="mt-1 font-semibold tabular-nums">
       Modeled closing balance: {money(focused.result.balanceTonnes,1)} tonnes</div>}
     </div>
    </article>
   </div>

   <article className="rounded-xl border border-line bg-background p-4 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><span className="text-[10px] font-bold tracking-wider text-content-soft">NATIONAL SUPPLY INTELLIGENCE</span>
      <h3 className="mt-1 text-lg font-semibold">Production capacity ≠ domestic availability</h3></div>
     <button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}
      className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs">
      {expanded?'Less evidence':'View source evidence'} <ChevronDown size={13} className={expanded?'rotate-180':''}/></button>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
     <div className="rounded-lg border border-line bg-card p-4">
      <Factory size={18} className="text-sage-700"/>
      <strong className="mt-2 block text-lg">QAFCO · 5.6M t/y</strong>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">Published design capacity for urea, not inventory, domestic allocation or today's production.</p>
     </div>
     <div className="rounded-lg border border-line bg-card p-4">
      <Globe2 size={18} className="text-sage-700"/>
      <strong className="mt-2 block text-lg">{trade?.exportsQar!==null&&trade?.exportsQar!==undefined?compact(trade.exportsQar)+' QAR':'N/A'}</strong>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">Annual export value {trade?.year??'unavailable'}. Cannot be converted to fertilizer tonnage without product-level unit values.</p>
     </div>
     <div className="rounded-lg border border-line bg-card p-4">
      <PackageCheck size={18} className="text-sage-700"/>
      <strong className="mt-2 block text-lg">Stock unverified</strong>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">National warehouse inventories, fertilizer mix, committed imports and delivery ETAs need connected operational sources.</p>
     </div>
    </div>
    {expanded&&<div className="mt-4 grid gap-2 rounded-xl border border-line bg-card p-4 text-[11px] leading-5">
     <p><strong>World price series:</strong> Oct 2026 · World Bank Pink Sheet. FOB Middle East / US Gulf / CFR Brazil bases are not interchangeable with Qatar landed prices.</p>
     <p><strong>Qatar trade:</strong> {snapshot?.tradeDetail??'Loading official annual source.'}</p>
     <p><strong>QAFCO:</strong> Official urea nameplate capacity; domestic supply not reported.</p>
     <div className="flex flex-wrap gap-4">
      <a target="_blank" rel="noopener noreferrer" className="text-sage-700 underline" href={WORLD_BANK_FERTILIZER_SOURCE}>World Bank sources</a>
      <a target="_blank" rel="noopener noreferrer" className="text-sage-700 underline" href={QATAR_FERTILIZER_TRADE_SOURCE}>Qatar fertilizer trade</a>
      <a target="_blank" rel="noopener noreferrer" className="text-sage-700 underline" href={snapshot?.production.sourceUrl??'https://www.qafco.qa/en/our-plants/'}>QAFCO capacity</a>
     </div>
    </div>}
   </article>

   <p className="text-[10px] leading-5 text-content-soft">
    Source discipline: commodity benchmarks are published monthly reference prices dated October 2026, not real-time quotes. Risk scores are relative screening indices, not probabilities. Stock scenarios exist only in the browser and are not persisted. Neither QAFCO nominal capacity nor annual trade values establish fertilizer immediately available in Qatar.
   </p>
  </div>
 </section>
}
