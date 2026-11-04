'use client'

import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {Activity,ArrowRight,ArrowUpRight,Bot,Globe2,Leaf,ShieldAlert,ShieldCheck,TrendingUp,Warehouse,Wheat,Database,Ship,ShoppingBasket} from 'lucide-react'
import type {CommodityDefinition} from '@/lib/platform/commodity-catalog'
import type {FoodBalanceResult} from '@/lib/food-security/balance'
import type {CommoditySupplyLinks} from '@/lib/nfii/commodity-links'
import type {MarketInstrument,CommodityMarketsSnapshot} from '@/lib/watchtower/commodity-markets'
import {buildCommoditySignal} from '@/lib/nfii/commodity-intelligence'
import {useI18n} from '@/lib/i18n'
import styles from './commodity-intelligence-cockpit.module.css'
import {CommodityImportPrices} from './commodity-import-prices'

const fmt=(v:number|null|undefined,digits=1)=>
 v===null||v===undefined||!Number.isFinite(v)?'N/A':
 v.toLocaleString('en-US',{maximumFractionDigits:digits})
const pct=(v:number|null|undefined)=>v===null||v===undefined?'N/A':fmt(v*100,1)+'%'
const icons:Record<string,string>={
 tomato:'🍅',cucumber:'🥒',pepper:'🫑',lettuce:'🥬',date:'🌴',
 barley:'🌾',milk:'🥛',rice:'🍚',wheat:'🌾',
}
function CoverageDial({value,caption}:{value:number|null;caption:string}){
 const radius=73,circ=2*Math.PI*radius,fill=value===null?0:Math.max(0,Math.min(1,value))
 return <div className={styles.dial}>
  <svg viewBox="0 0 190 190" role="img" aria-label={caption}>
   <circle cx="95" cy="95" r={radius} fill="none" stroke="var(--growa-ink-700)" strokeWidth="13"/>
   <circle cx="95" cy="95" r={radius} fill="none" stroke="var(--growa-cream)"
    strokeWidth="13" strokeLinecap="round" strokeDasharray={circ}
    strokeDashoffset={circ*(1-fill)} transform="rotate(-90 95 95)"
    className={styles.dialFill}/>
  </svg>
  <div className={styles.dialCenter}><span>30-DAY REFERENCE</span>
   <strong>{value===null?'N/A':Math.round(value*100)+'%'}</strong>
   <small>{value===null?'Unverified inputs':'Coverage relative to 30 days'}</small>
  </div>
 </div>
}
function PriceTrend({instrument}:{instrument:MarketInstrument|null}){
 if(!instrument||instrument.points.length<2)return <div className={styles.noMarket}>
  <Activity size={22}/><strong>Price trend unavailable</strong>
  <span>No matching published global benchmark for this crop. No curve is simulated.</span>
 </div>
 const points=instrument.points.slice(-24),vals=points.map(x=>x.priceUsdTonne*3.64)
 const lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1
 const coordinates=vals.map((n,i)=>[i/Math.max(1,vals.length-1)*700,130-(n-lo)/span*110] as const)
 const d=coordinates.map(([x,y],i)=>(i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1)).join(' ')
 return <div className={styles.sparkChart}>
  <div className={styles.priceHeadline}>
   <div><small>GLOBAL MONTHLY BENCHMARK</small>
    <strong>{fmt(instrument.latestQarTonne,0)} <span>QAR/t</span></strong>
    <p>{instrument.benchmark} · {instrument.latestDate.slice(0,7)}</p></div>
   <span data-direction={(instrument.change1mPct??0)>0?'up':'down'}>
    {instrument.change1mPct===null?'MoM N/A':(instrument.change1mPct>0?'+':'')+fmt(instrument.change1mPct,1)+'% MoM'}
   </span>
  </div>
  <svg viewBox="0 0 700 150" preserveAspectRatio="none" role="img"
   aria-label={'Published monthly '+instrument.label+' price observations, last '+points.length+' months'}>
   <defs><linearGradient id="commodity-cockpit-trend" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="var(--growa-sage)" stopOpacity=".48"/>
    <stop offset="100%" stopColor="var(--growa-sage)" stopOpacity=".01"/>
   </linearGradient></defs>
   {[20,65,110].map(y=><line key={y} x1="0" x2="700" y1={y} y2={y}
    stroke="var(--border-inverse)" strokeDasharray="5 8"/>)}
   <path d={d+' L 700 150 L 0 150 Z'} fill="url(#commodity-cockpit-trend)"/>
   <path d={d} stroke="var(--growa-cream)" strokeWidth="3" strokeLinejoin="round"
    strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke"/>
  </svg>
  <div className={styles.chartDates}><span>{points[0].date.slice(0,7)}</span>
   <span>{points.at(-1)?.date.slice(0,7)}</span></div>
  <p className={styles.priceFoot}>IMF via FRED · monthly historical averages, not live offers, supplier quotes or delivered costs.</p>
 </div>
}
export function CommodityIntelligenceCockpit({commodity,balance,links,onAgents,onSources}:{
 commodity:CommodityDefinition;balance:FoodBalanceResult|null
 links:CommoditySupplyLinks;onAgents:()=>void;onSources:()=>void
}){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const tx=(en:string,arabic:string)=>ar?arabic:en
 const signals=useMemo(()=>buildCommoditySignal(balance),[balance])
 const [market,setMarket]=useState<CommodityMarketsSnapshot|null>(null)
 const [marketError,setMarketError]=useState(false)
 useEffect(()=>{
  let active=true;const ctrl=new AbortController()
  setMarket(null);setMarketError(false)
  fetch('/api/watchtower/commodity-markets',{signal:ctrl.signal})
   .then(async response=>{if(!response.ok)throw Error('market feed unavailable')
    return await response.json() as CommodityMarketsSnapshot})
   .then(data=>{if(active)setMarket(data)})
   .catch(()=>{if(active)setMarketError(true)})
  return ()=>{active=false;ctrl.abort()}
 },[])
 const instrument=market?.instruments.find(i=>i.id===commodity.id)??null
 const riskText:Record<typeof signals.risk,string>={
  critical:'CRITICAL SUPPLY SCREEN',high:'HIGH EXPOSURE',
  attention:'COVERAGE TO MONITOR',stable:'NO PERIOD-END SHORTAGE',
  unknown:'INSUFFICIENT EVIDENCE',
 }
 const healthNote=!signals.complete?
  'Stock and flow declarations are incomplete. Prioritize source validation before procurement decisions.':
  signals.deficitTonnes!==null&&signals.deficitTonnes>0?
  'A period-end supply shortfall is modeled. Validate the underlying flows and assess qualified sourcing options.':
  signals.risk==='critical'||signals.risk==='high'?
  'Coverage is limited. Stress-test imports, consumption and supply lead times before acting.':
  'No shortfall is modeled at period end. Keep monitoring delivery commitments and replenishment exposure.'
 const actions=[
  {name:'SOURCE VALIDATION',state:signals.complete?'Reviewed':'Attention needed',
   detail:signals.complete?signals.sourceCount+' linked evidence references':
    'Validate opening stock and all flow declarations',
   icon:Database,onClick:onSources},
  {name:'SUPPLY / DEMAND',state:signals.complete?'Evaluated':'Unavailable',
   detail:signals.complete?'Period-end '+fmt(signals.deficitTonnes)+' t deficit':
    'Do not infer quantities from missing data',
   icon:Activity,onClick:onAgents},
  {name:'PROCUREMENT',state:links.pendingApprovals>0?'Review required':'Contract screening',
   detail:links.suppliers.length+' linked suppliers · '+links.pendingApprovals+' approvals pending',
   icon:ShoppingBasket,href:'/dashboard/procurement'},
  {name:'LOGISTICS',state:links.delayedShipments>0?'Delay flagged':'Monitoring',
   detail:links.activeShipments+' active · '+links.delayedShipments+' delayed',
   icon:Ship,href:'/dashboard/logistics'},
 ]
 return <section className={styles.root} aria-label="Per-commodity strategic intelligence cockpit">
  <div className={styles.hero}>
   <div className={styles.heroBack}/>
   <div className={styles.heroHeader}>
    <div className={styles.heroTitle}>
     <div className={styles.eyebrow}><Wheat size={13}/> GROWA / COMMODITY COMMAND INTELLIGENCE</div>
     <div className={styles.headline}><div className={styles.cropSymbol}>{icons[commodity.id]??'🌱'}</div>
      <div><h2>{ar?commodity.nameAr:commodity.name} <span>Intelligence</span></h2>
       <p>{tx('A strategic operating picture across availability, exposure, trade and response.',
        'منظور تشغيلي استراتيجي للعرض والمخاطر والتجارة والاستجابة.')}</p></div>
     </div>
     <div className={styles.headerTags}>
      <span><Globe2 size={13}/> QATAR / ORGANIZATION-SCOPED</span>
      <span>{balance?.fromDate??'START N/A'} → {balance?.toDate??'END N/A'}</span>
      <span data-tone={signals.complete?'ready':'missing'}>
       {signals.complete?'REVIEWED BALANCE':'DATA GAPS PRESENT'}</span>
     </div>
    </div>
    <div className={styles.coveragePanel}>
     <CoverageDial value={signals.coverageFraction} caption="Coverage relative to 30-day screening benchmark"/>
     <div className={styles.coverageDetails}>
      <span>PROJECTED PERIOD-END COVERAGE</span>
      <strong>{fmt(signals.coverageDays)} <small>days</small></strong>
      <p>30-day scale for display only. Not an official food reserve target.</p>
     </div>
    </div>
   </div>
   <div className={styles.kpis}>
    {[
     {label:'USABLE CLOSING STOCK',value:signals.usableStockTonnes,unit:'t',note:'Projected period end',icon:Warehouse},
     {label:'SUPPLY DEFICIT',value:signals.deficitTonnes,unit:'t',note:'Unmet modeled demand',icon:ShieldAlert},
     {label:'DOMESTIC SHARE',value:signals.domesticShare===null?null:signals.domesticShare*100,unit:'%',note:'Of stock + supply inflows',icon:Leaf},
     {label:'IMPORT SHARE',value:signals.importShare===null?null:signals.importShare*100,unit:'%',note:'Of stock + supply inflows',icon:Ship},
    ].map(k=>{const Icon=k.icon;return <div className={styles.kpi} key={k.label}>
      <div><span>{k.label}</span><Icon size={15}/></div>
      <strong>{fmt(k.value)}<small>{k.unit}</small></strong><p>{k.note}</p></div>})}
   </div>
  </div>
  <div className={styles.deck}>
   <div className={styles.decisionPanel}>
    <div className={styles.cardEyebrow}><Bot size={14}/> DECISION INTELLIGENCE · SOURCE-CONSTRAINED</div>
    <div className={styles.decisionTop}><h3>What needs to happen next?</h3>
     <span data-risk={signals.risk}>{riskText[signals.risk]}</span></div>
    <p className={styles.decisionText}>{healthNote}</p>
    <div className={styles.actions}>
     <button type="button" onClick={onAgents}><Bot size={15}/> Run scenario agents <ArrowRight size={14}/></button>
     <button type="button" onClick={onSources}><Database size={15}/> Inspect evidence</button>
    </div>
    <p className={styles.agentDisclosure}>Recommendations above are transparent, rule-based screening from the selected commodity. Agent findings appear only after a scenario run, not as fabricated live LLM decisions.</p>
   </div>
   <div className={styles.flowPanel}>
    <div className={styles.cardEyebrow}><Activity size={14}/> VERIFIED PERIOD FLOW</div>
    <h3>Supply versus demand</h3>
    <p>Comparable metric-tonne totals for this period, not daily forecasts.</p>
    {signals.availableTonnes!==null&&signals.requiredTonnes!==null?(()=>{
     const max=Math.max(1,signals.availableTonnes,signals.requiredTonnes)
     return <div className={styles.flowBars}>
      {[{label:'Available',v:signals.availableTonnes,fill:'available'},
       {label:'Required + losses',v:signals.requiredTonnes,fill:'required'}].map(x=>
        <div key={x.label}><div className={styles.barLabel}><span>{x.label}</span>
         <strong>{fmt(x.v)} t</strong></div>
         <div className={styles.barTrack}><i data-fill={x.fill} style={{width:(x.v/max*100)+'%'}}/></div>
        </div>)}
      <small>Available = opening stock + domestic production + confirmed imports.</small>
     </div>
    })():<div className={styles.emptyData}>Cannot calculate supply/demand: required source coverage is incomplete.</div>}
   </div>
  </div>
  <div className={styles.deck}>
   <div className={styles.marketPanel}>
    <div className={styles.panelTop}><div><div className={styles.cardEyebrow}><TrendingUp size={14}/> COMMODITY PRICE INTELLIGENCE</div>
     <h3>Published market signals</h3></div>
     <Link href="/dashboard?module=watchtower#watchtower-markets">Global markets <ArrowUpRight size={13}/></Link></div>
    {instrument?<PriceTrend instrument={instrument}/>:
     <CommodityImportPrices commodity={commodity.id}/>}
    {marketError&&<p className={styles.dataAlert}>Monthly market benchmark unavailable. Showing customs source evidence when available.</p>}
   </div>
   <div className={styles.executionPanel}>
    <div className={styles.cardEyebrow}><ShieldCheck size={14}/> ACTION READINESS</div>
    <h3>From intelligence to execution</h3>
    <p>Evidence checks, risk assessment and operator-controlled handoffs.</p>
    <div className={styles.readinessRows}>{actions.map((a,i)=>{
     const Icon=a.icon;const inner=<><span className={styles.stepCount}>0{i+1}</span>
      <Icon size={17}/><div><strong>{a.name}</strong><small>{a.detail}</small></div>
      <span className={styles.actionState}>{a.state}</span><ArrowUpRight size={13}/></>
     return a.href?<Link key={a.name} href={a.href}>{inner}</Link>:
      <button type="button" key={a.name} onClick={a.onClick}>{inner}</button>
    })}</div>
   </div>
  </div>
  <div className={styles.bottomStrip}>
   <span><Database size={13}/> {signals.sourceCount} balance source references</span>
   <span><Warehouse size={13}/> {fmt(links.availableReserveTonnes)} t linked available reserve (not added to balance)</span>
   <span><ShieldCheck size={13}/> Human review required before contractual commitments</span>
  </div>
 </section>
}
