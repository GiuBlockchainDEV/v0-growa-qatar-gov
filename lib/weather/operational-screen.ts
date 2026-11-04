/**
 * Read-only weather decision screening.
 *
 * Uses ONLY values already returned by Growa's authorized Weather API.
 * Thresholds below are indicative UI screening bands (not legal limits,
 * crop-specific control setpoints, treatment advice, or a weather forecast).
 */
export type WeatherData = Record<string,unknown>
export type WeatherReading = WeatherData & {
 weather?:WeatherData
 solar?:WeatherData
 agronomy?:WeatherData
 matched_timestamp?:string|null
 stored_at?:string|null
 requested_at?:string|null
 data_source?:string
}
export type WeatherHistory = {
 requestedAt:string
 reading:WeatherReading|null
 error?:string|null
}
export type ScreenState='high'|'watch'|'normal'|'unavailable'
export type ScreenItem={
 id:'heat'|'spraying'|'water'|'disease'
 title:string
 state:ScreenState
 numeric:number|null
 unit:string
 basis:string
 detail:string
 action:string
}
const scopes=['weather','solar','agronomy'] as const
export function weatherNumber(reading:WeatherReading|null|undefined,key:string):number|null{
 if(!reading)return null
 for(const scope of scopes){
  const obj=reading[scope]
  if(obj&&typeof obj==='object'&&!Array.isArray(obj)){
   const value=(obj as WeatherData)[key]
   const num=typeof value==='number'?value:
    typeof value==='string'&&value.trim()!==''?Number(value):NaN
   if(Number.isFinite(num))return num
  }
 }
 const value=reading[key]
 const n=typeof value==='number'?value:
  typeof value==='string'&&value.trim()!==''?Number(value):NaN
 return Number.isFinite(n)?n:null
}
export function observationStatus(reading:WeatherReading|null|undefined,nowMs:number){
 if(!reading)return {label:'No observation',mode:'missing' as const,ageHours:null}
 const ts=[reading.matched_timestamp,reading.stored_at,reading.requested_at]
  .find(x=>typeof x==='string'&&Number.isFinite(Date.parse(x)))
 if(!ts)return {label:'Time unverified',mode:'unknown' as const,ageHours:null}
 const time=Date.parse(ts)
 const hours=(nowMs-time)/3600000
 if(!Number.isFinite(hours)||hours<-.25)
  return {label:'Timestamp needs review',mode:'unknown' as const,ageHours:null}
 if(hours>24)return {label:'Historical snapshot',mode:'historical' as const,ageHours:hours}
 if(hours>3)return {label:'Older observation',mode:'older' as const,ageHours:hours}
 return {label:'Recent observation',mode:'recent' as const,ageHours:hours}
}
const level=(value:number|null,watch:number,high:number):ScreenState=>
 value===null?'unavailable':value>=high?'high':value>=watch?'watch':'normal'
export function assessWeatherOperations(reading:WeatherReading|null):ScreenItem[]{
 const temp=weatherNumber(reading,'temperature_c')
 const riskHeat=weatherNumber(reading,'thermal_stress_index_0_100')
 const drift=weatherNumber(reading,'spray_drift_risk_index_0_100')
 const wind=weatherNumber(reading,'wind_speed_km_h')
 const et0=weatherNumber(reading,'eto_daily_estimated_mm_day')
 const fungal=weatherNumber(reading,'fungal_risk_index_0_100')
 const humidity=weatherNumber(reading,'humidity_percent')
 const heatIndexUsed=riskHeat!==null
 const driftIndexUsed=drift!==null
 const fungusIndexUsed=fungal!==null
 return [
  {
   id:'heat',title:'Heat exposure',
   state:level(heatIndexUsed?riskHeat:temp,heatIndexUsed?40:34,heatIndexUsed?70:40),
   numeric:heatIndexUsed?riskHeat:temp,
   unit:heatIndexUsed?'/100':'°C',
   basis:heatIndexUsed?'Weather API thermal-stress index':'Air-temperature screening proxy',
   detail:heatIndexUsed?'Indicative index bands: 40/70. Check crop and protected environment response.':
    'Indicative temperature bands: 34/40°C. This is not canopy temperature.',
   action:'Review crop heat protection and greenhouse climate settings against actual sensor conditions.',
  },
  {
   id:'spraying',title:'Spray conditions',
   state:level(driftIndexUsed?drift:wind,driftIndexUsed?40:14,driftIndexUsed?70:22),
   numeric:driftIndexUsed?drift:wind,
   unit:driftIndexUsed?'/100':'km/h',
   basis:driftIndexUsed?'Weather API spray-drift index':'Wind-speed screening proxy',
   detail:driftIndexUsed?'Indicative index bands: 40/70, not a regulatory spray threshold.':
    'Indicative wind-speed bands: 14/22 km/h. Gusts and label restrictions also matter.',
   action:'Check measured gusts, spray label restrictions and on-site conditions before field application.',
  },
  {
   id:'water',title:'Irrigation demand',
   state:level(et0,5,7),
   numeric:et0,unit:'mm/day',
   basis:'Weather API estimated reference ET₀',
   detail:'Indicative ET₀ screening: 5/7 mm per day. ET₀ alone is not crop irrigation demand.',
   action:'Calculate crop ETc with Kc, soil water, system efficiency and actual rainfall before scheduling.',
  },
  {
   id:'disease',title:'Humidity & fungal exposure',
   state:level(fungusIndexUsed?fungal:humidity,fungusIndexUsed?40:80,fungusIndexUsed?70:90),
   numeric:fungusIndexUsed?fungal:humidity,
   unit:fungusIndexUsed?'/100':'%',
   basis:fungusIndexUsed?'Weather API fungal-risk index':'Relative-humidity screening proxy',
   detail:fungusIndexUsed?'Indicative index bands: 40/70. This is not a disease diagnosis.':
    'Indicative humidity bands: 80/90%. Leaf wetness and crop-specific factors are unknown.',
   action:'Check leaf wetness, crop susceptibility and local microclimate before disease interventions.',
  },
 ]
}
export type WeatherTrendPoint={at:string;value:number|null}
export function weatherTrend(
 history:readonly WeatherHistory[],key:string,
):WeatherTrendPoint[]{
 return [...history].map(point=>({
  at:point.reading?.matched_timestamp||point.requestedAt,
  value:weatherNumber(point.reading,key),
 })).filter(point=>Number.isFinite(Date.parse(point.at)))
  .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
}
export function historyQuality(history:readonly WeatherHistory[]){
 const valid=history.filter(x=>x.reading!==null).length
 const unique=new Set(history.filter(x=>x.reading!==null)
  .map(x=>x.reading?.matched_timestamp||x.requestedAt)).size
 return {valid,unique,total:history.length,complete:history.length>=20&&unique>=20}
}
