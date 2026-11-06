'use client'

import {useMemo,useState,type ReactNode} from 'react'
import {
 Activity,ArrowLeft,ArrowRight,BarChart3,CalendarDays,CheckCircle2,
 Database,Droplets,Layers3,Leaf,Loader2,Map as MapIcon,
 RefreshCw,ShieldAlert,Sprout,Target,Trash2,TrendingUp,
} from 'lucide-react'
import {Card} from '@/components/brand/layout'
import {StatusDot} from '@/components/brand/ui'
import {HARVEST_METRIC_META,formatHarvestMetricWithUnit} from '@/lib/harvest/metrics'
import type {
 HarvestAnalyticsField,HarvestFieldStatsResponse,HarvestMetricKey,HarvestMode,
 HarvestRasterResponse,HarvestTaskStatus,HarvestTimeseriesPoint,HarvestTrendGranularity,
} from '@/lib/harvest/types'

const METRICS:HarvestMetricKey[]=['npp','aeti','tbp','bwp','rwd','wcu','cost']
const MAP_METRICS:HarvestMetricKey[]=['npp','aeti','tbp','bwp','rwd']
const fmt=(n:number,d=1)=>n.toLocaleString('en-US',{maximumFractionDigits:d})
const dataNumber=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
const value=(field:HarvestAnalyticsField,key:HarvestMetricKey)=>{
 const n=field.metrics?.[key]
 return dataNumber(n)?n:null
}
const area=(m2:number)=>dataNumber(m2)&&m2>0?fmt(m2/10000,2)+' ha':'Area not reported'
const dateValue=(date:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null
 const timestamp=Date.parse(date+'T00:00:00Z')
 return Number.isFinite(timestamp)?timestamp:null
}
const displayDate=(str:string)=>{
 const timestamp=dateValue(str)
 if(timestamp===null)return 'Date unverified'
 return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(timestamp)
}
function ModelKpi({name,value:display,note,icon:Icon,mode}:{
 name:string;value:string;note:string;icon:typeof Activity;mode:HarvestMode
}){
 return <div className="rounded-xl border border-line bg-card p-4">
  <div className="flex items-center gap-2 text-[11px] text-content-soft">
   <Icon size={15} strokeWidth={1.5}/>{name}
  </div>
  <p className="growa-figure mt-3 text-content tabular-nums" style={{fontSize:'clamp(20px,2vw,28px)'}}>{display}</p>
  <p className="mt-2 text-[10px] leading-5 text-content-soft">{note} · {mode==='predict'?'Forecast':'Observed feed'}</p>
 </div>
}
function FieldTrendChart({points,metric,granularity}:{
 points:HarvestTimeseriesPoint[];metric:HarvestMetricKey;granularity:HarvestTrendGranularity
}){
 const [picked,setPicked]=useState<string|null>(null)
 const clean=useMemo(()=>points.filter(p=>dataNumber(p.value)&&p.period).sort((a,b)=>a.period.localeCompare(b.period)),[points])
 if(clean.length<2)return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-line bg-background p-5 text-center">
  <div><Database className="mx-auto size-6 text-content-soft" strokeWidth={1.5}/>
   <p className="mt-3 text-xs font-semibold">Not enough observations for this trend</p>
   <p className="mt-2 text-[11px] leading-5 text-content-soft">Select a different metric or period. No history has been invented to fill the gaps.</p>
  </div>
 </div>
 const active=clean.find(p=>p.period===picked)??clean.at(-1)!
 const index=clean.indexOf(active)
 const previous=clean[index-1]
 const change=previous&&previous.value!==0?(active.value-previous.value)/Math.abs(previous.value)*100:null
 const width=720,height=248,left=49,right=698,top=15,bottom=199
 const n=clean.map(p=>p.value),minValue=Math.min(...n),maxValue=Math.max(...n)
 const padding=Math.max(.01,(maxValue-minValue)*.18)
 const yMin=minValue-padding,yMax=maxValue+padding
 const x=(i:number)=>left+i/Math.max(1,clean.length-1)*(right-left)
 const y=(v:number)=>bottom-(v-yMin)/Math.max(.001,yMax-yMin)*(bottom-top)
 const loc=clean.map((p,i)=>[x(i),y(p.value)] as const)
 return <div>
  <div className="flex flex-wrap items-end justify-between gap-3">
   <div>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-content-soft">Selected point · {active.period}</p>
    <p className="growa-figure mt-1 text-[28px] tabular-nums">
     {formatHarvestMetricWithUnit(active.value,metric)}
    </p>
   </div>
   <div className="text-right">
    <p className="text-[10px] text-content-soft">Versus previous sample</p>
    <p className="mt-1 text-sm font-semibold tabular-nums">{change===null?'First observation':(change>0?'+':'')+fmt(change,1)+'%'}</p>
   </div>
  </div>
  <svg className="mt-3 w-full" viewBox={'0 0 '+width+' '+height} role="group"
   aria-label={'Interactive '+HARVEST_METRIC_META[metric].label+' field '+granularity+' trend'}>
   {[0,.25,.5,.75,1].map(t=><g key={t}>
    <line x1={left} x2={right} y1={top+t*(bottom-top)} y2={top+t*(bottom-top)} stroke="currentColor" strokeOpacity=".14" strokeDasharray="4 5"/>
    <text x={left-7} y={top+t*(bottom-top)+4} textAnchor="end" fontSize="10" fill="currentColor" opacity=".68">{fmt(yMax-t*(yMax-yMin),1)}</text>
   </g>)}
   <polyline points={loc.map(p=>p.join(',')).join(' ')} fill="none" stroke="var(--growa-sage)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
   <line x1={loc[index][0]} x2={loc[index][0]} y1={top} y2={bottom} stroke="var(--growa-ink)" opacity=".58" strokeDasharray="4 4" pointerEvents="none"/>
   {clean.map((point,i)=><g key={point.period}>
    <circle cx={loc[i][0]} cy={loc[i][1]} r={i===index?6:3.5} fill={i===index?'var(--growa-ink)':'var(--chart-1)'} stroke="var(--surface-card)" strokeWidth="1.5" pointerEvents="none"/>
    <circle cx={loc[i][0]} cy={loc[i][1]} r="15" role="button" tabIndex={0}
     aria-label={point.period+': '+formatHarvestMetricWithUnit(point.value,metric)}
     aria-pressed={i===index} fill="transparent" className="cursor-pointer focus:outline-none focus-visible:stroke-ink focus-visible:stroke-2"
     onClick={()=>setPicked(point.period)} onKeyDown={event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();setPicked(point.period)}
     }}/>
   </g>)}
   <text x={left} y={height-9} fill="currentColor" fontSize="10">{clean[0].period}</text>
   <text x={right} y={height-9} textAnchor="end" fill="currentColor" fontSize="10">{clean.at(-1)!.period}</text>
  </svg>
  <p className="text-[10px] leading-5 text-content-soft">
   Click any point to inspect its original value. The line connects reported time periods; it does not constitute daily observations.
   {granularity==='season'?' The season display may be cumulative for additive metrics.':''}
  </p>
 </div>
}
interface Props{
 field:HarvestAnalyticsField
 seasonId?:number
 mode:HarvestMode
 demo:boolean
 activeMapMetric:HarvestMetricKey
 mapGranularity:HarvestTrendGranularity
 selectedPeriod:string|null
 stats:HarvestFieldStatsResponse|null
 statsError:string|null
 statsLoading:boolean
 raster:HarvestRasterResponse|null
 rasterError:string|null
 rasterLoading:boolean
 collecting:boolean
 trendGranularity:HarvestTrendGranularity
 trendSeries:Partial<Record<HarvestMetricKey,HarvestTimeseriesPoint[]>>
 yieldTask:HarvestTaskStatus|null
 yieldLoading:boolean
 deleteLoading:boolean
 onBack:()=>void
 onSelectMapMetric:(metric:HarvestMetricKey)=>void
 onSelectMapGranularity:(granularity:HarvestTrendGranularity)=>void
 onSelectPeriod:(period:string)=>void
 onSetTrendGranularity:(granularity:HarvestTrendGranularity)=>void
 onEstimateYield:()=>void
 onDelete:()=>void
 intelligence?:ReactNode
}
export function HarvestFieldCommand({
 field,seasonId,mode,demo,activeMapMetric,mapGranularity,selectedPeriod,stats,
 statsError,statsLoading,raster,rasterError,rasterLoading,collecting,
 trendGranularity,trendSeries,yieldTask,yieldLoading,deleteLoading,
 onBack,onSelectMapMetric,onSelectMapGranularity,onSelectPeriod,onSetTrendGranularity,
 onEstimateYield,onDelete,intelligence,
}:Props){
 const [chartMetric,setChartMetric]=useState<HarvestMetricKey>('npp')
 const reported=METRICS.filter(key=>value(field,key)!==null)
 const start=dateValue(field.start_date)
 const end=dateValue(field.harvest_date)
 const datesKnown=start!==null&&end!==null&&end>start
 const now=Date.now()
 const progress=datesKnown?Math.min(100,Math.max(0,(now-start)/(end-start)*100)):null
 const latest=trendSeries[chartMetric]??[]
 const confirmedYield=false // API task runs do not confirm physically harvested tonnes.
 const missing=METRICS.filter(key=>value(field,key)===null)
 const rasterReady=!!raster&&!rasterLoading
 const completed=yieldTask?.status==='completed'
 const failed=yieldTask?.status==='failed'
 return <div className="@container space-y-4">
  <header className="overflow-hidden rounded-2xl bg-ink text-white shadow-panel">
   <div className="grid gap-5 bg-[radial-gradient(ellipse_at_87%_5%,rgba(140,177,117,.24),transparent_63%)] p-5 @4xl:grid-cols-[1.5fr_.85fr] @4xl:p-7">
    <div className="min-w-0">
     <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cream-200"><Sprout size={15}/> GROWA · FIELD PRODUCTION INTELLIGENCE</p>
     <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight @3xl:text-[40px]">{field.name}</h1>
     <p className="mt-2 text-xs text-cream-100">{field.crop||'Crop not reported'} · {area(field.area)} · Season {seasonId??'unconfirmed'}</p>
     <div className="mt-5 flex flex-wrap gap-2">
      <span className="rounded-full border border-white/25 px-3 py-1.5 text-[10px]">{mode==='predict'?'Forecast mode · modelled':'Observed to date'}</span>
      <span className="rounded-full border border-white/25 px-3 py-1.5 text-[10px]">{demo?'Sample field record':'Harvest API · field record'}</span>
      <span className="rounded-full border border-white/25 px-3 py-1.5 text-[10px]">{rasterReady?'Spectral map available':collecting?'Raster collection running':'Spectral map pending'}</span>
     </div>
     <div className="mt-5 flex flex-wrap items-center gap-2">
      <button type="button" onClick={onBack} className="g-btn g-btn--outline-inverse inline-flex items-center gap-2">
       <ArrowLeft size={14}/> Back to all fields
      </button>
      <button type="button" onClick={onDelete} disabled={deleteLoading}
       aria-label={'Delete field '+field.name}
       className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#DDB8B0] bg-[#FEF1EE] px-4 py-2 text-xs font-semibold text-[#9E3E30] transition-colors hover:border-[#A8392B] hover:bg-[#FBE3DE] disabled:cursor-not-allowed disabled:opacity-50">
       {deleteLoading?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}
       {deleteLoading?'Deleting field…':'Delete field'}
      </button>
     </div>
    </div>
    <div className="rounded-xl border border-white/20 bg-white/5 p-5">
     <p className="text-[10px] font-bold tracking-wider text-cream-200">SEASON PLANNING WINDOW</p>
     <div className="mt-4 flex items-baseline justify-between gap-2">
      <span className="text-xs text-cream-200">Sowing / start</span><strong className="text-sm">{displayDate(field.start_date)}</strong>
     </div>
     <div className="mt-3 flex items-baseline justify-between gap-2">
      <span className="text-xs text-cream-200">Expected harvest</span><strong className="text-sm">{displayDate(field.harvest_date)}</strong>
     </div>
     <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
      <div className="h-full bg-cream" style={{width:(progress??0)+'%'}}/>
     </div>
     <p className="mt-2 text-[11px] text-cream-100">
      {progress===null?'Calendar dates cannot be compared':
       progress>=100?'Planned harvest date passed · confirm field status':
       fmt(progress,0)+'% of scheduled calendar elapsed'}
     </p>
     <p className="mt-2 text-[10px] text-cream-200">Calendar completion is not phenological stage or physical harvest confirmation.</p>
    </div>
   </div>
  </header>
  <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-4">
   <ModelKpi name="Biomass product" icon={Leaf} mode={mode} value={value(field,'tbp')===null?'Awaiting TBP':formatHarvestMetricWithUnit(value(field,'tbp')!,'tbp')} note="Modeled TBP, not sold or harvested tonnage"/>
   <ModelKpi name="Water consumption" icon={Droplets} mode={mode} value={value(field,'aeti')===null?'Awaiting AETI':formatHarvestMetricWithUnit(value(field,'aeti')!,'aeti')} note="Actual ET estimate in field feed"/>
   <ModelKpi name="Water productivity" icon={TrendingUp} mode={mode} value={value(field,'bwp')===null?'Awaiting BWP':formatHarvestMetricWithUnit(value(field,'bwp')!,'bwp')} note="Biomass per water consumed, not crop sales yield"/>
   <ModelKpi name="Relative water deficit" icon={Activity} mode={mode} value={value(field,'rwd')===null?'Awaiting RWD':formatHarvestMetricWithUnit(value(field,'rwd')!,'rwd')} note="Index requiring field and crop-stage interpretation"/>
  </div>
  <div className="grid gap-4 @5xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.85fr)]">
   <Card icon={BarChart3} title="Field development timeline" subtitle="Per-field metrics from Harvest season statistics, selectable by period and indicator."
    actions={<div className="flex flex-wrap gap-1 rounded-full border border-line bg-muted p-1">
     {(['dekad','season'] as const).map(granularity=><button key={granularity} type="button"
      aria-pressed={trendGranularity===granularity} onClick={()=>onSetTrendGranularity(granularity)}
      className={'rounded-full px-3 py-1 text-[10px] font-semibold '+(trendGranularity===granularity?'bg-ink text-white':'text-content-soft')}>
      {granularity==='dekad'?'Dekad':'Season'}</button>)}
    </div>}>
    <div className="mb-3 flex flex-wrap gap-2">
     {METRICS.map(key=><button type="button" key={key} aria-pressed={chartMetric===key}
      onClick={()=>setChartMetric(key)} className={'rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors '+(
       chartMetric===key?'border-ink bg-ink text-white':'border-line bg-card text-content-soft hover:bg-muted')}>
       {HARVEST_METRIC_META[key].shortLabel}
     </button>)}
    </div>
    <FieldTrendChart key={field.parcel_id+'-'+chartMetric+'-'+trendGranularity}
     metric={chartMetric} granularity={trendGranularity} points={latest}/>
    {statsLoading&&<p className="mt-2 flex items-center gap-2 text-xs text-content-soft"><Loader2 size={14} className="animate-spin"/> Refreshing field statistics</p>}
    {statsError&&<p role="status" className="mt-2 text-xs text-warning-strong">{statsError}</p>}
   </Card>
   <Card icon={ShieldAlert} title="Field decision brief" subtitle="What the current evidence can support, and what should be checked.">
    <div className="space-y-3">
     {[
      {title:'Production evidence',detail:value(field,'tbp')===null?'Biomass TBP needs a field reading.':'Biomass TBP is available as a model output, not a confirmed harvested quantity.',tone:value(field,'tbp')===null?'warning':'good'},
      {title:'Water stress interpretation',detail:value(field,'rwd')===null?'RWD is not yet reported for this field.':'Relative water deficit is '+fmt(value(field,'rwd')!,2)+'. Review this value against crop phase and soil measurements before changing irrigation.',tone:value(field,'rwd')===null?'warning':'neutral'},
      {title:'Evidence coverage',detail:reported.length+' of 7 modeled performance indicators are available.'+(missing.length?' Missing: '+missing.map(key=>key.toUpperCase()).join(', ')+'.':''),tone:missing.length?'warning':'good'},
      {title:'Harvest verification',detail:confirmedYield?'Yield independently confirmed.':'The expected harvest date does not establish that a crop was physically collected.',tone:'neutral'},
      ...(collecting?[{title:'Satellite collection',detail:'Raster acquisition is still underway; use the available numerical metrics cautiously.',tone:'warning'}]:[]),
     ].map(item=><div key={item.title} className="rounded-lg border border-line bg-background p-3">
      <p className="flex items-center gap-2 text-xs font-semibold"><StatusDot size={7} tone={item.tone as 'warning'|'good'|'neutral'}/>{item.title}</p>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">{item.detail}</p>
     </div>)}
    </div>
   </Card>
  </div>
  <div className="grid gap-4 @5xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)]">
   <Card icon={MapIcon} title="Satellite field analysis" subtitle="Choose the exact metric and period overlay displayed on the map beside this panel.">
    <div className="flex flex-wrap gap-2">
     {MAP_METRICS.map(metric=><button type="button" key={metric} onClick={()=>onSelectMapMetric(metric)}
      aria-pressed={activeMapMetric===metric} className={'rounded-full border px-3 py-2 text-[11px] font-semibold '+(
       activeMapMetric===metric?'border-ink bg-ink text-white':'border-line bg-card text-content-soft hover:bg-muted')}>
      {HARVEST_METRIC_META[metric].shortLabel}
     </button>)}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
     <div className="flex gap-1 rounded-full border border-line bg-muted p-1">
      {(['season','dekad'] as const).map(g=><button key={g} type="button" onClick={()=>onSelectMapGranularity(g)}
       aria-pressed={mapGranularity===g} className={'rounded-full px-3 py-1.5 text-[11px] font-semibold '+(
        mapGranularity===g?'bg-ink text-white':'text-content-soft')}>{g==='season'?'Full season':'Dekad'}</button>)}
     </div>
     {mapGranularity==='dekad'&&<select aria-label="Map observation period" value={selectedPeriod??stats?.periods.at(-1)?.value??''}
      onChange={e=>onSelectPeriod(e.target.value)}
      className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-xs">
      {stats?.periods?.length?stats.periods.map(p=><option key={p.value} value={p.value}>{p.label}</option>):
       <option value="">Awaiting observations</option>}
     </select>}
    </div>
    <div className="mt-4 rounded-xl border border-line bg-muted p-4">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-xs font-semibold">
       {rasterReady?<CheckCircle2 className="size-4 text-sage-700"/>:
        rasterLoading?<Loader2 className="size-4 animate-spin"/>:<Layers3 className="size-4 text-content-soft"/>}
       {rasterReady?'Layer displayed on the live map':rasterLoading?'Loading raster layer':collecting?'Collection in progress':'Layer awaiting data'}
      </p>
      <span className="text-[10px] text-content-soft">{mapGranularity==='season'?'Season composite':'Dekad layer'}</span>
     </div>
     {rasterReady&&<div className="mt-3">
      <p className="text-[11px] text-content-soft">{HARVEST_METRIC_META[raster.metric].label} · {raster.unit} · {fmt(raster.vmin,2)} to {fmt(raster.vmax,2)} · 50% opacity</p>
      <div className="mt-3 flex flex-wrap gap-3">{raster.legend.map(item=><span key={item.label} className="inline-flex items-center gap-1.5 text-[10px]">
       <span className="size-3 rounded-sm border border-black/10" style={{backgroundColor:item.color}}/>{item.label}
      </span>)}</div>
     </div>}
     {rasterError&&<p role="status" className="mt-2 text-xs text-warning-strong">{rasterError}</p>}
    </div>
    <p className="mt-3 text-[10px] leading-5 text-content-soft">Changing a layer updates the existing geographic overlay. The source raster is not generated locally or treated as ground-truth crop diagnosis.</p>
   </Card>
   <Card icon={Target} title="Yield estimation & field actions" subtitle="Request a real Harvest estimate and verify its task status.">
    <p className="text-xs leading-5 text-content-soft">
     This action calls the configured Harvest calculation for the selected {mode==='predict'?'forecast':'observed'} season. A model result is not actual recorded tonnage.
    </p>
    <button type="button" onClick={onEstimateYield} disabled={yieldLoading||!seasonId}
     className="g-btn g-btn--primary mt-4 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
     {yieldLoading?<Loader2 size={15} className="animate-spin"/>:<Target size={15}/>}
     {yieldLoading?'Calculating estimate…':'Run yield estimate'}
    </button>
    <div className="mt-4 rounded-lg border border-line bg-background p-3">
     <p className="text-[10px] font-bold uppercase tracking-wider text-content-soft">Estimation status</p>
     <p className="mt-2 flex items-center gap-2 text-xs font-semibold">
      <StatusDot tone={failed?'warning':completed?'good':'neutral'} size={7}/>
      {yieldLoading?'Model running':yieldTask?yieldTask.status==='completed'?'Model completed':yieldTask.status==='failed'?'Estimation failed':'Calculation in progress':'Not calculated in this session'}
     </p>
     {yieldTask?.result&&<details className="mt-3 rounded-lg border border-line bg-card p-3">
      <summary className="cursor-pointer text-[11px] font-semibold text-sage-700">View source model response</summary>
      <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] text-content-soft">{JSON.stringify(yieldTask.result,null,2)}</pre>
     </details>}
    </div>
    <p className="mt-4 border-t border-dotted border-line pt-3 text-[11px] leading-5 text-content-soft">
     Delete the field using the button near its name. Confirmation is required; this action affects its Harvest registration.
    </p>
   </Card>
  </div>
  <Card icon={Database} title="Field data lineage & confidence" subtitle="What is reported, what is modeled, and what is still missing.">
   <div className="grid gap-4 @2xl:grid-cols-2">
    <div>
     <p className="text-xs font-semibold">Seven-field metric coverage</p>
     <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-ink" style={{width:100*reported.length/METRICS.length+'%'}}/>
     </div>
     <p className="mt-2 text-[11px] text-content-soft">{reported.length} / 7 available: {reported.map(key=>key.toUpperCase()).join(', ')||'Awaiting collection'}</p>
     {missing.length>0&&<p className="mt-2 text-[11px] text-content-soft">Awaiting: {missing.map(key=>key.toUpperCase()).join(', ')}</p>}
    </div>
    <div className="rounded-xl border border-line bg-background p-3">
     <p className="text-xs font-semibold">Model interpretation</p>
     <p className="mt-2 text-[11px] leading-5 text-content-soft">
      Harvest data covers this field and season, not a national census.
      {mode==='predict'?' Predictive values must not be presented as ground observations.':' Observed-feed values may still be satellite/model-derived.'}
      Biomass output is not a documented physical crop harvest; yield and irrigation decisions require field verification.
     </p>
    </div>
   </div>
  </Card>
  {intelligence&&<details className="overflow-hidden rounded-2xl border border-line bg-card">
   <summary className="cursor-pointer px-5 py-4 text-xs font-semibold text-sage-700">Advanced intelligence · Watchtower, operational actions and Growa assistant</summary>
   <div className="space-y-4 border-t border-line p-4">{intelligence}</div>
  </details>}
 </div>
}
