'use client'

import {useMemo,useState} from 'react'
import {
 Activity,ArrowUpRight,CloudSun,Droplets,MapPin,RefreshCw,
 ShieldAlert,ShieldCheck,SunMedium,ThermometerSun,Wind,ChartNoAxesCombined,
 Waves,Clock3,
} from 'lucide-react'
import {
 assessWeatherOperations,historyQuality,observationStatus,weatherNumber,
 weatherTrend,type ScreenItem,type WeatherReading,type WeatherHistory,
} from '@/lib/weather/operational-screen'
import styles from './weather-command-center.module.css'

const LOCATIONS=[
 {name:'Doha',lat:25.2854,lng:51.5310},
 {name:'Al Khor',lat:25.6839,lng:51.5058},
 {name:'Al Ruwais',lat:26.1385,lng:51.2147},
 {name:'Al Wakrah',lat:25.1715,lng:51.6034},
 {name:'Dukhan',lat:25.4243,lng:50.7843},
] as const
const HISTORY=[
 {key:'temperature_c',label:'Temperature',unit:'°C',digits:1},
 {key:'vpd_kpa',label:'VPD',unit:'kPa',digits:2},
 {key:'eto_instant_mm_h',label:'ET₀ rate',unit:'mm/h',digits:3},
 {key:'wind_speed_km_h',label:'Wind',unit:'km/h',digits:1},
 {key:'humidity_percent',label:'Humidity',unit:'%',digits:0},
] as const
type TrendKey=typeof HISTORY[number]['key']
const format=(value:number|null,digits=1)=>
 value===null?'N/A':value.toLocaleString('en-US',{
  maximumFractionDigits:digits,minimumFractionDigits:digits,
 })
const localDate=(iso:string)=>new Date(iso).toLocaleString('en-GB',{
 day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Qatar',
})
function stateLabel(state:ScreenItem['state']){
 return state==='high'?'ELEVATED':state==='watch'?'WATCH':
 state==='normal'?'WITHIN SCREEN':'NO DATA'
}
function Trend({points,unit,digits}:{points:ReturnType<typeof weatherTrend>;unit:string;digits:number}){
 // Skip absent observations without inventing line segments across gaps.
 const finite=points.filter(p=>p.value!==null)
 const width=700,height=185,left=24,right=width-24,top=18,bottom=height-21
 if(finite.length<2)return <div className={styles.trendEmpty}>
  At least two valid historical observations are needed to draw this trend.
 </div>
 const times=points.map(p=>Date.parse(p.at))
 const minT=Math.min(...times),maxT=Math.max(...times)
 const values=finite.map(p=>p.value as number),min=Math.min(...values),max=Math.max(...values)
 const spread=Math.max(.1,max-min)
 const px=(at:string)=>left+(Date.parse(at)-minT)/Math.max(1,maxT-minT)*(right-left)
 const py=(value:number)=>bottom-(value-min)/spread*(bottom-top)
 const last=finite.at(-1)!
 const groups:{at:string;value:number}[][]=[]
 let segment:{at:string;value:number}[]=[]
 for(const point of points){
  if(point.value===null){if(segment.length)groups.push(segment);segment=[]}
  else segment.push({at:point.at,value:point.value})
 }
 if(segment.length)groups.push(segment)
 return <div>
  <div className={styles.trendValue}>
   <strong>{format(last.value, digits)}</strong><span>{unit}</span>
   <small>{localDate(last.at)} · last recorded</small>
  </div>
  <svg viewBox={`0 0 ${width} ${height}`} role="img"
   aria-label="Historical observations over selected 24-hour window"
   className={styles.chart}>
   {[0,.25,.5,.75,1].map(y=><line key={y} x1={left}
    x2={right} y1={top+(bottom-top)*y} y2={top+(bottom-top)*y}
    stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5"/>)}
   {groups.map((group,i)=><polyline key={i}
    points={group.map(p=>px(p.at)+','+py(p.value)).join(' ')}
    stroke="#7da16a" strokeWidth="3" fill="none" strokeLinejoin="round"
    strokeLinecap="round"/>)}
   {finite.map((p,i)=><circle key={i} cx={px(p.at)}
    cy={py(p.value as number)} r="3" fill="#7da16a">
    <title>{localDate(p.at)}: {format(p.value,digits)} {unit}</title>
   </circle>)}
  </svg>
  <div className={styles.chartAxis}><span>{localDate(points[0].at)}</span>
   <span>Range: {format(min,digits)}–{format(max,digits)} {unit}</span>
   <span>{localDate(points.at(-1)!.at)}</span></div>
 </div>
}
export function WeatherCommandCenter({
 reading,history,loading,historyLoading,historyError,onRetryHistory,location,coordinates,
 onLocationChange,onRefresh,onHistoryMetricClick,
}:{
 reading:WeatherReading|null
 history:WeatherHistory[]
 loading:boolean
 historyLoading:boolean
 historyError:string|null
 onRetryHistory:()=>void
 location:string
 coordinates:string
 onLocationChange:(lat:number,lng:number)=>void
 onRefresh:()=>void
 onHistoryMetricClick:(metricKey:string)=>void
}){
 const [trendKey,setTrendKey]=useState<TrendKey>('temperature_c')
 const [selectedRisk,setSelectedRisk]=useState<ScreenItem['id']|null>(null)
 const temp=weatherNumber(reading,'temperature_c')
 const humidity=weatherNumber(reading,'humidity_percent')
 const vpd=weatherNumber(reading,'vpd_kpa')
 const wind=weatherNumber(reading,'wind_speed_km_h')
 const direction=weatherNumber(reading,'wind_direction_deg')
 const et0=weatherNumber(reading,'eto_daily_estimated_mm_day')
 const rain=weatherNumber(reading,'rain_1h_mm')
 const irradiance=weatherNumber(reading,'solar_ghi_w_m2')
 const risks=useMemo(()=>assessWeatherOperations(reading),[reading])
 const status=observationStatus(reading,Date.now())
 const high=risks.filter(r=>r.state==='high').length
 const watch=risks.filter(r=>r.state==='watch').length
 const available=risks.filter(r=>r.state!=='unavailable').length
 const quality=historyQuality(history)
 const active=HISTORY.find(t=>t.key===trendKey)!
 const trend=useMemo(()=>weatherTrend(history,trendKey),[history,trendKey])
 const selected=risks.find(r=>r.id===selectedRisk)
 const fresh=status.mode==='recent'
 return <section className={styles.shell} aria-label="Growa weather intelligence command center">
  <div className={styles.hero}>
   <div className={styles.aura}/>
   <div className={styles.heroTop}>
    <div className={styles.headerText}>
     <span className={styles.eyebrow}><CloudSun size={16}/> GROWA / ENVIRONMENTAL INTELLIGENCE</span>
     <h2>Weather <em>Command Center</em></h2>
     <p>From Qatar's weather grid to practical field decisions. One location, verified conditions and transparent operational screening.</p>
     <div className={styles.locationControls}>
      {LOCATIONS.map(city=><button key={city.name} type="button"
       aria-pressed={Math.abs(Number(coordinates.split(',')[0])-city.lat)<.008&&
        Math.abs(Number(coordinates.split(',')[1])-city.lng)<.008}
       onClick={()=>onLocationChange(city.lat,city.lng)}>{city.name}</button>)}
     </div>
    </div>
    <div className={styles.readiness} data-mode={status.mode}>
     <div className={styles.readinessHead}>
      <span><Activity size={13}/> OBSERVATION STATUS</span>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh weather observations">
       <RefreshCw size={15} className={loading?'animate-spin':''}/></button>
     </div>
     <strong>{loading?'LOADING':status.label}</strong>
     <p>{reading?.data_source||'Weather API'} · {reading?.matched_timestamp?
      localDate(reading.matched_timestamp):
      reading?.stored_at?localDate(reading.stored_at):'Timestamp not verified'}</p>
     <small>{fresh?'Recent observations available':'Do not interpret an old or unknown snapshot as live weather'}</small>
    </div>
   </div>
   <div className={styles.heroStats}>
    <div className={styles.mainTemp}>
     <span className={styles.metricLabel}><ThermometerSun size={16}/> AIR TEMPERATURE</span>
     <strong>{format(temp,1)}<i>{temp===null?'':'°C'}</i></strong>
     <p>{location} · {coordinates||'Select a weather grid cell'}</p>
    </div>
    {[
     {label:'RELATIVE HUMIDITY',value:humidity,unit:'%',digits:0,icon:Droplets},
     {label:'VAPOR PRESSURE DEFICIT',value:vpd,unit:'kPa',digits:2,icon:Waves},
     {label:'WIND SPEED',value:wind,unit:'km/h',digits:1,icon:Wind},
     {label:'REFERENCE ET₀',value:et0,unit:'mm/day',digits:2,icon:SunMedium},
    ].map(m=>{const Icon=m.icon;return <div className={styles.heroMetric} key={m.label}>
     <span className={styles.metricLabel}><Icon size={15}/>{m.label}</span>
     <strong>{format(m.value,m.digits)}</strong>
     <p>{m.value===null?'No verified reading':m.unit}</p>
    </div>})}
   </div>
  </div>

  <div className={styles.operations}>
   <div className={styles.sectionHead}>
    <div>
     <span className={styles.kicker}><ShieldAlert size={14}/> OPERATIONAL SCREENING</span>
     <h3>What needs attention?</h3>
     <p>Four transparent checks from the selected cell, not an autonomous irrigation or spraying command.</p>
    </div>
    <div className={styles.counts}>
     <span>{available}/4 evaluated</span>
     {high>0&&<span data-tone="high">{high} elevated</span>}
     {watch>0&&<span data-tone="watch">{watch} watch</span>}
    </div>
   </div>
   <div className={styles.riskGrid}>
    {risks.map(risk=><button type="button" key={risk.id}
     aria-expanded={selectedRisk===risk.id}
     onClick={()=>setSelectedRisk(selectedRisk===risk.id?null:risk.id)}
     className={styles.riskCard} data-state={risk.state}>
     <div className={styles.riskTop}><span className={styles.riskDot}/><small>{stateLabel(risk.state)}</small></div>
     <h4>{risk.title}</h4>
     <strong>{format(risk.numeric,risk.unit==='/100'?0:1)} <small>{risk.numeric!==null?risk.unit:''}</small></strong>
     <p>{risk.basis}</p>
     <span className={styles.riskMore}>View assessment <ArrowUpRight size={13}/></span>
    </button>)}
   </div>
   {selected&&<div className={styles.riskDetails}>
    <div><strong>{selected.title} · screening interpretation</strong>
     <p>{selected.detail}</p><p>{selected.action}</p></div>
    <button onClick={()=>setSelectedRisk(null)} type="button">Close</button>
   </div>}
   {!reading&&<div className={styles.notice}>
    <ShieldAlert size={16}/> Weather readings are unavailable. Screening states are intentionally withheld until a real observation is loaded.
   </div>}
  </div>

  <div className={styles.lower}>
   <div className={styles.trendPanel}>
    <div className={styles.sectionHead}>
     <div><span className={styles.kicker}><ChartNoAxesCombined size={14}/> HISTORICAL WEATHER</span>
      <h3>24-hour observed trend</h3>
      <p>Snapshots from the Weather API, not a forecast. Missing readings remain gaps.</p></div>
     <span className={styles.quality}>{historyLoading?'Loading':
      quality.valid+' records / '+quality.unique+' timestamps'}</span>
    </div>
    <div className={styles.trendTabs}>
     {HISTORY.map(metric=><button type="button" key={metric.key}
      aria-pressed={trendKey===metric.key} onClick={()=>setTrendKey(metric.key)}>
      {metric.label}</button>)}
    </div>
    {historyLoading?<div className={styles.trendEmpty}>Retrieving historical observations…</div>:
     <Trend points={trend} unit={active.unit} digits={active.digits}/>}
    {historyError&&<div role="alert" className={styles.trendError}>
      <span>{historyError}</span>
      <button type="button" onClick={onRetryHistory}><RefreshCw size={13}/> Retry 24-hour history</button>
    </div>}
    <button type="button" className={styles.detailLink}
     onClick={()=>onHistoryMetricClick(trendKey)}>
     Open detailed history <ArrowUpRight size={14}/></button>
   </div>
   <div className={styles.fieldPanel}>
    <span className={styles.kicker}><MapPin size={14}/> FIELD CONDITIONS</span>
    <h3>Local snapshot</h3>
    <p>Context for field teams. No values are backfilled or estimated by this view.</p>
    <div className={styles.fieldRows}>
     {[
      {label:'Wind direction',value:direction===null?'N/A':format(direction,0)+'°'},
      {label:'Rain, last hour',value:rain===null?'N/A':format(rain,2)+' mm'},
      {label:'Global solar irradiance',value:irradiance===null?'N/A':format(irradiance,0)+' W/m²'},
      {label:'Historical timestamps',value:quality.unique+'/'+history.length},
     ].map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}
    </div>
    <div className={styles.screenNote}>
     <ShieldCheck size={18}/>
     <p>Reference ET₀ and VPD are environmental indicators. Crop demand, fertigation setpoints and greenhouse climate control require agronomic and on-site validation.</p>
    </div>
   </div>
  </div>
 </section>
}
