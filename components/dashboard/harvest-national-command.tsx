'use client'
import {useMemo,useState} from 'react'
import {Activity,ArrowRight,BarChart3,CalendarDays,Database,Droplets,Layers3,Leaf,ShieldAlert,Sprout,Target,TrendingUp} from 'lucide-react'
import {Card} from '@/components/brand/layout'
import {StatusDot} from '@/components/brand/ui'
import {formatHarvestMetricWithUnit} from '@/lib/harvest/metrics'
import type {HarvestAnalyticsField,HarvestAnalyticsResponse,HarvestMetricKey,HarvestMode,HarvestTimeseriesPoint} from '@/lib/harvest/types'
import {buildHarvestPortfolio,harvestMetricRank,harvestAetiObservations} from '@/lib/harvest/portfolio-insights'
const fmt=(n:number,d=1)=>n.toLocaleString('en-US',{maximumFractionDigits:d})
const area=(n:number)=>fmt(n/10000,1)+' ha'
const rankLabels={tbp:'Biomass',bwp:'Water productivity',aeti:'Water used',rwd:'Water deficit'} as const
type RankKey=keyof typeof rankLabels
function Metric({label,value,note,icon:Icon}:{label:string;value:string;note:string;icon:typeof Activity}){
 return <div className="rounded-xl border border-line bg-card p-4">
  <p className="flex items-center gap-2 text-[11px] text-content-soft"><Icon className="size-3.5"/>{label}</p>
  <p className="growa-figure mt-2 text-content tabular-nums" style={{fontSize:'clamp(21px,2vw,29px)'}}>{value}</p>
  <p className="mt-2 text-[10px] leading-5 text-content-soft">{note}</p>
 </div>
}
function WaterTrend({points}:{points:HarvestTimeseriesPoint[]}){
 const rows=useMemo(()=>harvestAetiObservations(points),[points])
 const [picked,setPicked]=useState<string|null>(null)
 if(rows.length<2)return <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-line text-xs text-content-soft">At least two dated AETI readings are needed to display a trend.</div>
 const chosen=rows.find(p=>p.period===picked)??rows.at(-1)!
 const selectedIndex=rows.indexOf(chosen)
 const previous=rows[selectedIndex-1]
 const change=previous&&previous.value>0?(chosen.value-previous.value)/previous.value*100:null
 const width=760,height=230,left=50,right=742,top=18,bottom=182
 const vals=rows.map(p=>p.value),minimum=Math.min(...vals),maximum=Math.max(...vals)
 const span=Math.max(1,maximum-minimum),low=Math.max(0,minimum-span*.15),high=maximum+span*.15
 const x=(i:number)=>left+i/Math.max(1,rows.length-1)*(right-left)
 const y=(v:number)=>bottom-(v-low)/Math.max(1,high-low)*(bottom-top)
 const xy=rows.map((p,i)=>[x(i),y(p.value)])
 return <div>
  <div className="flex items-start justify-between gap-3">
   <div><p className="text-[10px] font-bold tracking-wide text-content-soft">SELECTED DEKAD · {chosen.period}</p>
    <p className="growa-figure mt-2 text-2xl tabular-nums">{fmt(chosen.value)} <small className="text-xs font-normal text-content-soft">m³ AETI</small></p>
   </div>
   <div className="text-right text-[10px] text-content-soft">Change from previous<p className="mt-1 text-sm font-semibold text-content">{change===null?'First reading':(change>0?'+':'')+fmt(change)+'%'}</p></div>
  </div>
  <svg viewBox={'0 0 '+width+' '+height} role="group" aria-label="Interactive dated water use measurements" className="mt-3 w-full">
   {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={right} y1={top+t*(bottom-top)} y2={top+t*(bottom-top)} stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5"/><text x={left-6} y={top+t*(bottom-top)+4} fontSize="10" textAnchor="end" fill="currentColor" opacity=".65">{fmt(high-t*(high-low),0)}</text></g>)}
   <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={bottom} stroke="var(--growa-ink)" strokeDasharray="4 4" pointerEvents="none"/>
   <polyline points={xy.map(pair=>pair.join(',')).join(' ')} fill="none" stroke="var(--growa-sage)" strokeWidth="3" strokeLinejoin="round" pointerEvents="none"/>
   {rows.map((p,i)=><g key={p.period}>
    <circle cx={x(i)} cy={y(p.value)} r={selectedIndex===i?6:3.5} fill={selectedIndex===i?'var(--growa-ink)':'var(--chart-1)'} stroke="var(--surface-card)" strokeWidth="1.5" pointerEvents="none"/>
    <circle cx={x(i)} cy={y(p.value)} r="15" role="button" tabIndex={0} fill="transparent" className="cursor-pointer" aria-label={p.period+': '+fmt(p.value)+' cubic metres'} aria-pressed={selectedIndex===i}
     onClick={()=>setPicked(p.period)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPicked(p.period)}}}/>
   </g>)}
   <text x={left} y={height-10} fontSize="10" fill="currentColor">{rows[0].period}</text>
   <text x={right} y={height-10} fontSize="10" fill="currentColor" textAnchor="end">{rows.at(-1)!.period}</text>
  </svg>
  <p className="text-[10px] leading-5 text-content-soft">Select any point. Connected Harvest dekad values, not Qatar-wide water demand. The line joins observations and does not imply daily measurements.</p>
 </div>
}
export function HarvestNationalCommand({analytics,fields,points,mode,demo,collectingIds,onSelectField}:{
 analytics:HarvestAnalyticsResponse|null;fields:HarvestAnalyticsField[];points:HarvestTimeseriesPoint[];
 mode:HarvestMode;demo:boolean;collectingIds:string[];
 onSelectField:(field:HarvestAnalyticsField)=>void
}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const summary=useMemo(()=>buildHarvestPortfolio(fields,analytics,collectingIds,today),[fields,analytics,collectingIds,today])
 const [crop,setCrop]=useState('all')
 const [rankingMetric,setRankingMetric]=useState<RankKey>('tbp')
 const ranking=useMemo(()=>harvestMetricRank(summary.fields,rankingMetric,crop).slice(0,5),[summary,rankingMetric,crop])
 const biomass=summary.metrics.tbp,water=summary.metrics.aeti,productivity=summary.metrics.bwp
 const maxArea=Math.max(summary.areaHa,.0001)
 const priorities=[
  ...(summary.collectingCount?[{title:'Collection underway',detail:summary.collectingCount+' fields have unfinished satellite collection.',warning:true}]:[]),
  ...(summary.missingFields.length?[{title:'Missing field observations',detail:summary.missingFields.length+' fields lack at least one of AETI, TBP and BWP.',warning:true}]:[]),
  ...(summary.schedulePassed.length?[{title:'Harvest dates need confirmation',detail:summary.schedulePassed.length+' fields have past planned dates, not confirmed harvest events.',warning:true}]:[]),
  ...(summary.highestDeficit?[{title:'Relative water-deficit watch',detail:summary.highestDeficit.name+' has the highest reported RWD. Verify field conditions.',warning:false}]:[]),
  ...(summary.lowestProductivity?[{title:'Water productivity review',detail:summary.lowestProductivity.name+' has the lowest recorded BWP. Compare similar crops.',warning:false}]:[]),
 ]
 return <div className="@container space-y-4">
  <header className="overflow-hidden rounded-2xl bg-ink text-white shadow-panel">
   <div className="grid gap-5 bg-[radial-gradient(ellipse_at_90%_5%,rgba(140,177,117,.24),transparent_65%)] p-6 @4xl:grid-cols-[1.6fr_.8fr] @4xl:p-8">
    <div>
     <p className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-cream-200"><Sprout size={15}/> GROWA · AGRICULTURAL PRODUCTION INTELLIGENCE</p>
     <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Harvest <span className="font-light text-cream-200">Command Center</span></h2>
     <p className="mt-3 max-w-2xl text-xs leading-6 text-cream-100">A connected portfolio view of biomass, water productivity, crop distribution, field risks and harvest planning.</p>
     <div className="mt-5 flex flex-wrap gap-2 text-[10px]">
      <span className="rounded-full border border-white/25 px-3 py-2">{demo?'Sample catalog · not national observations':'Connected Harvest API fields'}</span>
      <span className="rounded-full border border-white/25 px-3 py-2">{mode==='predict'?'Forecast':'Observed to date'}</span>
      <span className="rounded-full border border-white/25 px-3 py-2">Qatar · monitored field portfolio</span>
     </div>
    </div>
    <div className="rounded-2xl border border-white/20 bg-white/5 p-5">
     <p className="text-[10px] font-bold tracking-wider text-cream-200">PORTFOLIO COVERAGE</p>
     <p className="growa-figure mt-3 text-4xl tabular-nums">{summary.fieldCount}<span className="ms-2 text-sm font-normal text-cream-100">fields</span></p>
     <p className="mt-2 text-xs text-cream-100">{fmt(summary.areaHa,1)} monitored hectares</p>
     <div className="my-4 border-t border-dotted border-white/20"/>
     <p className="flex justify-between text-xs"><span className="text-cream-200">Crop groups</span><strong>{summary.distinctCrops}</strong></p>
     <p className="mt-2 flex justify-between text-xs"><span className="text-cream-200">Metrics complete</span><strong>{summary.completeFields}/{summary.fieldCount} fields</strong></p>
    </div>
   </div>
  </header>
  <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-4">
   <Metric label="Total biomass product" icon={Leaf} value={biomass?formatHarvestMetricWithUnit(biomass.value,'tbp',{agg:biomass.agg}):'Not reported'} note="TBP · modeled biomass, not confirmed harvest tonnage"/>
   <Metric label="Water consumption" icon={Droplets} value={water?formatHarvestMetricWithUnit(water.value,'aeti',{agg:water.agg}):'Not reported'} note="AETI · source-reported field aggregate"/>
   <Metric label="Biomass water productivity" icon={TrendingUp} value={productivity?formatHarvestMetricWithUnit(productivity.value,'bwp',{agg:productivity.agg}):'Not reported'} note="BWP · not marketable yield per cubic metre"/>
   <Metric label="Evidence completeness" icon={Target} value={summary.completeFields+'/'+summary.fieldCount} note="Fields with all three metrics: AETI, TBP and BWP"/>
  </div>
  <div className="grid gap-4 @5xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.8fr)]">
   <Card icon={Droplets} title="Water use timeline" subtitle="Source-backed AETI observations by dekad."><WaterTrend key={mode} points={points}/></Card>
   <Card icon={Layers3} title="Crop portfolio" subtitle="Crop mix by declared hectares. Select a crop to filter the ranking.">
    {summary.crops.length?<div className="space-y-3">
     <div className="flex h-3 overflow-hidden rounded-full bg-muted">
      {summary.crops.map((item,i)=><div key={item.name} title={item.name} style={{
       width:(summary.areaHa>0?item.areaHa/maxArea:item.fields/Math.max(1,summary.fieldCount))*100+'%',
       background:['var(--growa-ink)','var(--growa-sage)','var(--chart-1)','var(--growa-stone-500)','var(--chart-2)'][i%5],
      }}/>)}
     </div>
     {summary.crops.slice(0,8).map((item,i)=><button key={item.name} type="button"
      onClick={()=>setCrop(crop===item.name?'all':item.name)}
      aria-pressed={crop===item.name} className={'flex w-full items-center gap-3 rounded-lg border p-2 text-left '+(
       crop===item.name?'border-line-strong bg-cream-50':'border-line bg-background hover:bg-muted')}>
      <span className="size-2.5 rounded-sm" style={{background:['var(--growa-ink)','var(--growa-sage)','var(--chart-1)','var(--growa-stone-500)','var(--chart-2)'][i%5]}}/>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.name}</span>
      <span className="text-[10px] text-content-soft">{item.fields} fields</span>
      <span className="min-w-[60px] text-right text-xs tabular-nums">{fmt(item.areaHa,1)} ha</span>
     </button>)}
    </div>:<p className="text-xs text-content-soft">No connected crop records available.</p>}
   </Card>
  </div>
  <div className="grid gap-4 @5xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)]">
   <Card icon={BarChart3} title="Field performance explorer" subtitle="Select a field to open its seasonal map and metrics."
    actions={<select value={rankingMetric} onChange={e=>setRankingMetric(e.target.value as RankKey)}
     aria-label="Field performance metric" className="rounded-lg border border-line bg-card px-3 py-2 text-xs">
     {(['tbp','bwp','aeti','rwd'] as RankKey[]).map(key=><option key={key} value={key}>{rankLabels[key]}</option>)}
    </select>}>
    <div className="flex justify-between gap-2 text-[11px]"><span className="text-content-soft">Crop: {crop==='all'?'All':crop}</span>{crop!=='all'&&<button onClick={()=>setCrop('all')} type="button" className="text-sage-700 underline">Clear filter</button>}</div>
    <div className="mt-3 space-y-2">
     {ranking.length?ranking.map(({field,value},i)=><button key={field.parcel_id+'-'+(field.season_id??'')} type="button"
      onClick={()=>onSelectField(field)} className="w-full rounded-lg border border-line bg-background p-3 text-left hover:border-line-strong hover:bg-cream-50">
      <div className="flex items-center gap-2 text-xs"><span className="growa-figure w-5 text-content-soft">{i+1}</span><span className="min-w-0 flex-1 truncate font-semibold">{field.name}</span><strong className="tabular-nums">{formatHarvestMetricWithUnit(value,rankingMetric)}</strong><ArrowRight size={13}/></div>
      <div className="ms-7 mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-sage" style={{width:Math.max(3,Math.abs(value)/Math.max(...ranking.map(r=>Math.abs(r.value)),.01)*100)+'%'}}/></div>
      <p className="ms-7 mt-1 text-[10px] text-content-soft">{field.crop} · {area(field.area)}</p>
     </button>):<p className="rounded-lg border border-dashed border-line p-4 text-xs text-content-soft">No comparable metric readings for the selected crop.</p>}
    </div>
   </Card>
   <Card icon={ShieldAlert} title="Production watchlist" subtitle="Evidence-linked flags, not automatic diagnoses.">
    <div className="space-y-2">
     {priorities.length?priorities.slice(0,5).map(issue=><div key={issue.title} className="rounded-lg border border-line bg-background p-3">
      <p className="flex items-center gap-2 text-xs font-semibold"><StatusDot size={7} tone={issue.warning?'warning':'neutral'}/>{issue.title}</p>
      <p className="mt-1 text-[11px] leading-5 text-content-soft">{issue.detail}</p>
     </div>):<p className="text-xs text-content-soft">No portfolio alerts derived from available samples. This does not validate field health.</p>}
    </div>
   </Card>
  </div>
  <div className="grid gap-4 @5xl:grid-cols-2">
   <Card icon={CalendarDays} title="Harvest planning calendar" subtitle="Expected harvest dates, not validated harvest operations.">
    <div className="space-y-2">
     {summary.upcoming.slice(0,6).map(field=><button key={field.parcel_id+'-'+field.harvest_date} type="button"
      onClick={()=>onSelectField(field)} className="flex w-full justify-between gap-3 rounded-lg border border-line bg-background p-3 text-left hover:bg-cream-50">
      <div className="min-w-0"><p className="truncate text-xs font-semibold">{field.name}</p><p className="mt-1 text-[10px] text-content-soft">{field.crop} · {area(field.area)}</p></div>
      <strong className="shrink-0 text-xs tabular-nums">{field.harvest_date}</strong>
     </button>)}
     {!summary.upcoming.length&&<p className="text-xs text-content-soft">No planned harvests in the next 90 days.</p>}
    </div>
    <p className="mt-3 text-[10px] text-content-soft">{summary.schedulePassed.length} past planned dates to reconcile. No harvested quantity is inferred.</p>
   </Card>
   <Card icon={Database} title="Evidence coverage" subtitle="Portfolio metrics and missing observations.">
    <div className="space-y-4">
     {([['Field area',summary.areaCoverage],['Water AETI',summary.aetiCoverage],['Biomass TBP',summary.tbpCoverage],['Water productivity BWP',summary.bwpCoverage]] as const).map(([label,count])=><div key={label}>
      <div className="mb-1 flex justify-between text-[11px]"><span className="text-content-soft">{label}</span><strong>{count}/{summary.fieldCount} fields</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-ink" style={{width:summary.fieldCount?100*count/summary.fieldCount+'%':'0%'}}/></div>
     </div>)}
    </div>
    <p className="mt-4 border-t border-dotted border-line pt-3 text-[10px] leading-5 text-content-soft">Sources: Harvest API catalog, field metrics and dated AETI. {demo?'Sample data is active.':'Connected field observations only.'} Modeled TBP is not confirmed yield; field alerts require agronomic validation.</p>
   </Card>
  </div>
 </div>
}
