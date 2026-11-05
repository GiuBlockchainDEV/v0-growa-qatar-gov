'use client'
import {useEffect,useMemo,useState} from 'react'
import {AlertTriangle,CalendarDays,RefreshCcw,ShieldAlert} from 'lucide-react'
import {
 analyzeUtilityPressure,historyPressureUrl,PRESSURE_REGIONS,
 type PressureWindow,type PressurePoint,
} from '@/lib/analytics/qatar-utility-pressure'
import type {UtilityDomain} from '@/lib/analytics/qatar-utilities'
import type {WeatherHistory} from '@/lib/weather/operational-screen'

const number=(value:number|null,digits=1)=>value===null?'N/A':
 value.toLocaleString('en-US',{maximumFractionDigits:digits})
const localTime=(timestamp:string)=>new Date(timestamp).toLocaleString('en-GB',{
 timeZone:'Asia/Qatar',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',
})
function Chart({points,unit}:{points:PressurePoint[];unit:string}){
 if(points.length<2)return <div className="grid h-56 place-items-center rounded-xl border border-dashed border-line p-5 text-center text-xs text-content-soft">
  Two or more timestamp-verified readings are required for a trend. Missing intervals are not filled.
 </div>
 const width=720,height=232,left=48,right=701,top=15,bottom=181
 const times=points.map(x=>Date.parse(x.at)),minT=Math.min(...times),maxT=Math.max(...times)
 const values=points.map(p=>p.value),low=Math.min(...values),high=Math.max(...values)
 const margin=Math.max((high-low)*.14,.35)
 const lower=Math.max(0,low-margin),upper=high+margin
 const px=(at:string)=>left+(Date.parse(at)-minT)/Math.max(1,maxT-minT)*(right-left)
 const py=(value:number)=>bottom-(value-lower)/Math.max(.01,upper-lower)*(bottom-top)
 const segments:PressurePoint[][]=[]
 for(const point of points){
  const last=segments.at(-1)?.at(-1)
  if(!last||Date.parse(point.at)-Date.parse(last.at)>9*3600000)segments.push([point])
  else segments.at(-1)!.push(point)
 }
 const highPoint=points.reduce((a,b)=>a.value>=b.value?a:b)
 return <div className="min-w-0">
  <svg className="h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img"
   aria-label={'Observed sampled '+unit+' trend with recorded peaks and gaps'}>
   {[0,.25,.5,.75,1].map(f=><g key={f}>
    <line x1={left} x2={right} y1={top+(bottom-top)*f} y2={top+(bottom-top)*f}
     stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5"/>
    <text x={left-7} y={top+(bottom-top)*f+4} textAnchor="end" fontSize="10"
     fill="currentColor" opacity=".72">{number(upper-(upper-lower)*f,1)}</text>
   </g>)}
   {segments.map((segment,i)=>segment.length>1?
    <polyline key={i} points={segment.map(p=>px(p.at)+','+py(p.value)).join(' ')}
     fill="none" stroke="#618b73" strokeWidth="3" strokeLinejoin="round"/>:null)}
   {points.map(p=><g key={p.at}>
    <circle cx={px(p.at)} cy={py(p.value)} r={p.at===highPoint.at?6:3.5}
     fill={p.severity==='high'?'#c65c40':p.severity==='watch'?'#d1a43f':'#618b73'}
     stroke="#f7f8f4" strokeWidth="1"><title>{localTime(p.at)} · {number(p.value,2)} {unit}</title></circle>
   </g>)}
   <text x={left} y={height-12} fill="currentColor" fontSize="11">{localTime(points[0].at)}</text>
   <text x={right} y={height-12} textAnchor="end" fill="currentColor" fontSize="11">{localTime(points.at(-1)!.at)}</text>
  </svg>
  <p className="text-[10px] text-content-soft">Gaps are preserved. Colored points denote screening thresholds, not measured infrastructure incidents.</p>
 </div>
}
export function UtilityPressureMonitor({domain}:{domain:UtilityDomain}){
 const [window,setWindow]=useState<PressureWindow>('daily')
 const [region,setRegion]=useState<(typeof PRESSURE_REGIONS)[number]['id']>('doha')
 const [reload,setReload]=useState(0)
 const [history,setHistory]=useState<WeatherHistory[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const selected=PRESSURE_REGIONS.find(x=>x.id===region)??PRESSURE_REGIONS[0]
 useEffect(()=>{
  const controller=new AbortController()
  let active=true
  setLoading(true);setError('');setHistory([])
  void (async()=>{
   try{
    const response=await fetch(historyPressureUrl(selected,window),{
     cache:'no-store',signal:controller.signal,
    })
    if(!response.ok)throw Error('Weather history HTTP '+response.status)
    const body=await response.json() as {points?:WeatherHistory[]}
    if(!Array.isArray(body.points))throw Error('Weather history schema unavailable')
    if(active)setHistory(body.points)
   }catch(cause){
    if(active&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Source unavailable')
   }finally{if(active)setLoading(false)}
  })()
  return()=>{active=false;controller.abort()}
 },[selected,window,reload])
 const analysis=useMemo(()=>analyzeUtilityPressure(history,domain,window),[history,domain,window])
 return <section className="rounded-2xl border border-line bg-card p-5" aria-label={domain+' daily and weekly pressure trends'}>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    {domain==='water'&&<h2 className="mt-2 text-xl font-bold">Daily & weekly peaks, trends and criticalities</h2>}
    <p className="mt-1 text-xs text-content-soft">Source-backed weather observations, not national {domain==='water'?'water withdrawals (m³)':'electricity demand (MW)'}.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>setWindow('daily')} aria-pressed={window==='daily'}
     className={'rounded-lg border px-3 py-2 text-xs '+(window==='daily'?'bg-ink text-white':'border-line')}>Daily · 24 h</button>
    <button type="button" onClick={()=>setWindow('weekly')} aria-pressed={window==='weekly'}
     className={'rounded-lg border px-3 py-2 text-xs '+(window==='weekly'?'bg-ink text-white':'border-line')}>Weekly · 7 d</button>
    <button type="button" onClick={()=>setReload(x=>x+1)} aria-label="Refresh historical pressure observations"
     className="rounded-lg border border-line p-2"><RefreshCcw size={16}/></button>
   </div>
  </div>
  <div className="mt-4 flex flex-wrap gap-2">
   {PRESSURE_REGIONS.map(point=><button key={point.id} type="button"
    onClick={()=>setRegion(point.id)} aria-pressed={region===point.id}
    className={'rounded-full border px-3 py-1.5 text-[11px] '+(region===point.id?'border-ink bg-ink text-white':'border-line')}>
    {point.label}</button>)}
  </div>
  <p className="mt-3 text-[11px] text-content-soft">{analysis.label} · {window==='daily'?'Hourly samples':'One sample every seven hours'} · Qatar local time (UTC+3)</p>
  {error&&<p className="mt-3 rounded-xl border border-line p-3 text-xs" role="alert">Source not available: {error}. Missing readings are not replaced by estimates.</p>}
  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
   {[
    ['Observed peak',analysis.peak?number(analysis.peak.value,2)+' '+analysis.unit:'N/A',analysis.peak?localTime(analysis.peak.at):'No verified peak'],
    ['Sample mean',number(analysis.average,2)+(analysis.average===null?'':' '+analysis.unit),analysis.observed+' / '+analysis.expected+' usable observations'],
    ['Start → end change',analysis.changePct===null?'N/A':(analysis.changePct>0?'+':'')+number(analysis.changePct,1)+'%', 'Sampled interval, not a national load trend'],
    ['Elevated observations',String(analysis.highCount+analysis.watchCount),analysis.highCount+' high · '+analysis.watchCount+' watch'],
   ].map(([label,value,note])=><div key={label} className="rounded-xl border border-line bg-background p-3">
    <div className="text-[10px] font-semibold text-content-soft">{label}</div>
    <strong className="mt-1 block text-xl tabular-nums">{value}</strong>
    <div className="mt-1 text-[10px] text-content-soft">{note}</div>
   </div>)}
  </div>
  <div className="mt-4">{loading?<div className="grid h-56 place-items-center text-xs">Loading observed trends…</div>:
   <Chart points={analysis.points} unit={analysis.unit}/>}</div>
  {window==='weekly'&&analysis.dailyPeaks.length>0&&<div className="mt-3">
   <h3 className="flex items-center gap-2 text-xs font-bold"><CalendarDays size={14}/> Daily observed sample peaks</h3>
   <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
    {analysis.dailyPeaks.map(day=><div key={day.date} className="rounded-lg border border-line p-2">
     <div className="text-[10px] text-content-soft">{day.date}</div>
     <strong className="text-sm">{number(day.peak.value,2)} {analysis.unit}</strong>
     <div className="text-[9px] text-content-soft">{day.count} samples</div>
    </div>)}
   </div>
  </div>}
  <div className="mt-5 border-t border-line pt-4">
   <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={16}/> Criticalities & monitoring gaps</h3>
   <div className="mt-3 grid gap-2 md:grid-cols-2">
    {(loading?[]:analysis.issues).map(issue=><div key={issue.id} className="rounded-xl border border-line p-3">
     <div className="flex items-center gap-2 text-xs font-semibold">
      <AlertTriangle size={14} color={issue.severity==='high'?'#bd5a3d':'#b78b2c'}/>{issue.title}
     </div>
     <p className="mt-1 text-[11px] leading-5 text-content-soft">{issue.detail}</p>
     {issue.at&&<small className="text-[10px] text-content-soft">{localTime(issue.at)}</small>}
    </div>)}
    {!loading&&!analysis.issues.length&&<div className="text-xs text-content-soft">No threshold exceedance in the available sample. This is not proof of zero operational risk.</div>}
   </div>
  </div>
  <p className="mt-4 text-[10px] leading-5 text-content-soft">
   Source: {analysis.dataSource??'Growa Weather API (timestamp-verified records when available)'}.
   This view screens atmospheric {domain==='water'?'drying demand through VPD':'cooling demand through ambient temperature'}.
   Peaks are maxima of observed samples, not continuous maxima.
   Exact national daily water throughput and electricity MW peaks require authorized KAHRAMAA time-series feeds.
  </p>
 </section>
}
