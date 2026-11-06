'use client'

import {useEffect,useMemo,useState} from 'react'
import { StatusDot, SegmentedToggle } from '@/components/brand/ui'
import { CardHeader } from '@/components/brand/layout'
import {
 Activity,ArrowDownRight,ArrowRight,ArrowUpRight,BarChart3,CalendarDays,
 CheckCircle2,ChevronRight,Clock3,Database,Factory,FlaskConical,Globe2,
 Info,PackageCheck,RefreshCw,ShieldAlert,ShieldCheck,SlidersHorizontal,
 Sparkles,Target,TrendingUp,Truck,Wallet,
} from 'lucide-react'
import {
 USD_QAR_REFERENCE,FERTILIZER_PRODUCTS,DEFAULT_FERTILIZER_STRESS,
 WORLD_BANK_FERTILIZER_SOURCE,QATAR_FERTILIZER_TRADE_SOURCE,QAFCO_REPORT_URL,
 assessFertilizerStock,averageFertilizerBenchmark,fertilizerMarketPressure,
 fertilizerPriceChange,latestFertilizerPrice,modeledDeliveredPrice,
 shortTermRecommendations,
 type FertilizerId,type FertilizerHorizon,type FertilizerProduct,
 type FertilizerSnapshot,type FertilizerStock,type FertilizerStress,
 type FertilizerRisk,type FertilizerPrice,
} from '@/lib/analytics/qatar-fertilizer'

const HORIZONS:[FertilizerHorizon,string][]=[
 [30,'30 days'],[90,'90 days'],[365,'12 months'],
]
const RISK_LABEL:Record<FertilizerRisk,string>={
 normal:'Low pressure',watch:'Watch',high:'Elevated',unassessed:'Needs evidence',
}
const RISK_COLOR:Record<FertilizerRisk,string>={
 normal:'bg-[#e6f0e9] text-[#2c684a] border-[#c8dacc]',
 watch:'bg-[#fff4de] text-[#87601c] border-[#e8d39f]',
 high:'bg-[#fae6df] text-[#a44834] border-[#e9bdb2]',
 unassessed:'bg-[#f3f1eb] text-[#655f55] border-[#d9d5c8]',
}
const money=(value:number,digits=0)=>
 value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const concise=(value:number)=>
 Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value)
const percent=(value:number|null,digits=1)=>
 value===null?'Trend not published':(value>0?'+':'')+money(value,digits)+'%'
const validNumber=(value:string):number|null=>{
 if(!value.trim())return null
 const n=Number(value)
 return Number.isFinite(n)&&n>=0?n:null
}
const baselineDraft=()=>({onHand:'',use:'',incoming:'',lead:'',confirmed:false})
type Draft=ReturnType<typeof baselineDraft>
const starterDrafts=():Record<FertilizerId,Draft>=>({
 urea:baselineDraft(),dap:baselineDraft(),potash:baselineDraft(),
 npk:baselineDraft(),'calcium-nitrate':baselineDraft(),
})
function draftStock(d:Draft):FertilizerStock{
 return {
  stockTonnes:validNumber(d.onHand),weeklyUseTonnes:validNumber(d.use),
  inboundTonnes:validNumber(d.incoming),leadDays:validNumber(d.lead),
  confirmed:d.confirmed,
 }
}
const presets=[
 {id:'base',name:'Baseline',detail:'No additional shocks',
  stress:{logisticsDelayDays:0,demandShockPct:0,priceShockPct:0}},
 {id:'freight',name:'Shipping delay',detail:'Scenario: +14 transit days',
  stress:{logisticsDelayDays:14,demandShockPct:0,priceShockPct:0}},
 {id:'demand',name:'Demand spike',detail:'Scenario: +25% consumption',
  stress:{logisticsDelayDays:0,demandShockPct:25,priceShockPct:0}},
 {id:'compound',name:'Compound shock',detail:'Scenario: logistics, demand and price',
  stress:{logisticsDelayDays:21,demandShockPct:20,priceShockPct:30}},
] as const

function SourceChip({children,kind='source'}:{children:React.ReactNode;kind?:'source'|'model'|'gap'}){
 return <span className="g-tag g-tag--outline-ink inline-flex items-center gap-2 text-[10px]">
  <StatusDot size={6} tone={kind==='gap'?'warning':kind==='model'?'good':'neutral'}/>{children}
 </span>
}
function SummaryMetric({title,value,sub,icon:Icon,accent=false}:{
 title:string;value:string;sub:string;icon:typeof Activity;accent?:boolean
}){
 return <div className="growa bg-card border border-line p-4" style={{borderRadius:'var(--radius-xl)'}}>
  <p className="flex items-center gap-2 text-[12px] text-content-soft">
   {accent?<StatusDot tone="warning" size={6}/>:<Icon className="size-3.5" strokeWidth={1.5}/>}
   {title}
  </p>
  <p className="growa-figure mt-2 text-content tabular-nums" style={{fontSize:'clamp(20px,1.8vw,28px)'}}>{value}</p>
  <p className="mt-2 text-[11px] leading-5 text-content-soft">{sub}</p>
 </div>
}
function Sparkline({prices,selected=false}:{prices:FertilizerPrice[];selected?:boolean}){
 if(prices.length<2)return <div className="flex h-10 items-center text-[9px] text-content-soft">Quote-based pricing</div>
 const w=150,h=42,values=prices.map(x=>x.usdPerTonne)
 const low=Math.min(...values),high=Math.max(...values),d=Math.max(1,high-low)
 const points=prices.map((x,i)=>[4+i/(prices.length-1)*(w-8),h-5-(x.usdPerTonne-low)/d*(h-12)])
 return <svg viewBox={'0 0 '+w+' '+h} className="h-10 w-full" aria-hidden="true">
  <polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" stroke={selected?'#2c6956':'#92ad9a'} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx={points.at(-1)![0]} cy={points.at(-1)![1]} r="3.5" fill={selected?'#2c6956':'#92ad9a'}/>
 </svg>
}
function MarketChart({product,currency,range}:{product:FertilizerProduct;currency:'USD'|'QAR';range:3|6|12}){
 const prices=product.prices.slice(-range)
 const scale=currency==='QAR'?USD_QAR_REFERENCE:1
 if(prices.length<2)return <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-[#d7ddd2] bg-[#f7f8f4] p-6 text-center">
  <div className="max-w-sm">
   <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e6eee5] text-[#49715c]"><Database className="size-6"/></div>
   <h4 className="mt-4 text-base font-bold text-content">Grade-specific quotation required</h4>
   <p className="mt-2 text-xs leading-6 text-content-soft">
    This product has no comparable published World Bank benchmark. Its chart will display supplier quotes once a specification, delivery basis and price are available. We do not substitute a made-up product price.
   </p>
   <a href="/dashboard/procurement" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#49715c] underline underline-offset-2">
    Open procurement <ArrowUpRight className="size-3.5"/></a>
  </div>
 </div>
 const width=790,height=286,left=50,right=760,top=24,bottom=229
 const values=prices.map(p=>p.usdPerTonne*scale)
 const minValue=Math.min(...values),maxValue=Math.max(...values)
 const span=Math.max(1,maxValue-minValue)
 const bottomValue=Math.max(0,minValue-span*.16),topValue=maxValue+span*.16
 const sx=(i:number)=>left+i/(prices.length-1)*(right-left)
 const sy=(value:number)=>bottom-(value-bottomValue)/Math.max(1,topValue-bottomValue)*(bottom-top)
 const coords=prices.map((p,i)=>[sx(i),sy(p.usdPerTonne*scale)])
 const line=coords.map(a=>a.join(',')).join(' ')
 const area=line+' '+right+','+bottom+' '+left+','+bottom
 const id='fert-chart-'+product.id
 return <div className="min-w-0">
  <svg viewBox={'0 0 '+width+' '+height} role="img" aria-label={product.name+' monthly World Bank benchmark trend, '+currency+' per tonne'} className="h-auto w-full">
   <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#648e71" stopOpacity=".27"/>
    <stop offset="100%" stopColor="#648e71" stopOpacity=".015"/>
   </linearGradient></defs>
   {[0,.25,.5,.75,1].map((f,i)=><g key={i}>
    <line x1={left} y1={top+f*(bottom-top)} x2={right} y2={top+f*(bottom-top)} stroke="#6c8274" strokeOpacity=".18" strokeDasharray="4 5"/>
    <text x={left-9} y={top+f*(bottom-top)+4} fill="#63776a" textAnchor="end" fontSize="11">
     {money(topValue-f*(topValue-bottomValue))}</text>
   </g>)}
   <polygon points={area} fill={'url(#'+id+')'}/>
   <polyline points={line} fill="none" stroke="#42765c" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round"/>
   {prices.map((price,i)=><g key={price.month}>
    <circle cx={coords[i][0]} cy={coords[i][1]} r={i===prices.length-1?5:3.3}
     fill={i===prices.length-1?'#1e5743':'#8bab95'} stroke="#fafdf9" strokeWidth="1.5">
     <title>{price.month}: {money(price.usdPerTonne*scale,1)} {currency}/t</title>
    </circle>
    {(i===0||i===Math.round((prices.length-1)/2)||i===prices.length-1)&&
     <text x={coords[i][0]} y={height-14} textAnchor={i===0?'start':i===prices.length-1?'end':'middle'} fill="#65756b" fontSize="11">
      {price.month}</text>}
   </g>)}
  </svg>
  <p className="mt-1 text-[10px] leading-4 text-content-soft">Monthly observations only. Interpolating between points is for visual continuity, not weekly price reporting.</p>
 </div>
}
function RiskPill({risk}:{risk:FertilizerRisk}){
 return <span className={'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold '+RISK_COLOR[risk]}>
  {RISK_LABEL[risk]}</span>
}
function NumericInput({label,value,onChange,unit,placeholder}:{
 label:string;value:string;onChange:(value:string)=>void;unit:string;placeholder:string
}){
 return <label className="block min-w-0">
  <span className="text-[10px] font-bold uppercase tracking-[.08em] text-content-soft">{label}</span>
  <div className="mt-2 flex overflow-hidden rounded-xl border border-line bg-white focus-within:border-[#73957e] focus-within:ring-1 focus-within:ring-[#73957e]">
   <input type="number" min="0" step="any" inputMode="decimal" value={value}
    onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    className="min-w-0 w-full bg-transparent px-3 py-2.5 text-sm outline-none"/>
   <span className="flex items-center border-l border-line bg-[#f8f8f5] px-3 text-[10px] text-content-soft">{unit}</span>
  </div>
 </label>
}
function ScenarioSlider({id,label,value,max,unit,onChange}:{
 id:string;label:string;value:number;max:number;unit:string;onChange:(v:number)=>void
}){
 return <div className="space-y-2">
  <div className="flex items-center justify-between gap-2 text-xs">
   <label htmlFor={id} className="font-medium text-content">{label}</label>
   <strong className="tabular-nums text-[#32684f]">+{money(value)} {unit}</strong>
  </div>
  <input id={id} type="range" min="0" max={max} step={max===45?1:5}
   value={value} onChange={e=>onChange(Number(e.target.value))}
   className="w-full cursor-pointer accent-[#396b50]"/>
 </div>
}
export function FertilizerIntelligence(){
 const [snapshot,setSnapshot]=useState<FertilizerSnapshot|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [reload,setReload]=useState(0)
 const [selectedId,setSelectedId]=useState<FertilizerId>('urea')
 const [period,setPeriod]=useState<3|6|12>(12)
 const [currency,setCurrency]=useState<'USD'|'QAR'>('USD')
 const [horizon,setHorizon]=useState<FertilizerHorizon>(90)
 const [drafts,setDrafts]=useState<Record<FertilizerId,Draft>>(starterDrafts)
 const [stress,setStress]=useState<FertilizerStress>(DEFAULT_FERTILIZER_STRESS)
 const [preset,setPreset]=useState('base')
 const [sourceExpanded,setSourceExpanded]=useState(false)

 useEffect(()=>{
  let active=true
  const controller=new AbortController()
  setLoading(true);setError('')
  void (async()=>{
   try{
    const response=await fetch('/api/analytics/qatar-fertilizers',{
     cache:'no-store',signal:controller.signal,
    })
    if(!response.ok)throw Error('HTTP '+response.status)
    const body=await response.json() as FertilizerSnapshot
    if(body.scope!=='qatar-national-fertilizers'||!Array.isArray(body.benchmarks))
     throw Error('Unexpected fertilizer data schema')
    if(active)setSnapshot(body)
   }catch(cause){
    if(active&&!controller.signal.aborted)setError(
     cause instanceof Error?cause.message:'Source request failed'
    )
   }finally{if(active)setLoading(false)}
  })()
  return()=>{active=false;controller.abort()}
 },[reload])

 const products=snapshot?.benchmarks?.length?snapshot.benchmarks:FERTILIZER_PRODUCTS
 const selected=products.find(p=>p.id===selectedId)??products[0]
 const selectedDraft=drafts[selectedId]
 const stock=useMemo(()=>draftStock(selectedDraft),[selectedDraft])
 const horizons=useMemo(()=>HORIZONS.map(([days,label])=>({
  days,label,inventory:assessFertilizerStock(stock,days,stress),
  market:fertilizerMarketPressure(selected,stress,days),
 })),[selected,stock,stress])
 const focused=horizons.find(h=>h.days===horizon)??horizons[1]
 const marketRisks=useMemo(()=>products.map(p=>({
  product:p,risks:HORIZONS.map(([days])=>fertilizerMarketPressure(p,stress,days)),
 })),[products,stress])
 const actions=useMemo(()=>shortTermRecommendations(selected,stock,stress),[selected,stock,stress])
 const latest=latestFertilizerPrice(selected)
 const trend=fertilizerPriceChange(selected,1)
 const trend3=fertilizerPriceChange(selected,3)
 const latestTrade=snapshot?.trade.at(-1)??null
 const avg=averageFertilizerBenchmark(products)
 const hasPrice=products.filter(p=>p.prices.length>0).length
 const verifiedStockCount=0 // No authenticated national inventory data source is connected.
 const converted=currency==='QAR'?USD_QAR_REFERENCE:1
 const marketScore=focused.market.score
 const adjusted=modeledDeliveredPrice(selected,stress)
 const visiblePrice=latest?money(latest.usdPerTonne*converted,1):'Supplier quote needed'
 const quoteUnit=latest?currency+'/tonne':'Specification required'
 const updateDraft=(key:keyof Omit<Draft,'confirmed'>,value:string)=>
  setDrafts(prev=>({...prev,[selectedId]:{...prev[selectedId],[key]:value}}))
 const applyStress=(value:FertilizerStress,id:string)=>{setStress(value);setPreset(id)}
 const updateStress=(key:keyof FertilizerStress,value:number)=>{
  setStress(prev=>({...prev,[key]:value}));setPreset('custom')
 }
 const highRiskCount=marketRisks.filter(x=>x.risks[1].risk==='high').length
 const stockReady=stock.stockTonnes!==null&&stock.weeklyUseTonnes!==null&&stock.weeklyUseTonnes>0&&stock.leadDays!==null

 return <div className="growa w-full space-y-4 bg-background pb-8 text-content">
  <header className="overflow-hidden rounded-[22px] bg-ink text-white shadow-panel">
   <div className="grid gap-5 bg-[radial-gradient(ellipse_at_85%_10%,rgba(140,177,117,.24),transparent_65%)] p-6 lg:grid-cols-[1.6fr_0.7fr] lg:p-8">
    <div>
     <span className="flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-cream-200">
      <FlaskConical className="size-4" strokeWidth={1.5}/> GROWA · NATIONAL AGRICULTURAL INPUTS
     </span>
     <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
      Fertilizer <span className="font-normal text-cream-200">Intelligence</span>
      <span className="mt-1 block text-2xl font-medium sm:text-3xl">Market & supply resilience</span>
     </h1>
     <p className="mt-3 max-w-2xl text-xs leading-6 text-cream-100">
      Commodity reference prices, Qatar supply exposure and explainable procurement scenarios, in one national control room.
     </p>
     <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
      <span className="rounded-full border border-white/20 px-3 py-2">World Bank · Oct 2026</span>
      <span className="rounded-full border border-white/20 px-3 py-2">30 / 90 / 365-day outlook</span>
      <span className="rounded-full border border-white/20 px-3 py-2">Stock not connected</span>
     </div>
    </div>
    <div className="rounded-2xl border border-white/20 bg-white/5 p-5">
     <span className="text-[10px] font-bold tracking-wider text-cream-200">NATIONAL MARKET REFERENCE</span>
     <strong className="growa-figure mt-3 block text-cream" style={{fontSize:'var(--text-display-3)'}}>
      {avg===null?'Awaiting reference':'$'+money(avg,1)}
     </strong>
     <p className="mt-2 text-xs text-cream-100">USD / tonne · three international benchmarks</p>
     <p className="mt-2 text-[11px] text-cream-100">Not a Qatar landed price or verified domestic sale.</p>
     <button type="button" onClick={()=>setReload(n=>n+1)}
      className="g-btn g-btn--outline-inverse mt-4 inline-flex items-center gap-2" aria-label="Refresh fertilizer source data">
      <RefreshCw className={'size-4 '+(loading?'animate-spin':'')} strokeWidth={1.5}/> Refresh sources
     </button>
    </div>
   </div>
   <div className="grid border-t border-white/20 bg-white/5 sm:grid-cols-2 xl:grid-cols-4">
    {[
     {label:'QAFCO UREA CAPACITY',value:concise(snapshot?.production.capacityTonnesPerYear??5_600_000)+' t/y',hint:'Nominal, not on-hand stock',icon:Factory},
     {label:'PRICE COVERAGE',value:hasPrice+'/'+products.length+' grades',hint:'Monthly World Bank benchmarks',icon:BarChart3},
     {label:'NATIONAL STOCK FEED',value:'Not connected',hint:'Availability unverified',icon:PackageCheck},
     {label:'SCREENING HORIZON',value:'30 · 90 · 365 d',hint:'Modeled risk, not observed outages',icon:Activity},
    ].map(item=><div key={item.label} className="min-w-0 border-b border-white/15 p-4 sm:border-e xl:border-b-0">
     <span className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-cream-200">
      <item.icon className="size-3.5" strokeWidth={1.5}/>{item.label}
     </span>
     <strong className="growa-figure mt-2 block text-cream tabular-nums" style={{fontSize:'clamp(19px,2vw,27px)'}}>{item.value}</strong>
     <small className="mt-1 block text-[10px] text-cream-100">{item.hint}</small>
    </div>)}
   </div>
  </header>

  {error&&<div role="status" className="flex items-start gap-2 rounded-xl border border-[#e2d1b5] bg-[#fff7e8] p-3 text-[11px] text-[#7b5a25]">
   <Info className="mt-0.5 size-4 shrink-0"/>
   <p>Qatar trade feed currently unavailable ({error}). Dated global price benchmarks and the local scenario engine remain available. No trade figures are substituted.</p>
  </div>}

  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <SummaryMetric title="Latest market month" value="Oct 2026" sub="Published monthly, not a daily trading feed" icon={CalendarDays}/>
   <SummaryMetric title="Qatar fertilizer trade" value={latestTrade?String(latestTrade.year):'Source pending'}
    sub={latestTrade?'Latest available annual trade year':'Official reporting feed, checked separately'} icon={Globe2}/>
   <SummaryMetric title="30–90d risk signals" value={highRiskCount+' high'}
    sub="Products in the elevated rules-based stress band at 90 days" icon={ShieldAlert}/>
   <SummaryMetric title="Supply verification" value="Action required"
    sub="Connect stock, supplier offers and confirmed replenishment schedules" icon={Target} accent/>
  </section>

  <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
   <article className="min-w-0 rounded-[22px] border border-line bg-card p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">01 / Market terminal</div>
      <h2 className="mt-1 text-xl font-bold">Fertilizer price discovery</h2>
      <p className="mt-1 text-[11px] text-content-soft">Select a fertilizer to inspect observed benchmarks and source basis.</p>
     </div>
     <SegmentedToggle ariaLabel="Price currency" size="sm"
      options={[{value:'USD',label:'USD'},{value:'QAR',label:'QAR'}]}
      value={currency} onChange={setCurrency}/>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-5">
     {products.map(p=>{
      const price=latestFertilizerPrice(p)
      const change=fertilizerPriceChange(p)
      const isSelected=p.id===selectedId
      return <button key={p.id} type="button" aria-pressed={isSelected} onClick={()=>setSelectedId(p.id)}
       className={'flex min-w-0 flex-col rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md '+(
        isSelected?'border-[#6c9678] bg-[#eaf3ec] ring-1 ring-[#6c9678]':'border-line bg-[#f9faf7]')}>
       <div className="flex w-full items-center justify-between gap-1">
        <strong className="truncate text-xs">{p.name}</strong>
        {isSelected&&<span className="size-1.5 rounded-full bg-[#306847]"/>}
       </div>
       <div className="mt-1 text-[10px] text-content-soft">{p.formula}</div>
       <div className="mt-3 text-[17px] font-bold tracking-tight tabular-nums">
        {price?money(price.usdPerTonne*converted,0):'Request quote'}
       </div>
       <div className="mt-0.5 text-[9px] text-content-soft">{price?currency+'/tonne · Oct 2026':'Grade-specific price'}</div>
       <div className="mt-auto w-full pt-2"><Sparkline prices={p.prices} selected={isSelected}/></div>
       <div className={'mt-1 flex items-center gap-1 text-[10px] font-bold '+(change!==null&&change>0?'text-[#a16a25]':'text-[#5c856a]')}>
        {change!==null&&(change>0?<ArrowUpRight className="size-3.5"/>:<ArrowDownRight className="size-3.5"/>)}
        {change===null?'Quote required':percent(change)}
       </div>
      </button>
     })}
    </div>

    <div className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-[#f8faf7] px-4 py-3">
     <div>
      <span className="text-[10px] font-bold uppercase tracking-[.12em] text-content-soft">Selected benchmark / {selected.name}</span>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
       <strong className="text-[29px] font-bold tabular-nums">{visiblePrice}</strong>
       <span className="text-[11px] text-content-soft">{quoteUnit}</span>
      </div>
      <div className="mt-1 text-[11px] text-content-soft">{selected.basis}</div>
     </div>
     <div className="text-right">
      <div className="text-[10px] font-semibold uppercase text-content-soft">3-month movement</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{percent(trend3)}</div>
      <div className="text-[10px] text-content-soft">Monthly benchmark, not delivered price</div>
     </div>
    </div>
    <div className="mt-5 flex items-center justify-between gap-2">
     <h3 className="text-xs font-bold">Historical price chart</h3>
     <SegmentedToggle ariaLabel="Historical chart range" size="sm"
      options={[{value:3,label:'3 mo'},{value:6,label:'6 mo'},{value:12,label:'12 mo'}]}
      value={period} onChange={setPeriod}/>
    </div>
    <div className="mt-3"><MarketChart product={selected} currency={currency} range={period}/></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-content-soft">
     <span>World Bank Pink Sheet · Oct 2026 · historical global benchmarks</span>
     <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-[#407455] underline underline-offset-2">
      View source <ArrowUpRight className="size-3.5"/></a>
    </div>
   </article>

   <article className="min-w-0 rounded-[22px] border border-line bg-card p-4 md:p-6">
    <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">02 / Forward risk intelligence</div>
    <h2 className="mt-1 text-xl font-bold">Exposure radar</h2>
    <p className="mt-2 text-[11px] leading-5 text-content-soft">
     Explainable scenario score from 0–100. It is a screening index, not the probability of a disruption.
    </p>
    <div className="mt-4 grid grid-cols-3 gap-2">
     {horizons.map(h=><button key={h.days} type="button" aria-pressed={horizon===h.days} onClick={()=>setHorizon(h.days)}
      className={'rounded-xl border p-3 text-center transition-colors '+(horizon===h.days?'border-[#7da385] bg-[#e6f1e8]':'border-line bg-[#f8faf7]')}>
      <span className="block text-[10px] font-semibold text-content-soft">{h.label}</span>
      <strong className="mt-1 block text-2xl tabular-nums">{h.market.score}<span className="text-xs font-normal">/100</span></strong>
      <span className="mt-2 inline-block"><RiskPill risk={h.market.risk}/></span>
     </button>)}
    </div>
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#365b4b] bg-[#173f35] p-5 text-white">
     <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#d2e2d6]">
      <span>Scenario exposure · {horizon} days</span><Activity className="size-4"/>
     </div>
     <div className="mt-3 flex items-baseline gap-2">
      <strong className="text-4xl font-semibold tabular-nums">{marketScore}</strong>
      <span className="text-xs text-[#cbded2]">relative points / 100</span>
     </div>
     <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full bg-[linear-gradient(90deg,#80a993_0%,#d2aa6b_63%,#c76c54_100%)] transition-[width] duration-500"
       style={{width:marketScore+'%'}}/>
     </div>
     <div className="mt-2 flex justify-between text-[9px] text-[#b9d0c0]">
      <span>Lower screening pressure</span><span>Higher</span>
     </div>
    </div>
    <div className="mt-5 space-y-2">
     <h3 className="text-xs font-bold">Drivers behind the score</h3>
     {focused.market.drivers.map((driver,i)=><div key={driver} className="flex items-start gap-2 rounded-xl border border-line bg-[#f8faf7] px-3 py-2.5 text-[11px]">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e5ede5] text-[9px] font-bold text-[#437152]">{i+1}</span>
      {driver}
     </div>)}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
     <div className="rounded-xl border border-line bg-background p-3">
      <div className="text-[10px] font-bold uppercase text-content-soft">Stressed benchmark</div>
      <div className="mt-2 text-lg font-bold">{adjusted===null?'Quote required':'$'+money(adjusted,1)+'/t'}</div>
      <p className="text-[9px] text-content-soft">What-if price, not a supplier offer</p>
     </div>
     <div className="rounded-xl border border-line bg-background p-3">
      <div className="text-[10px] font-bold uppercase text-content-soft">Inventory runway</div>
      <div className="mt-2 text-lg font-bold">{focused.inventory.coverageDays===null?'Enter inventory':money(focused.inventory.coverageDays)+' days'}</div>
      <p className="text-[9px] text-content-soft">Only from user-specified stock and usage</p>
     </div>
    </div>
   </article>
  </section>

  <section className="rounded-[22px] border border-line bg-card p-4 md:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">03 / National vulnerability matrix</div>
     <h2 className="mt-1 text-xl font-bold">Risk horizon heatmap</h2>
     <p className="mt-1 text-[11px] text-content-soft">Compare all tracked fertilizer groups under your active what-if assumptions.</p>
    </div>
    <SourceChip kind="model">Rules-based, not incident reports</SourceChip>
   </div>
   <div className="mt-5 overflow-x-auto">
    <div className="min-w-[680px]">
     <div className="grid grid-cols-[minmax(180px,1.25fr)_repeat(3,minmax(120px,1fr))_minmax(140px,1fr)] gap-2 px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-content-soft">
      <div>Product</div><div>30-day</div><div>90-day</div><div>12-month</div><div>Price evidence</div>
     </div>
     {marketRisks.map(({product,risks})=><button type="button" key={product.id} onClick={()=>setSelectedId(product.id)}
      aria-pressed={selectedId===product.id}
      className={'mt-2 grid w-full grid-cols-[minmax(180px,1.25fr)_repeat(3,minmax(120px,1fr))_minmax(140px,1fr)] items-center gap-2 rounded-xl border p-2 text-left transition-all hover:bg-[#eef4ec] '+(
       selectedId===product.id?'border-[#7da487] bg-[#f2f7f0]':'border-line bg-[#fafbf8]')}>
      <div className="min-w-0 px-2">
       <strong className="block text-xs">{product.name}</strong>
       <span className="text-[10px] text-content-soft">{product.category}</span>
      </div>
      {risks.map((risk,j)=><div key={HORIZONS[j][0]} className={'flex items-center justify-between gap-1 rounded-lg border px-2.5 py-3 '+RISK_COLOR[risk.risk]}>
       <strong className="text-base tabular-nums">{risk.score}</strong>
       <span className="text-[9px] font-bold">{risk.risk==='normal'?'LOW':risk.risk==='watch'?'WATCH':'HIGH'}</span>
      </div>)}
      <div className="px-2 text-[10px] text-content-soft">{product.prices.length?'Verified benchmark':'Needs supplier quote'}</div>
     </button>)}
    </div>
   </div>
   <p className="mt-3 text-[10px] leading-5 text-content-soft">
    Screening scores respond to price history and selected scenarios; they do not demonstrate actual national availability, transit disruption or fulfillment probability.
   </p>
  </section>

  <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
   <article className="rounded-[22px] border border-line bg-card p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div>
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">04 / Scenario laboratory</div>
      <h2 className="mt-1 text-xl font-bold">Stress-test supply continuity</h2>
     </div>
     <SlidersHorizontal className="size-5 text-[#6f9479]"/>
    </div>
    <p className="mt-2 text-[11px] leading-5 text-content-soft">
     All numbers below are your inputs or hypothetical shocks. Inputs are scoped to {selected.name}, kept in this browser session, and never written to national inventory records.
    </p>
    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
     {presets.map(p=><button key={p.id} type="button" onClick={()=>applyStress({...p.stress},p.id)}
      aria-pressed={preset===p.id} title={p.detail}
      className={'rounded-xl border px-3 py-3 text-left transition-colors '+(
       preset===p.id?'border-[#749a7c] bg-[#e6efe5]':'border-line bg-[#f9faf7]')}>
      <span className="block text-xs font-bold">{p.name}</span>
      <span className="mt-1 block text-[10px] leading-4 text-content-soft">{p.detail}</span>
     </button>)}
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
     <ScenarioSlider id="fert-delay" label="Additional transit time" value={stress.logisticsDelayDays} max={45} unit="days"
      onChange={v=>updateStress('logisticsDelayDays',v)}/>
     <ScenarioSlider id="fert-demand" label="Demand increase" value={stress.demandShockPct} max={60} unit="%"
      onChange={v=>updateStress('demandShockPct',v)}/>
     <ScenarioSlider id="fert-price" label="Price stress" value={stress.priceShockPct} max={75} unit="%"
      onChange={v=>updateStress('priceShockPct',v)}/>
    </div>
    <div className="my-5 border-t border-line"/>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h3 className="text-sm font-bold">Inventory and confirmed arrivals</h3>
     <button type="button" onClick={()=>setDrafts(prev=>({...prev,[selectedId]:baselineDraft()}))}
      className="text-[10px] font-semibold text-[#447457] underline underline-offset-2">Clear {selected.name} inputs</button>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
     <NumericInput label="Physical stock" value={selectedDraft.onHand} onChange={v=>updateDraft('onHand',v)} unit="t" placeholder="Enter stock"/>
     <NumericInput label="Average consumption" value={selectedDraft.use} onChange={v=>updateDraft('use',v)} unit="t/week" placeholder="Enter demand"/>
     <NumericInput label="Inbound quantity" value={selectedDraft.incoming} onChange={v=>updateDraft('incoming',v)} unit="t" placeholder="Enter order"/>
     <NumericInput label="Supplier lead time" value={selectedDraft.lead} onChange={v=>updateDraft('lead',v)} unit="days" placeholder="Enter lead time"/>
    </div>
    <label className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-[#f8faf7] p-3 text-[11px]">
     <input className="mt-0.5 size-4 shrink-0 accent-[#3c7552]" type="checkbox"
      checked={selectedDraft.confirmed}
      onChange={e=>setDrafts(prev=>({...prev,[selectedId]:{...prev[selectedId],confirmed:e.target.checked}}))}/>
     <span>Count inbound tonnage only if the supplier has confirmed the delivery. An unconfirmed order does not increase the stock forecast.</span>
    </label>
   </article>

   <article className="rounded-[22px] border border-line bg-card p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div>
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">05 / Decision room</div>
      <h2 className="mt-1 text-xl font-bold">Supply outlook & actions</h2>
     </div>
     <Sparkles className="size-5 text-[#658a6b]"/>
    </div>
    <div className="mt-4 flex items-center gap-2">
     <SourceChip kind="model">Explainable rules engine</SourceChip>
     <span className="text-[10px] text-content-soft">Not an autonomous purchasing agent</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
     {horizons.map(h=><button key={h.days} type="button" onClick={()=>setHorizon(h.days)}
      className={'rounded-xl border p-3 text-left '+(horizon===h.days?'border-[#719779] bg-[#edf4ed]':'border-line bg-[#f8faf7]')}>
      <span className="block text-[10px] font-bold">{h.label}</span>
      <span className="mt-2 block"><RiskPill risk={h.inventory.risk}/></span>
      <span className="mt-2 block text-[11px] font-semibold tabular-nums">
       {h.inventory.shortfallTonnes===null?'Check inputs':money(h.inventory.shortfallTonnes,1)+' t shortfall'}
      </span>
     </button>)}
    </div>
    <div className="mt-4 rounded-2xl border border-[#d8e4d6] bg-[#eff6ef] p-4">
     <div className="flex items-center gap-2 text-xs font-bold text-[#305d43]"><Target className="size-4"/> Selected horizon · {horizon} days</div>
     <p className="mt-2 text-[12px] leading-6 text-[#365a44]">{focused.inventory.reason}</p>
     {stockReady&&focused.inventory.balanceTonnes!==null&&<div className="mt-3 flex items-center justify-between border-t border-[#d1e2d0] pt-3">
      <span className="text-[11px] text-[#466a50]">Scenario closing balance</span>
      <strong className="text-base tabular-nums">{money(focused.inventory.balanceTonnes,1)} t</strong>
     </div>}
    </div>
    <h3 className="mt-5 text-xs font-bold">Recommended next steps</h3>
    <div className="mt-3 space-y-2">
     {actions.map((action,i)=><div key={action.title} className="rounded-xl border border-line bg-[#f9faf8] p-3">
      <div className="flex items-start gap-2">
       <span className={'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg '+(
        action.priority==='critical'?'bg-[#f5e2d8] text-[#a44a38]':
        action.priority==='watch'?'bg-[#f8edd6] text-[#976b1d]':'bg-[#e4eee4] text-[#427357]')}>
        {action.priority==='critical'?<ShieldAlert className="size-4"/>:
         action.priority==='watch'?<Activity className="size-4"/>:<ShieldCheck className="size-4"/>}
       </span>
       <div>
        <strong className="text-xs">{String(i+1).padStart(2,'0')} · {action.title}</strong>
        <p className="mt-1 text-[11px] leading-5 text-content-soft">{action.detail}</p>
       </div>
      </div>
     </div>)}
    </div>
   </article>
  </section>

  <section className="rounded-[22px] border border-line bg-card p-4 md:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#578269]">06 / Availability intelligence</div>
     <h2 className="mt-1 text-xl font-bold">Where availability is proven, and where it is not</h2>
     <p className="mt-1 text-[11px] text-content-soft">Production, trade and warehouse stock are three separate layers of evidence.</p>
    </div>
    <button type="button" onClick={()=>setSourceExpanded(value=>!value)}
     aria-expanded={sourceExpanded}
     className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold hover:bg-[#f7faf5]">
     <Database className="size-4"/> {sourceExpanded?'Hide evidence':'Inspect sources'}
    </button>
   </div>
   <div className="mt-5 grid gap-3 md:grid-cols-3">
    <div className="rounded-xl border border-[#d7e4d5] bg-[#f0f7ef] p-4">
     <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#52775d]"><Factory className="size-4"/> Production capacity</div>
     <strong className="mt-3 block text-2xl tabular-nums">5.6M t/y</strong>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">QAFCO urea nominal capacity. Not domestic allocations, current production or market stock.</p>
    </div>
    <div className="rounded-xl border border-line bg-[#f8faf7] p-4">
     <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-content-soft"><Globe2 className="size-4"/> Official trade value</div>
     <strong className="mt-3 block text-2xl tabular-nums">{latestTrade?.importsQar===null||latestTrade?.importsQar===undefined?
       'Feed pending':concise(latestTrade.importsQar)+' QAR'}</strong>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">Published imports {latestTrade?.year??'year to verify'}, annual value, not inbound tonnes or immediately available fertilizer.</p>
    </div>
    <div className="rounded-xl border border-[#e8dcc4] bg-[#fffbf1] p-4">
     <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.08em] text-[#8e743f]"><PackageCheck className="size-4"/> National stock visibility</div>
     <strong className="mt-3 block text-[21px]">Awaiting integration</strong>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">No connected warehouse inventory or confirmed national delivery data. Model inputs above are illustrative, not reported stock.</p>
    </div>
   </div>
   <div className="mt-5 overflow-x-auto">
    <table className="w-full min-w-[650px] text-left text-xs">
     <thead><tr className="border-b border-line text-[10px] uppercase tracking-wide text-content-soft">
      <th className="pb-3">Input</th><th className="pb-3">Supply channel</th>
      <th className="pb-3">Market price</th><th className="pb-3">Physical stock</th>
     </tr></thead>
     <tbody>{products.map(p=>{
      const price=latestFertilizerPrice(p)
      return <tr key={p.id} className="border-b border-line last:border-0">
       <td className="py-3 font-bold">{p.name}<span className="block text-[10px] font-normal text-content-soft">{p.category}</span></td>
       <td className="py-3 text-content-soft">{p.id==='urea'?'Qatar producer / export market':'Supplier-distributor validation needed'}</td>
       <td className="py-3 tabular-nums">{price?'$'+money(price.usdPerTonne,1)+'/t · benchmark':'Request grade-specific quote'}</td>
       <td className="py-3"><RiskPill risk="unassessed"/></td>
      </tr>
     })}</tbody>
    </table>
   </div>
   {sourceExpanded&&<div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-3">
    {[
     {title:'World Bank Pink Sheet',detail:'Monthly global price benchmarks · Oct 2026 · not landed Qatar prices',href:WORLD_BANK_FERTILIZER_SOURCE},
     {title:'Qatar MOCI / Open Data',detail:snapshot?.tradeDetail??'Official annual fertilizer trade series; live feed status pending',href:QATAR_FERTILIZER_TRADE_SOURCE},
     {title:'QAFCO production',detail:'Nominal nameplate capacity for urea, not warehouse availability',href:snapshot?.production.sourceUrl??QAFCO_REPORT_URL},
    ].map(item=><a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
     className="group rounded-xl border border-line bg-[#f9faf7] p-4 transition-colors hover:border-[#92af93]">
     <strong className="flex items-center justify-between gap-2 text-xs">{item.title}<ArrowUpRight className="size-4 text-content-soft group-hover:text-[#437458]"/></strong>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">{item.detail}</p>
    </a>)}
   </div>}
  </section>

  <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[#f6f8f4] px-4 py-3 text-[10px] leading-5 text-content-soft">
   <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#658875]"/>
    Market references, rule-based scenarios and missing operational evidence are explicitly distinguished. No unverified national stock or supplier price is represented as factual.</div>
   <a className="inline-flex items-center gap-1 font-bold text-[#4b785b] underline underline-offset-2"
    href="/dashboard/procurement">Open Procurement <ArrowRight className="size-3.5"/></a>
  </footer>
 </div>
}
