/**
 * Qatar utility day/week screening from Growa's EXISTING authorized Weather API.
 * These are atmospheric pressure indicators, not KAHRAMAA hourly water/electric
 * demand and not national measured service failures.
 */
import {weatherNumber,type WeatherHistory,type WeatherReading} from '@/lib/weather/operational-screen'
import type {UtilityDomain} from './qatar-utilities'

export type PressureWindow='daily'|'weekly'
export type PressureSeverity='normal'|'watch'|'high'
export type PressurePoint={at:string;value:number;secondary:number|null;severity:PressureSeverity}
export type PressureIssue={id:string;title:string;detail:string;severity:'watch'|'high';at:string|null}
export type PressureDay={date:string;peak:PressurePoint;count:number}
export type PressureAnalysis={
 domain:UtilityDomain;window:PressureWindow;label:string;unit:string;
 metric:string;sampleIntervalHours:number;expected:number;observed:number;
 points:PressurePoint[];dailyPeaks:PressureDay[];
 peak:PressurePoint|null;latest:PressurePoint|null;average:number|null;
 changePct:number|null;highCount:number;watchCount:number;
 issues:PressureIssue[];dataSource:string|null;lastAt:string|null
}
export const PRESSURE_METRICS={
 water:{label:'Atmospheric water-demand pressure (VPD)',unit:'kPa',metric:'vapour-pressure deficit',watch:1.6,high:2.5},
 energy:{label:'Cooling-pressure indicator (air temperature)',unit:'°C',metric:'ambient air temperature',watch:34,high:40},
} as const
export const PRESSURE_REGIONS=[
 {id:'doha',label:'Doha',lat:25.2854,lon:51.5310},
 {id:'north',label:'Northern Qatar',lat:26.0500,lon:51.0800},
 {id:'south',label:'Southern Qatar',lat:24.6700,lon:50.9200},
] as const
export const WEATHER_PRESSURE_HISTORY_PATH='/api/weather/history/by-coordinates'
export const pressureSampleIntervalHours=(window:PressureWindow)=>window==='daily'?1:7
export function historyPressureUrl(region:typeof PRESSURE_REGIONS[number],window:PressureWindow){
 return WEATHER_PRESSURE_HISTORY_PATH+'?'+new URLSearchParams({
  latitude:String(region.lat),longitude:String(region.lon),
  count:'24',interval_hours:String(pressureSampleIntervalHours(window)),
 }).toString()
}
function readingTimestamp(reading:WeatherReading):string|null{
 const exact=reading.matched_timestamp
 if(typeof exact==='string'&&Number.isFinite(Date.parse(exact)))return new Date(exact).toISOString()
 const raw=reading.weather?.weather_timestamp_unix
 const unix=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()?Number(raw):NaN
 if(Number.isFinite(unix)){
  const millis=unix>1e12?unix:unix*1000
  if(Number.isFinite(millis)&&millis>0)return new Date(millis).toISOString()
 }
 return null
}
const severityFor=(value:number,watch:number,high:number):PressureSeverity=>
 value>=high?'high':value>=watch?'watch':'normal'
const qatarDay=(iso:string)=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'Asia/Qatar',year:'numeric',month:'2-digit',day:'2-digit',
}).format(new Date(iso))
export function analyzeUtilityPressure(
 history:readonly WeatherHistory[],domain:UtilityDomain,window:PressureWindow,
 now=Date.now(),
):PressureAnalysis{
 const config=PRESSURE_METRICS[domain]
 const interval=pressureSampleIntervalHours(window)
 const windowMs=window==='daily'?24*3600000:7*24*3600000
 const byTimestamp=new Map<string,PressurePoint>()
 let dataSource:string|null=null
 for(const item of history){
  const reading=item.reading
  if(!reading)continue
  const at=readingTimestamp(reading)
  if(!at)continue // RequestedAt / stored_at are NOT proof of time of observation.
  const timestamp=Date.parse(at)
  if(timestamp>now+15*60000||timestamp<now-windowMs-2*3600000)continue
  const primary=weatherNumber(reading,domain==='water'?'vpd_kpa':'temperature_c')
  if(primary===null||primary<0||primary> (domain==='water'?12:65))continue
  const secondary=weatherNumber(reading,
   domain==='water'?'eto_daily_estimated_mm_day':'thermal_stress_index_0_100')
  byTimestamp.set(at,{at,value:primary,
   secondary:secondary!==null&&secondary>=0?secondary:null,
   severity:severityFor(primary,config.watch,config.high)})
  if(typeof reading.data_source==='string'&&reading.data_source.trim())
   dataSource=reading.data_source
 }
 const points=[...byTimestamp.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
 const peak=points.reduce<PressurePoint|null>((best,current)=>
  !best||current.value>best.value?current:best,null)
 const latest=points.at(-1)??null
 const avg=points.length?points.reduce((sum,p)=>sum+p.value,0)/points.length:null
 const first=points[0]??null
 const changePct=first&&latest&&first.value>0&&points.length>1?
  (latest.value-first.value)/first.value*100:null
 const daily=new Map<string,{date:string;peak:PressurePoint;count:number}>()
 for(const point of points){
  const date=qatarDay(point.at),prev=daily.get(date)
  if(!prev)daily.set(date,{date,peak:point,count:1})
  else daily.set(date,{date,peak:prev.peak.value>=point.value?prev.peak:point,
    count:prev.count+1})
 }
 const highPoints=points.filter(p=>p.severity==='high')
 const watchPoints=points.filter(p=>p.severity==='watch')
 const issues:PressureIssue[]=[]
 if(highPoints.length)issues.push({
  id:'high-peak',severity:'high',at:peak?.at??null,
  title:domain==='water'?'High atmospheric drying pressure':'High cooling-pressure temperature',
  detail:domain==='water'?
   'VPD reached the screening band ≥2.5 kPa. Verify field ETc, humidity and actual irrigation; this is not measured water consumption.':
   'Ambient temperature reached ≥40°C. Examine cooling exposure and actual KAHRAMAA loads; this is not verified national peak demand.',
 })
 else if(watchPoints.length)issues.push({
  id:'watch-peak',severity:'watch',at:peak?.at??null,
  title:domain==='water'?'Elevated atmospheric drying demand':'Elevated cooling-pressure temperature',
  detail:domain==='water'?
   'VPD reached ≥1.6 kPa in source observations; use crop Kc, measured soil moisture and plant stage before control changes.':
   'Ambient temperature reached ≥34°C; review facility demand and operating reserves using measured load data.',
 })
 if(highPoints.length>=3)issues.push({
  id:'repeated-high',severity:'watch',at:highPoints.at(-1)!.at,
  title:'Repeated high screening readings',
  detail:highPoints.length+' separate sampled observations exceeded the high band. Sampling is not continuous monitoring.',
 })
 if(points.length< (window==='daily'?8:10))issues.push({
  id:'low-coverage',severity:'watch',at:null,
  title:'Incomplete historical coverage',
  detail:'Only '+points.length+'/24 requested timestamps have usable source-verified observations; a sampled peak can miss the true maximum.',
 })
 if(latest&&now-Date.parse(latest.at)>12*3600000)issues.push({
  id:'stale',severity:'watch',at:latest.at,
  title:'Historical source not current',
  detail:'Latest valid observation is more than 12 hours old. No present-day condition or active infrastructure incident can be inferred.',
 })
 return {
  domain,window,label:config.label,metric:config.metric,unit:config.unit,
  sampleIntervalHours:interval,expected:24,observed:points.length,
  points,dailyPeaks:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),
  peak,latest,average:avg,changePct,highCount:highPoints.length,
  watchCount:watchPoints.length,issues,dataSource,lastAt:latest?.at??null,
 }
}
