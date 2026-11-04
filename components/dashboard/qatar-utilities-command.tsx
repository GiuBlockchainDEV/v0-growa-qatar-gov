'use client'

import {useEffect,useMemo,useState} from 'react'
import {BarChart3,BookOpen,Database,Droplets,ExternalLink,
 RefreshCcw,ShieldAlert,ShieldCheck,SlidersHorizontal,Sparkles,Zap} from 'lucide-react'
import {GrowaIntelligencePanel} from '@/components/dashboard/growa-intelligence-panel'
import {buildUtilityAiContext} from '@/lib/analytics/qatar-utility-agent-context'
import {findSeries,latestPoint,utilityFindings,utilityScenario,yearChange,
 type UtilityDomain,type UtilitySnapshot,type UtilitySeries} from '@/lib/analytics/qatar-utilities'

type View='overview'|'signals'|'scenario'|'sources'
const labels={
 water:{head:'Water',accent:'Security',tail:'Command Center',eyebrow:'NATIONAL WATER INTELLIGENCE',
  description:'A strategic view of Qatar’s desalination-led potable supply, groundwater abstraction, real network losses and treated-water reuse.',
  prompt:'What is driving water security in Qatar?'},
 energy:{head:'Energy',accent:'Resilience',tail:'Command Center',eyebrow:'NATIONAL ENERGY INTELLIGENCE',
  description:'Explore Qatar’s electricity generation, national peak demand, load factors and the renewable share of final energy, without confusing their units.',
  prompt:'Where is pressure building in the power system?'},
} as const
const metrics={
 water:[
  {id:'production_mm3',short:'POTABLE PRODUCTION'},
  {id:'groundwater_mm3',short:'GROUNDWATER ABSTRACTION'},
  {id:'losses_pct',short:'NETWORK LOSSES'},
  {id:'water_tse_reuse_mm3',short:'TREATED WATER REUSE'},
 ],
 energy:[
  {id:'generation_gwh',short:'ELECTRICITY GENERATED'},
  {id:'peak_mw',short:'MAXIMUM GRID DEMAND'},
  {id:'renewable_final_energy_pct',short:'RENEWABLE FINAL ENERGY'},
  {id:'load_factor_system',short:'SYSTEM LOAD FACTOR'},
 ],
} as const
const number=(n:number|null|undefined,precision=1)=>
 n===null||n===undefined||!Number.isFinite(n)?'N/A':
 n.toLocaleString('en-US',{maximumFractionDigits:precision})
function LinkTo({url,children}:{url:string;children:React.ReactNode}){
 return <a href={url} target="_blank" rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage-700 underline underline-offset-2">
  {children}<ExternalLink size={12}/></a>
}
function AnnualLine({series}:{series:UtilitySeries|null}){
 const [selectedYear,setSelectedYear]=useState<number|null>(null)
 const points=series?.points??[]
 if(points.length<2)return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-line p-4 text-center text-xs text-content-soft">
  At least two verified annual observations are needed to draw the series. No values have been interpolated.
 </div>
 const chosen=points.find(p=>p.year===selectedYear)??points.at(-1)!
 const width=630,height=180,xmin=25,xmax=600,ymin=18,ymax=149
 const years=points.map(p=>p.year),lowYear=Math.min(...years),highYear=Math.max(...years)
 const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value))
 const x=(year:number)=>xmin+(year-lowYear)/Math.max(1,highYear-lowYear)*(xmax-xmin)
 const y=(value:number)=>ymax-(value-low)/Math.max(.001,high-low)*(ymax-ymin)
 const segments:(typeof points)[]=[]
 let group:typeof points=[]
 for(const p of points){
  if(group.length&&p.year-group.at(-1)!.year>1){segments.push(group);group=[]}
  group.push(p)
 }
 if(group.length)segments.push(group)
 return <div className="min-w-0">
  <div className="flex flex-wrap items-baseline gap-2 py-3">
   <strong className="text-4xl font-bold tabular-nums">{number(chosen.value,2)}</strong>
   <span className="text-xs text-content-soft">{series?.unit}</span>
   <span className="ms-auto text-xs text-content-soft">Selected year: <strong>{chosen.year}</strong></span>
  </div>
  <svg viewBox={`0 0 ${width} ${height}`} role="img"
   aria-label={series?.label+' annual published series'} className="h-auto w-full">
   {[0,.25,.5,.75,1].map(t=><line key={t} x1={xmin} x2={xmax}
    y1={ymin+(ymax-ymin)*t} y2={ymin+(ymax-ymin)*t}
    stroke="currentColor" strokeOpacity=".14" strokeDasharray="3 5"/>)}
   {segments.map((segment,i)=><polyline key={i}
    points={segment.map(p=>x(p.year)+','+y(p.value)).join(' ')}
    fill="none" stroke="#86a974" strokeWidth="3.5" strokeLinecap="round"/>)}
   <line x1={x(chosen.year)} x2={x(chosen.year)} y1={ymin}
    y2={ymax} stroke="#537a52" strokeDasharray="4 4" opacity=".7"/>
   {points.map(p=><g key={p.year}>
    <circle cx={x(p.year)} cy={y(p.value)} r={chosen.year===p.year?7:4}
     fill={chosen.year===p.year?'#d6e8c1':'#86a974'} pointerEvents="none"/>
    <circle cx={x(p.year)} cy={y(p.value)} r="15"
     fill="transparent" role="button" tabIndex={0}
     aria-label={`${p.year}: ${number(p.value,2)} ${series?.unit}`}
     aria-pressed={chosen.year===p.year}
     className="cursor-pointer focus:outline-none"
     onClick={()=>setSelectedYear(p.year)}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedYear(p.year)}}}>
     <title>{p.year}: {number(p.value,2)} {series?.unit}</title>
    </circle>
   </g>)}
  </svg>
  <div className="flex justify-between text-[10px] text-content-soft">
   <span>{lowYear}</span><span>Select a point to inspect the published value</span><span>{highYear}</span>
  </div>
  <p className="mt-4 text-[11px] leading-5 text-content-soft">{series?.description}</p>
  {series&&<div className="mt-2"><LinkTo url={series.sourceUrl}>View original national dataset</LinkTo></div>}
 </div>
}
export function QatarUtilitiesCommand({domain}:{domain:UtilityDomain}){
 const [data,setData]=useState<UtilitySnapshot|null>(null)
 const [peer,setPeer]=useState<UtilitySnapshot|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState<string|null>(null)
 const [version,setVersion]=useState(0)
 const [view,setView]=useState<View>('overview')
 const [selectedId,setSelectedId]=useState('')
 const [scenarioPct,setScenarioPct]=useState(2)
 const [assessed,setAssessed]=useState(false)
 const title=labels[domain]
 useEffect(()=>{
  let active=true;const controller=new AbortController()
  setLoading(true);setError(null);setData(null);setPeer(null);setAssessed(false)
  const get=async(which:UtilityDomain)=>{
   const r=await fetch('/api/analytics/qatar-utilities?domain='+which,
    {cache:'no-store',signal:controller.signal})
   if(!r.ok)throw Error('National '+which+' sources unavailable: HTTP '+r.status)
   const result=await r.json() as UtilitySnapshot
   if(result.scope!=='qatar-national'||result.domain!==which||
    !Array.isArray(result.sources)||!Array.isArray(result.series))
    throw Error('Invalid national utility response')
   return result
  }
  void Promise.allSettled([get(domain),get(domain==='water'?'energy':'water')])
   .then(results=>{
    if(!active)return
    if(results[0].status==='fulfilled')setData(results[0].value)
    else setError(results[0].reason instanceof Error?results[0].reason.message:'Source failure')
    if(results[1].status==='fulfilled')setPeer(results[1].value)
    setLoading(false)
   })
  return ()=>{active=false;controller.abort()}
 },[domain,version])
 const chartId=selectedId||(metrics[domain][0].id)
 const chart=findSeries(data,chartId)
 const findings=useMemo(()=>utilityFindings(data),[data])
 const scenario=useMemo(()=>utilityScenario(data,scenarioPct),[data,scenarioPct])
 const assistant=useMemo(()=>data?buildUtilityAiContext(data,peer,scenarioPct):null,[data,peer,scenarioPct])
 const primary=latestPoint(findSeries(data,metrics[domain][0].id))
 const primarySeries=findSeries(data,metrics[domain][0].id)
 const change=yearChange(primarySeries)
 const otherPrimary=findSeries(peer,domain==='water'?'generation_gwh':'production_mm3')
 const sourceCount=data?.sources.filter(s=>s.status==='available').length??0
 const tabs:[View,string][]=[['overview','Country overview'],['signals','National signals'],
  ['scenario','Decision laboratory'],['sources','Evidence & sources']]
 return <section className="flex min-w-0 flex-col gap-4" aria-label={'Qatar national '+domain+' intelligence'}>
  <div className="overflow-hidden rounded-[22px] bg-ink text-white shadow-panel">
   <div className="grid gap-5 bg-[radial-gradient(ellipse_at_85%_10%,rgba(140,177,117,.24),transparent_65%)] p-6 lg:grid-cols-[1.6fr_0.7fr] lg:p-8">
    <div>
     <span className="flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-cream-200">
      {domain==='water'?<Droplets size={16}/>:<Zap size={16}/>} GROWA · {title.eyebrow}
     </span>
     <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
      {title.head} <span className="font-normal text-cream-200">{title.accent}</span>
      <span className="mt-1 block text-2xl font-medium sm:text-3xl">{title.tail}</span>
     </h1>
     <p className="mt-3 max-w-2xl text-xs leading-6 text-cream-100">{title.description}</p>
     <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
      <span className="rounded-full border border-white/20 px-3 py-2">KAHRAMAA + Qatar Open Data</span>
      <span className="rounded-full border border-white/20 px-3 py-2">Official annual observations</span>
      <span className="rounded-full border border-white/20 px-3 py-2">Not real-time telemetry</span>
     </div>
    </div>
    <div className="rounded-2xl border border-white/20 bg-white/5 p-5">
     <span className="text-[10px] font-bold tracking-wider text-cream-200">NATIONAL REFERENCE</span>
     <strong className="mt-3 block text-4xl font-bold tabular-nums">{loading?'…':number(primary?.value,0)}</strong>
     <p className="mt-2 text-xs text-cream-100">{primarySeries?.unit??'Source not available'}</p>
     <p className="mt-2 text-[11px] text-cream-100">{primary?.year??'N/A'} · {primarySeries?.label??'Awaiting official record'}</p>
     <p className="mt-4 text-xs font-medium text-cream-200">
      {change===null?'Year-on-year trend unavailable':(change>0?'+':'')+number(change,1)+'% versus previous year'}</p>
    </div>
   </div>
   <div className="grid border-t border-white/20 bg-white/5 sm:grid-cols-2 xl:grid-cols-4">
    {metrics[domain].map(m=>{
     const series=findSeries(data,m.id),latest=latestPoint(series)
     return <div key={m.id} className="min-w-0 border-b border-white/15 p-4 sm:border-e xl:border-b-0">
      <span className="text-[10px] font-bold tracking-wide text-cream-200">{m.short}</span>
      <strong className="mt-3 block text-3xl font-bold tabular-nums">{loading?'…':number(latest?.value,1)}</strong>
      <small className="mt-1 block text-[10px] text-cream-100">{latest?series?.unit:'No verified observation'}</small>
      <small className="mt-2 block text-[10px] text-cream-100">Source year: {latest?.year??'N/A'}</small>
     </div>
    })}
   </div>
  </div>
  <nav className="flex flex-wrap gap-2" aria-label="National utilities views">
   {tabs.map(([key,label])=><button key={key} type="button" aria-pressed={view===key}
    onClick={()=>setView(key)} className={'rounded-full border px-4 py-2.5 text-[11px] font-semibold '+
     (view===key?'border-ink bg-ink text-white':'border-line bg-card text-content')}>
    {label}</button>)}
  </nav>
  {(view==='overview'||view==='signals')&&<div className="grid min-w-0 gap-4 xl:grid-cols-2">
   <article className="min-w-0 rounded-2xl border border-line bg-card p-5">
    <div className="flex items-start justify-between gap-3">
     <div><span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><BarChart3 size={15}/> VERIFIED NATIONAL SERIES</span>
      <h2 className="mt-2 text-xl font-bold">{title.prompt}</h2>
      <p className="mt-2 text-[11px] text-content-soft">Published annual records. Click a chart point to inspect source, value and year.</p></div>
     <button onClick={()=>setVersion(n=>n+1)} disabled={loading} aria-label="Refresh national utility evidence"
      className="rounded-lg border border-line p-2"><RefreshCcw size={16}/></button>
    </div>
    <div className="my-4 flex flex-wrap gap-2">
     {[...metrics[domain].map(m=>({id:m.id,label:m.short})),
      ...(data?.series??[]).filter(s=>!metrics[domain].some(m=>m.id===s.id))
       .map(s=>({id:s.id,label:s.label}))].map(m=><button key={m.id} type="button"
      aria-pressed={chartId===m.id} onClick={()=>setSelectedId(m.id)}
      className={'rounded-full border px-3 py-2 text-[10px] font-semibold '+
       (chartId===m.id?'border-ink bg-ink text-white':'border-line text-content-soft')}>
      {m.label}</button>)}
    </div>
    {loading?<p className="p-7 text-xs">Loading national data…</p>:
      <AnnualLine key={chartId} series={chart}/>}
   </article>
   <article className="min-w-0 rounded-2xl border border-line bg-card p-5">
    <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><ShieldAlert size={15}/> EVIDENCE-BASED SCREENING</span>
    <h2 className="mt-2 text-xl font-bold">What needs attention?</h2>
    <p className="mt-2 text-[11px] leading-5 text-content-soft">Observed annual changes, not invented national risk probabilities.</p>
    <div className="mt-4 grid gap-3">
     {findings.slice(0,4).map((finding,i)=><div key={finding.id}
      className="rounded-xl border border-line bg-background p-4">
      <div className="flex justify-between gap-3 text-[10px] font-bold text-sage-700">
       <span>{String(i+1).padStart(2,'0')} · {finding.priority==='watch'?'REVIEW':'SOURCE SIGNAL'}</span>
       <span>{finding.year??'N/A'}</span>
      </div>
      <h3 className="mt-2 text-[13px] font-bold">{finding.title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">{finding.detail}</p>
      {finding.sourceUrl&&<div className="mt-2"><LinkTo url={finding.sourceUrl}>Evidence</LinkTo></div>}
     </div>)}
    </div>
   </article>
  </div>}
  {(view==='overview'||view==='scenario')&&<div className="grid gap-4 xl:grid-cols-2">
   <article className="rounded-2xl border border-line bg-card p-5">
    <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><Sparkles size={15}/> NATIONAL INTELLIGENCE ENGINE</span>
    <h2 className="mt-2 text-xl font-bold">Observe → Diagnose → Plan → Validate</h2>
    <p className="mt-2 text-[11px] leading-5 text-content-soft">Run an evidence screening. This is deterministic analysis, not an LLM-generated conclusion or an infrastructure control command.</p>
    <div className="mt-4 flex flex-wrap items-center gap-2">
     <button type="button" onClick={()=>setAssessed(true)}
      className="rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white">Run national screening</button>
     <span className="text-[10px] text-content-soft">{sourceCount}/{data?.sources.length??4} source groups responding with compatible values</span>
    </div>
    {assessed?<div className="mt-4 grid gap-2">
     {[['01','OBSERVE',sourceCount+' verified source groups examined'],
       ['02','DIAGNOSE',findings.length+' national evidence signals screened'],
       ['03','PLAN','Prioritize measurement and engineering investigations'],
       ['04','VALIDATE','Cross-check source years, definitions and real site readings']].map(([n,label,detail])=>
       <div key={n} className="flex gap-3 rounded-xl border border-line bg-background p-3">
        <strong className="text-xs text-sage-700">{n}</strong>
        <div><strong className="text-[11px]">{label}</strong>
         <p className="mt-1 text-[11px] text-content-soft">{detail}</p></div>
       </div>)}
    </div>:<div className="mt-4 rounded-xl border border-dashed border-line p-5 text-[11px] text-content-soft">Assessment not run. No pre-generated agent decision is displayed.</div>}
   </article>
   <article className="rounded-2xl border border-line bg-card p-5">
    <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><SlidersHorizontal size={15}/> DECISION LABORATORY</span>
    <h2 className="mt-2 text-xl font-bold">What could efficiency unlock?</h2>
    <p className="mt-2 text-[11px] leading-5 text-content-soft">Transparent sensitivity, not an engineering prediction or savings claim.</p>
    <div className="mt-4 flex justify-between text-sm"><strong>Assumed reduction</strong><strong>{scenarioPct.toFixed(1)}%</strong></div>
    <input className="mt-3 w-full accent-sage-700" type="range" min=".5" max="5" step=".5"
     value={scenarioPct} onChange={e=>setScenarioPct(Number(e.target.value))}
     aria-label="Illustrative resource reduction percentage"/>
    {scenario?<div className="mt-4 rounded-xl bg-cream-50 p-4">
     <p className="text-[10px] font-bold text-sage-700">{scenario.title} · {scenario.year}</p>
     <strong className="mt-2 block text-3xl font-bold">{number(scenario.value,2)}</strong>
     <p className="text-[11px] text-content-soft">{scenario.unit}</p>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">{scenario.note}</p>
     <div className="mt-2"><LinkTo url={scenario.sourceUrl}>Calculation baseline</LinkTo></div>
    </div>:<p className="mt-4 rounded-xl border border-dashed border-line p-4 text-xs text-content-soft">Insufficient compatible national baseline to calculate a scenario.</p>}
    <div className="mt-4 border-t border-line pt-3">
     <strong className="text-xs">Water–energy–food nexus</strong>
     <p className="mt-2 text-xs text-content-soft">
      {domain==='water'?'National electricity generation':'Potable water production'}:
      {' '}<strong>{number(latestPoint(otherPrimary)?.value,1)}</strong> {otherPrimary?.unit??'No data'}
      {' '}· {latestPoint(otherPrimary)?.year??'N/A'}</p>
     <p className="mt-2 text-[10px] text-content-soft">National electricity generation is not desalination electricity consumption. No energy intensity is inferred without measured facility kWh/m³.</p>
    </div>
   </article>
  </div>}
  {(view==='overview'||view==='signals')&&<article className="rounded-2xl border border-line bg-card p-5">
   <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><Sparkles size={15}/> GROWA · NATIONAL AI ANALYST</span>
   <h2 className="mt-2 text-xl font-bold">Ask Growa across Qatar’s national resources</h2>
   <p className="mt-1 text-xs text-content-soft">Source-aware AI reasoning across national water, electricity and missing evidence. Not restricted to Growa farm records.</p>
   <div className="mt-4 h-[min(530px,58vh)] min-h-[390px]">
    <GrowaIntelligencePanel module={domain==='water'?'water-intelligence':'energy-intelligence'} context={assistant}/>
   </div>
  </article>}
  {view==='sources'&&<article className="rounded-2xl border border-line bg-card p-5">
   <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-sage-700"><Database size={15}/> DATA PROVENANCE</span>
   <h2 className="mt-2 text-xl font-bold">Evidence and published sources</h2>
   <p className="mt-2 text-xs text-content-soft">Each source is checked separately; an unavailable source does not count as zero national activity.</p>
   <div className="mt-4 grid gap-3">
    {(data?.sources??[]).map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-4">
     <div><strong className="text-xs">{s.label}</strong><p className="mt-1 text-[11px] text-content-soft">{s.note}</p></div>
     <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px]">{s.status} · {s.latestYear??'N/A'} · {s.count} records</span>
      <LinkTo url={s.url}>Dataset</LinkTo>
     </div>
    </div>)}
    {error&&<p role="alert" className="text-xs text-content-soft">{error}</p>}
   </div>
  </article>}
  <footer className="flex flex-wrap justify-between gap-3 px-1 text-[10px] text-content-soft">
   <span className="flex items-center gap-1"><BookOpen size={13}/> KAHRAMAA / Qatar Open Data · annual statistics</span>
   <span className="flex items-center gap-1"><ShieldCheck size={13}/> National records are not Growa client telemetry</span>
   {error&&<span>{error}</span>}
  </footer>
 </section>
}
