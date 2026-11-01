'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect,useMemo,useRef,useState} from 'react'
import {AlertTriangle,ArrowRight,BarChart3,Bot,
  Database,FileSearch,PackageCheck,RefreshCw,Warehouse} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {resolveCommodity} from '@/lib/platform/commodity-catalog'
import type {FoodBalanceResult} from '@/lib/food-security/balance'
import type {OperationsSnapshot} from '@/lib/nfii/operations-types'
import {
  buildReservePortfolio,runReserveAgent,
  type ReserveAgentReport,type ReserveBucket,type ReserveGroup,
  type ReserveLotView,type ReserveSeverity,type VerifiedReserveDemand,
} from '@/lib/nfii/reserves-intelligence'

type Register='warehouses'|'lots'|'releases'|'approvals'
type Props={
  organizationId:string|null;snapshot:OperationsSnapshot|null;today:string
  truncated:string[];canEdit:boolean
  onOpenRegister:(type:Register)=>void;onRefresh:()=>void
}

const amount=(value:number|null|undefined,decimal=1)=>
  value===null||value===undefined||!Number.isFinite(value)?'N/A':
    value.toLocaleString('en-US',{maximumFractionDigits:decimal})
const fillColors=['var(--growa-sage)','var(--growa-ink)',
  'var(--growa-sage-400)','var(--growa-stone-600)']
const severityCss:Record<ReserveSeverity,string>={
  critical:'border-warning-line bg-warning-soft text-critical',
  high:'border-warning-line bg-warning-soft text-warning-strong',
  attention:'border-line bg-muted text-content',
  info:'border-line bg-muted/50 text-content-soft',
}
function BarGroups({rows,label,max=7}:{
  rows:ReserveGroup[];label:string;max?:number
}){
  const visible=rows.slice(0,max)
  const scale=Math.max(1,...visible.map(row=>row.onHandTonnes))
  if(!rows.length)return <p className="rounded-lg bg-muted/20 p-4 text-[12px] text-content-soft">
    No eligible inventory to plot. No placeholder quantities are generated.
  </p>
  return <div role="group" aria-label={label} className="mt-4 space-y-3">
    {visible.map((row,i)=>{
      const occupied=Math.max(0,row.onHandTonnes-row.uncommittedTonnes)
      return <div key={row.id}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-content">{row.name}
            <span className="ms-1 text-content-soft">({row.lotCount} lots)</span>
          </span>
          <span className="tabular-nums text-content">{amount(row.onHandTonnes)} t</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-sm bg-muted"
          title={row.name+': '+amount(row.uncommittedTonnes)+' t uncommitted, '+amount(occupied)+' t committed'}>
          <div style={{width:(row.uncommittedTonnes/scale*100)+'%',backgroundColor:fillColors[i%fillColors.length]}}/>
          <div style={{width:(occupied/scale*100)+'%',backgroundColor:'var(--growa-stone-500)'}}/>
        </div>
        <p className="mt-1 text-[10px] text-content-soft">
          {amount(row.uncommittedTonnes)} t uncommitted · {amount(row.committedTonnes)} t approved commitments
        </p>
      </div>
    })}
    {rows.length>max&&<p className="text-[10px] text-content-soft">
      Only {max} of {rows.length} groups shown. Totals cover all loaded eligible groups.
    </p>}
  </div>
}
function ExpiryChart({buckets,total}:{buckets:ReserveBucket[];total:number}){
  const titles=['0–7 days','8–30 days','31–90 days','Over 90 days']
  const colors=['var(--status-critical)','var(--growa-stone-600)',
    'var(--growa-sage-400)','var(--growa-sage)']
  return <div>
    {total>0?<div className="mt-4 flex h-5 overflow-hidden rounded-md bg-muted" role="img"
      aria-label="Usable on-hand inventory by time remaining until expiry">
      {buckets.map((bucket,i)=><div key={bucket.key}
        title={titles[i]+': '+amount(bucket.onHandTonnes)+' t'}
        style={{width:(bucket.onHandTonnes/total*100)+'%',backgroundColor:colors[i]}}/>)}
    </div>:<p className="mt-4 text-[12px] text-content-soft">
      No eligible on-hand inventory for an expiry distribution.
    </p>}
    <div className="mt-4 grid grid-cols-2 gap-3">
      {buckets.map((bucket,i)=><div key={bucket.key} className="rounded-lg border border-line p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-content-soft">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm"
            style={{backgroundColor:colors[i]}}/>{titles[i]}
        </div>
        <p className="mt-1 text-[17px] font-semibold tabular-nums text-content">
          {amount(bucket.onHandTonnes)} <span className="text-[10px] font-normal text-content-soft">t</span>
        </p>
        <p className="text-[10px] text-content-soft">{bucket.lotCount} approved lots</p>
      </div>)}
    </div>
    <p className="mt-2 text-[10px] text-content-soft">
      Expired and unverified lots are excluded from this chart; it is a present-day expiry profile, not a historical trend.
    </p>
  </div>
}
function StockMix({physical,free,committed}:{physical:number;free:number;committed:number}){
  const pct=physical>0?Math.min(100,Math.max(0,free/physical*100)):0
  const radius=45,circumference=2*Math.PI*radius
  return <div className="flex items-center gap-4">
    <svg viewBox="0 0 112 112" role="img" aria-label="Share of usable inventory not allocated to approved releases"
      className="h-32 w-32 shrink-0">
      <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--growa-stone-200)" strokeWidth="14"/>
      <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--growa-sage)" strokeWidth="14"
        strokeDasharray={circumference} strokeDashoffset={circumference*(1-pct/100)}
        strokeLinecap="round" transform="rotate(-90 56 56)"/>
      <text x="56" y="53" textAnchor="middle" fontSize="18" fontWeight="600"
        fill="var(--growa-ink)">{physical>0?Math.round(pct)+'%':'N/A'}</text>
      <text x="56" y="67" textAnchor="middle" fontSize="9"
        fill="var(--growa-stone-600)">uncommitted</text>
    </svg>
    <div className="space-y-2 text-[12px]">
      <div><p className="text-content-soft">Usable recorded lots</p>
        <strong className="tabular-nums">{amount(physical)} t</strong></div>
      <div><p className="text-content-soft">Approved release commitments</p>
        <strong className="tabular-nums">{amount(committed)} t</strong></div>
      <div><p className="text-content-soft">Available after commitments</p>
        <strong className="tabular-nums">{amount(free)} t</strong></div>
    </div>
  </div>
}
function LotRows({lots,onOpen}:{lots:ReserveLotView[];onOpen:()=>void}){
  const [filter,setFilter]=useState<'all'|'fefo'|'excluded'>('all')
  const shown=lots.filter(l=>filter==='all'||filter==='excluded'&&!l.eligible||
    filter==='fefo'&&l.eligible&&l.daysToExpiry!==null&&l.daysToExpiry<=30)
  return <section className="nfii-panel overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
      <div>
        <h3 className="text-[14px] font-semibold text-content">Lot watchlist · FEFO</h3>
        <p className="mt-1 text-[11px] text-content-soft">
          First-expiry-first-out priority; inspect source records before any physical release.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}
          className="nfii-input text-[11px]" aria-label="Filter reserve lots">
          <option value="all">All loaded lots</option>
          <option value="fefo">Expiry within 30 days</option>
          <option value="excluded">Excluded / pending review</option>
        </select>
        <button type="button" className="nfii-button nfii-button-secondary" onClick={onOpen}>
          <FileSearch className="h-4 w-4"/> Open lot register
        </button>
      </div>
    </div>
    <div className="max-h-[430px] overflow-auto">
      <table className="w-full min-w-[720px] text-[11px]">
        <thead className="sticky top-0 bg-card text-content-soft">
          <tr>
            <th className="p-3 text-start">Lot</th><th className="p-3 text-start">Commodity / warehouse</th>
            <th className="p-3 text-end">On-hand t</th><th className="p-3 text-end">Uncommitted t</th>
            <th className="p-3 text-start">Expiry</th><th className="p-3 text-start">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.slice(0,100).map(row=><tr key={row.id} className="hover:bg-muted/20">
            <td className="p-3 font-medium text-content">{row.reference}</td>
            <td className="p-3 text-content">{row.commodityName}<span className="block text-content-soft">{row.warehouse}</span></td>
            <td className="p-3 text-end tabular-nums">{amount(row.onHandTonnes)}</td>
            <td className="p-3 text-end tabular-nums">{row.eligible?amount(row.uncommittedTonnes):'N/A'}</td>
            <td className="p-3">{row.expiryDate??'N/A'}
              <span className="block text-content-soft">{row.daysToExpiry===null?'No validated expiry':
                row.daysToExpiry<0?'Expired':row.daysToExpiry+'d remaining'}</span></td>
            <td className="p-3">{row.eligible?
              <span className="text-sage-700">Eligible · approved</span>:
              <span className="text-warning-strong" title={row.issues.join('; ')}>
                {row.issues[0]??'Review required'}{row.issues.length>1?' +'+(row.issues.length-1):''}
              </span>}</td>
          </tr>)}
        </tbody>
      </table>
      {!shown.length&&<p className="p-4 text-[12px] text-content-soft">No records in this view.</p>}
      {shown.length>100&&<p className="p-3 text-[10px] text-content-soft">
        First 100 displayed; open the operational register for all loaded records.
      </p>}
    </div>
  </section>
}
function AgentPanel({
  report,busy,error,onRun,onNavigate,onSource,
}:{
  report:ReserveAgentReport|null;busy:boolean;error:string|null
  onRun:()=>void;onNavigate:(type:Register)=>void
  onSource:(commodity:string|null)=>void
}){
  const findings=report?.findings??[]
  const route=(action:string,commodity:string|null)=>{
    if(action==='procurement'){
      return <Link href="/dashboard/procurement" className="text-[11px] font-semibold text-sage-700 underline">
        Review procurement <ArrowRight className="ms-1 inline h-3 w-3"/>
      </Link>
    }
    if(action==='sources')return <button type="button" onClick={()=>onSource(commodity)}
      className="text-[11px] font-semibold text-sage-700 underline">Inspect verified sources</button>
    return <button type="button" onClick={()=>onNavigate(action as Register)}
      className="text-[11px] font-semibold text-sage-700 underline">Open {action} register</button>
  }
  return <section id="reserve-agent" className="nfii-panel p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-cream-100 p-2.5"><Bot className="h-5 w-5 text-sage-700"/></span>
        <div>
          <h3 className="text-[16px] font-semibold text-content">Reserve Intelligence Agent</h3>
          <p className="mt-1 max-w-[80ch] text-[12px] leading-relaxed text-content-soft">
            On-demand, rule-based decision agent. Checks inventory evidence, FEFO, release commitments,
            and reserve coverage against independently reviewed 30-day consumption when available.
            It does not execute releases, approve records, order goods, or generate synthetic data.
          </p>
        </div>
      </div>
      <button type="button" disabled={busy} onClick={onRun} className="nfii-button disabled:opacity-50">
        {busy?<RefreshCw className="h-4 w-4 animate-spin"/>:<Bot className="h-4 w-4"/>}
        {busy?'Checking live evidence…':report?'Run updated analysis':'Run reserve agent'}
      </button>
    </div>
    {!report&&!busy&&!error&&<div className="mt-4 rounded-lg border border-line bg-muted/20 p-4">
      <p className="text-[12px] font-medium text-content">No agent analysis has been run.</p>
      <p className="mt-1 text-[11px] text-content-soft">
        Run the agent to inspect actual organization records. Conclusions appear only after execution.
      </p>
    </div>}
    {error&&<p role="alert" className="mt-4 rounded-md border border-warning-line p-3 text-[12px] text-critical">
      {error}</p>}
    {report&&<div className="mt-5 space-y-5">
      <div className="rounded-lg border border-line-accent bg-cream-100/20 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sage-700">Agent decision · human review required</p>
        <p className="mt-2 text-[16px] font-semibold text-content">{report.decision}</p>
        <p className="mt-1 text-[12px] text-content-soft">{report.decisionReason}</p>
        <p className="mt-2 text-[10px] text-content-soft">
          Evaluated {new Date(report.generatedAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}
          {' · '}read-only screening · no action was executed
          {report.partial?' · PARTIAL LEDGER: TOTALS INCOMPLETE':''}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {report.checks.map(check=><div key={check.id} className="rounded-lg border border-line bg-background p-3">
          <p className="text-[10px] text-content-soft">{check.title}</p>
          <p className="mt-2 text-[18px] font-semibold tabular-nums">{check.findingCount}
            <span className="ms-1 text-[10px] font-normal text-content-soft">findings</span></p>
        </div>)}
      </div>
      <div>
        <h4 className="text-[13px] font-semibold text-content">Proposed next actions · {findings.length}</h4>
        <p className="mt-1 text-[11px] text-content-soft">
          Each recommendation is traceable to a loaded lot, review state, or reviewed consumption record.
          Priorities are screening rules, not probabilities.
        </p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {findings.slice(0,18).map(item=><div key={item.id}
            className="rounded-lg border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <h5 className="text-[12px] font-semibold text-content">{item.title}</h5>
              <span className={'shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase '+severityCss[item.severity]}>
                {item.severity}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-content-soft">{item.explanation}</p>
            <p className="mt-2 text-[11px] font-medium text-content">{item.nextStep}</p>
            <p className="mt-2 text-[10px] text-content-soft">{item.evidence.join(' · ')}</p>
            <div className="mt-3">{route(item.action,item.commodityCode)}</div>
          </div>)}
          {findings.length===0&&<p className="rounded-lg border border-line p-3 text-[12px] text-content-soft">
            No rule threshold was triggered in the loaded records. This is not a safety guarantee.
          </p>}
        </div>
        {findings.length>18&&<p className="mt-2 text-[11px] text-content-soft">
          {findings.length-18} additional findings not shown; prioritize source reconciliation in the operational register.
        </p>}
      </div>
      <div className="rounded-lg border border-line p-3">
        <h4 className="text-[13px] font-semibold text-content">Reserve days of cover · organization demand only</h4>
        <p className="mt-1 text-[11px] text-content-soft">
          Uncommitted reserve lots divided by independently reviewed average daily consumption.
          This is a reference ratio, NOT the national food-security balance and NOT a demand forecast.
          A missing or zero-consumption baseline gives N/A, never zero days.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-[11px]">
            <thead><tr className="border-b border-line text-content-soft">
              <th className="p-2 text-start">Commodity</th>
              <th className="p-2 text-end">Uncommitted (t)</th>
              <th className="p-2 text-end">Verified demand (t/day)</th>
              <th className="p-2 text-end">Reserve cover (days)</th>
              <th className="p-2 text-end">Evidence</th>
            </tr></thead>
            <tbody>{report.coverage.map(row=><tr key={row.commodityCode} className="border-b border-line/60">
              <td className="p-2 font-medium">{row.commodityName}</td>
              <td className="p-2 text-end tabular-nums">{amount(row.uncommittedTonnes)}</td>
              <td className="p-2 text-end tabular-nums">{amount(row.dailyDemand)}</td>
              <td className="p-2 text-end tabular-nums">{amount(row.days)}</td>
              <td className="p-2 text-end">{row.sourceRefs.length?row.sourceRefs.length+' reviewed refs':'Unverified'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>}
  </section>
}

export function StrategicReservesCommand({
  organizationId,snapshot,today,truncated,canEdit,onOpenRegister,onRefresh,
}:Props){
  const router=useRouter()
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const portfolio=useMemo(()=>snapshot?buildReservePortfolio(snapshot,today,truncated):null,
    [snapshot,today,truncated])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [report,setReport]=useState<ReserveAgentReport|null>(null)
  const abortRef=useRef<AbortController|null>(null)
  useEffect(()=>{
    // A changed tenant, as-of date, source or ledger invalidates the prior decision.
    abortRef.current?.abort()
    setReport(null);setBusy(false);setError(null)
    return ()=>abortRef.current?.abort()
  },[organizationId,portfolio])
  async function run(){
    if(!organizationId||!snapshot||!portfolio||busy)return
    abortRef.current?.abort()
    const abort=new AbortController()
    abortRef.current=abort
    setReport(null);setError(null);setBusy(true)
    try{
      const codes=portfolio.commodities.map(c=>c.id).filter(code=>Boolean(resolveCommodity(code)))
      // Nine known commodities maximum, from the actual lot registry only.
      const results=await Promise.all(codes.map(async code=>{
        try{
          const params=new URLSearchParams({organizationId,commodityId:code,days:'30',mode:'live',from:today})
          const res=await fetch('/api/food-security/balance?'+params,{
            cache:'no-store',signal:abort.signal,
          })
          if(!res.ok)return null
          const json=await res.json() as {balance?:FoodBalanceResult;dataSource?:string}
          const b=json.balance
          if(json.dataSource!=='LIVE'||!b||b.sourceMode!=='live'||
            b.commodityId!==code||b.days!==30||b.status!=='complete'||
            b.totals.consumptionTonnes===null)return null
          return {commodityCode:code,consumptionTonnes:b.totals.consumptionTonnes,
            days:b.days,sourceRefs:b.evidence.sourceRefs,
            periodStart:b.fromDate,periodEnd:b.toDate} satisfies VerifiedReserveDemand
        }catch{return null} // Provider failure => unknown, never fallback to demo.
      }))
      if(abort.signal.aborted)return
      const sources=results.filter((x):x is VerifiedReserveDemand=>x!==null)
      setReport(runReserveAgent(portfolio,sources,new Date().toISOString()))
    }catch(err){
      if(!abort.signal.aborted)setError(err instanceof Error?err.message:'Reserve analysis unavailable')
    }finally{if(!abort.signal.aborted)setBusy(false)}
  }
  if(!portfolio)return <section className="nfii-panel p-5" role="status">
    <div className="flex items-start gap-3">
      <Database className="mt-1 h-5 w-5 text-content-soft"/>
      <div>
        <h2 className="text-[15px] font-semibold text-content">
          {tx('Verified reserve ledger unavailable','سجل الاحتياطي الموثق غير متاح')}
        </h2>
        <p className="mt-1 text-[12px] text-content-soft">
          {tx('Select an authorized organization or restore its operations database. No inventory figures, charts or agent decisions are manufactured.',
            'اختر مؤسسة مصرحاً لها أو استعد اتصال قاعدة البيانات. لا تُنشأ أرقام مخزون أو رسوم أو قرارات مصطنعة.')}
        </p>
      </div>
    </div>
  </section>

  const cards=[
    {name:'On-hand eligible',ar:'مخزون مسجل مؤهل',value:portfolio.onHandTonnes,unit:'t',
      note:'Approved, unexpired, traceable lots'},
    {name:'Uncommitted reserve',ar:'احتياطي غير مخصص',value:portfolio.uncommittedTonnes,unit:'t',
      note:'After approved unexecuted releases'},
    {name:'Expiring ≤30 days',ar:'ينتهي خلال 30 يوماً',value:portfolio.expiring30Tonnes,unit:'t',
      note:'Included in eligible on-hand above'},
    {name:'Approved warehouses',ar:'مستودعات معتمدة',value:portfolio.warehouses,unit:'',
      note:'Organization records only'},
    {name:'Open release requests',ar:'طلبات صرف معلقة',value:portfolio.pendingReleaseRequests,unit:'',
      note:'Pending independent approval'},
    {name:'Lots withheld',ar:'دفعات مستبعدة',value:portfolio.unverifiedLots,unit:'',
      note:'Pending, expired or missing evidence'},
  ]
  const registered=portfolio.totalLotRecords>0
  return <div className="space-y-4">
    <div className="nfii-panel flex flex-wrap items-start justify-between gap-3 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-700">
          Reserve command · organizational operations
        </p>
        <h2 className="mt-1 text-[19px] font-semibold text-content">Inventory readiness & release control</h2>
        <p className="mt-1 max-w-[85ch] text-[12px] leading-relaxed text-content-soft">
          One source-backed view of warehouse holdings, batch expiries, allocations and approval workload.
          Administrative reserve lots are NOT added to the national food balance.
        </p>
        <p className="mt-2 text-[10px] text-content-soft">
          Snapshot {portfolio.asOfDate} (Asia/Qatar) · {portfolio.totalLotRecords} loaded lots · read-only analytics
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRefresh} className="nfii-button nfii-button-secondary">
          <RefreshCw className="h-4 w-4"/> Refresh data
        </button>
        <button type="button" onClick={()=>onOpenRegister('lots')} className="nfii-button">
          <PackageCheck className="h-4 w-4"/> Manage lots
        </button>
      </div>
    </div>
    {portfolio.partial&&<div role="alert" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-warning-strong">
      <AlertTriangle className="me-2 inline h-4 w-4"/>
      Partial operational ledger: {portfolio.truncated.join(', ')} exceeded the 150-row display cap.
      Graph totals and agent decisions cannot be interpreted as complete inventory.
    </div>}
    {!registered&&<div className="rounded-lg border border-line p-4 text-[12px] text-content-soft">
      No lots are registered in this organization&apos;s accessible ledger. This is not proof of zero physical
      stock. Add documented shipments, approved warehouses and reserve lots before drawing inventory conclusions.
      {canEdit&&<button className="ms-2 font-semibold text-sage-700 underline" type="button"
        onClick={()=>onOpenRegister('warehouses')}>Open warehouse registration</button>}
    </div>}
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      aria-label="Reserve command key indicators">
      {cards.map(card=><div key={card.name} className="nfii-kpi min-w-0">
        <p className="nfii-label">{tx(card.name,card.ar)}</p>
        <p className="mt-3 text-[23px] font-semibold tabular-nums text-content">
          {registered||card.unit===''?amount(card.value):'—'}
          {card.unit&&<span className="ms-1 text-[11px] font-normal text-content-soft">{card.unit}</span>}
        </p>
        <p className="mt-2 text-[10px] text-content-soft">{card.note}</p>
      </div>)}
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="nfii-panel p-4 md:p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sage-700"/>
          <h3 className="text-[14px] font-semibold text-content">Reserve allocation</h3>
        </div>
        <p className="mt-1 text-[11px] text-content-soft">
          Eligible lot balances after executed releases, split by approved outstanding commitments.
        </p>
        <div className="mt-3"><StockMix physical={portfolio.onHandTonnes}
          committed={portfolio.committedTonnes} free={portfolio.uncommittedTonnes}/></div>
        {portfolio.excludedRecordedTonnes>0&&<p className="mt-2 text-[11px] text-warning-strong">
          {amount(portfolio.excludedRecordedTonnes)} t recorded in excluded lots
          ({amount(portfolio.expiredRecordedTonnes)} t already expired), NOT included above.
        </p>}
      </section>
      <section className="nfii-panel p-4 md:p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-sage-700"/>
          <h3 className="text-[14px] font-semibold text-content">Expiry exposure</h3>
        </div>
        <p className="mt-1 text-[11px] text-content-soft">
          Tonnes by days remaining until batch expiry. FEFO is prioritized by real expiry dates.
        </p>
        <ExpiryChart buckets={portfolio.expiryBuckets} total={portfolio.onHandTonnes}/>
      </section>
      <section className="nfii-panel p-4 md:p-5">
        <div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-sage-700"/>
          <h3 className="text-[14px] font-semibold text-content">Warehouse distribution</h3></div>
        <p className="mt-1 text-[11px] text-content-soft">
          Usable eligible lots by registered warehouse; shared tonnes are not counted twice.
        </p>
        <BarGroups rows={portfolio.warehouseGroups} label="Eligible reserve inventory by warehouse"/>
      </section>
      <section className="nfii-panel p-4 md:p-5">
        <div className="flex items-center gap-2"><Database className="h-4 w-4 text-sage-700"/>
          <h3 className="text-[14px] font-semibold text-content">Commodity composition</h3></div>
        <p className="mt-1 text-[11px] text-content-soft">
          Actual inventory by crop or food commodity, not projected demand or supplier contracts.
        </p>
        <BarGroups rows={portfolio.commodities} label="Eligible reserve inventory by commodity"/>
      </section>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      <button type="button" onClick={()=>onOpenRegister('warehouses')}
        className="nfii-panel flex items-center justify-between gap-3 p-4 text-start hover:border-line-accent">
        <span><strong className="block text-[12px] text-content">Warehouses</strong>
          <span className="mt-1 block text-[11px] text-content-soft">Locations, approvals and linked batches</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-sage-700"/>
      </button>
      <button type="button" onClick={()=>onOpenRegister('releases')}
        className="nfii-panel flex items-center justify-between gap-3 p-4 text-start hover:border-line-accent">
        <span><strong className="block text-[12px] text-content">Release requests</strong>
          <span className="mt-1 block text-[11px] text-content-soft">Outstanding {portfolio.pendingReleaseRequests} · committed {amount(portfolio.committedTonnes)} t</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-sage-700"/>
      </button>
      <button type="button" onClick={()=>onOpenRegister('approvals')}
        className="nfii-panel flex items-center justify-between gap-3 p-4 text-start hover:border-line-accent">
        <span><strong className="block text-[12px] text-content">Independent approvals</strong>
          <span className="mt-1 block text-[11px] text-content-soft">{portfolio.pendingApprovals} reserve reviews awaiting sign-off</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-sage-700"/>
      </button>
    </div>
    <LotRows lots={portfolio.lots} onOpen={()=>onOpenRegister('lots')}/>
    <AgentPanel report={report} busy={busy} error={error}
      onRun={()=>void run()} onNavigate={onOpenRegister}
      onSource={commodity=>{
        const params=new URLSearchParams({module:'commodities',view:'sources'})
        if(commodity)params.set('commodityId',commodity)
        router.push('/dashboard?'+params.toString())
      }}/>
    <p className="text-[11px] text-content-soft">
      Readiness is derived only from this organization&apos;s loaded, approved ledger records.
      Stock quantities are lot administrative entries and are not reconciled to physical sensor counts,
      customs telemetry, national reserves, or other organizations. No fabricated historical chart is shown.
    </p>
  </div>
}
