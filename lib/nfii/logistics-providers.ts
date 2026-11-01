import {getExportHub,QATAR_PORT,type GeoPoint} from './logistics-lanes'
import type {RouteInputs} from './logistics-screening'
import {readSeaRouteGeometry,matchesRequestedSeaPorts,type GeoLine,type GeoPointTuple} from './logistics-route-geometry'
import {fetchRoadEvidence,type RoadEvidence} from './logistics-road-api'
import {fetchOpenOceanFallback} from './logistics-open-ocean'

type Obj=Record<string,unknown>
const obj=(v:unknown):Obj=>typeof v==='object'&&v!==null&&!Array.isArray(v)?v as Obj:{}
const num=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null
const marineApi='https://api.searoutes.com'
export type ProviderState='available'|'unconfigured'|'unavailable'|'missing'|'estimated'
export type ExternalLogistics={
 seaRoutes:RouteInputs['seaDistances']
 roadRoute:RoadEvidence|null
 lpi:number|null;lpiYear:number|null;waves:number|null;weatherAgeHours:number|null
 states:{searoutes:ProviderState;worldBank:ProviderState;marineWeather:ProviderState;googleRoad:ProviderState}
 refs:{searoutes:string|null;worldBank:string|null;marineWeather:string|null;googleRoad:string|null}
 messages:string[]
}
export function extractSeaRoute(data:unknown):{km:number;durationDays:number|null;geometry:GeoLine|null}|null{
  const root=obj(data)
  const features=Array.isArray(root.features)?root.features:[]
  const feature=obj(features[0])
  const p=obj(feature.properties)
  const dist=num(p.distance)??num(root.distance)
  const duration=num(p.duration)??num(root.duration)
  if(dist===null||dist<1000||dist>100_000_000)return null
  return {km:dist/1000,durationDays:duration===null||duration===0?
    null:duration/86400000,geometry:readSeaRouteGeometry(data)}
}
export function seaRoutesRequest(code:string,via:'direct'|'jebel'|'salalah'){
  const hub=getExportHub(code)
  if(!hub)throw Error('Unknown reference export hub')
  const start=hub.unlocode
  // Port geocodes are reference waypoints, not scheduled transshipments.
  const middle=via==='jebel'?'AEJEA':via==='salalah'?'OMSLL':null
  const locations=[start,...(middle?[middle]:[]),QATAR_PORT.code].join(';')
  return marineApi+'/route/v2/sea/'+locations+'?avoidHRA=true&speedInKts=14'
}
export async function fetchSeaRoutes(country:string):Promise<Pick<ExternalLogistics,
  'seaRoutes'|'messages'>&{state:ProviderState;source:string|null}>{
  const key=process.env.SEAROUTES_API_KEY
  if(!key)return {seaRoutes:null,messages:['SEAROUTES_API_KEY not configured. No seagoing route/ETA confirmed.'],state:'unconfigured',source:null}
  const hub=getExportHub(country)
  if(!hub)return {seaRoutes:null,messages:['No reference hub.'],state:'missing',source:null}
  const requests:readonly [string,'direct'|'jebel'|'salalah'][]=[
    ['sea_direct','direct'],['sea_jebel_ali','jebel'],['sea_salalah','salalah'],
  ]
  const desired=['SA','AE','OM','KW','BH'].includes(country)?
    requests.slice(0,1):requests
  const resolved=await Promise.all(desired.map(async([id,via])=>{
    const url=seaRoutesRequest(country,via)
    try{
      const result=await fetch(url,{headers:{'x-api-key':key,Accept:'application/json'},
        signal:AbortSignal.timeout(7800),next:{revalidate:21600}})
      if(!result.ok)return null
      const json=await result.json() as unknown
      const parsed=extractSeaRoute(json)
      const from:GeoPointTuple=[hub.sea.lat,hub.sea.lon]
      const to:GeoPointTuple=[QATAR_PORT.lat,QATAR_PORT.lon]
      const viaPoint:GeoPointTuple|undefined=via==='jebel'?[24.99,55.06]:
        via==='salalah'?[16.94,54.01]:undefined
      if(!parsed?.geometry||!matchesRequestedSeaPorts(parsed.geometry,from,to,viaPoint))
        return null
      return {id,km:parsed.km,durationDays:parsed.durationDays,geometry:parsed.geometry,
        routeUrl:'https://developer.searoutes.com/reference/getsearoute'}
    }catch{return null}
  }))
  const records=resolved.filter((r):r is NonNullable<typeof r>=>Boolean(r))
  if(!records.length)return {seaRoutes:null,messages:['SeaRoutes returned no usable geometries; departure schedule and ETA unavailable.'],
    state:'unavailable',source:null}
  const seaRoutes:Record<string,{km:number;durationDays:number|null;routeUrl:string;geometry:GeoLine|null}>=Object.fromEntries(records.map(r=>[r.id,{
    km:r.km,durationDays:r.durationDays,geometry:r.geometry,routeUrl:r.routeUrl}]))
  return {seaRoutes:seaRoutes as NonNullable<ExternalLogistics['seaRoutes']>,
    messages:records.length<desired.length?['Some sea corridor variants were unavailable.']:[],
    state:'available',source:'https://developer.searoutes.com/reference/getsearoute'}
}
export function parseLpi(raw:unknown):{value:number;year:number}|null{
  if(!Array.isArray(raw)||!Array.isArray(raw[1]))return null
  const row=raw[1].find((v:unknown)=>{
    const t=obj(v),value=num(t.value)
    return value!==null&&value>=1&&value<=5&&
      Number.isInteger(Number(t.date))
  })
  if(!row)return null
  const item=obj(row)
  return {value:Number(item.value),year:Number(item.date)}
}
export async function fetchWorldBankLpi(country:string):
  Promise<{value:number|null;year:number|null;state:ProviderState;url:string}>{
  const url='https://api.worldbank.org/v2/country/'+country+
    '/indicator/LP.LPI.OVRL.XQ?format=json&per_page=80'
  try{
    const res=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(5500)})
    if(!res.ok)throw Error('world bank unavailable')
    const answer=parseLpi(await res.json() as unknown)
    return {value:answer?.value??null,year:answer?.year??null,
      state:answer?'available':'missing',url}
  }catch{return {value:null,year:null,state:'unavailable',url}}
}
export function parseMarineWave(raw:unknown):number|null{
  const daily=obj(obj(raw).daily)
  const data=daily.wave_height_max
  if(!Array.isArray(data))return null
  const valid=data.filter((n):n is number=>typeof n==='number'&&
    Number.isFinite(n)&&n>=0&&n<=30)
  return valid.length?Math.max(...valid):null
}
export async function fetchMarineWave(location:GeoPoint):
 Promise<{value:number|null;state:ProviderState;url:string|null}>{
  // Commercial app: public free endpoint is not assumed licensed.
  const key=process.env.OPEN_METEO_COMMERCIAL_API_KEY
  if(!key)return {value:null,state:'unconfigured',url:null}
  const url=new URL('https://customer-marine-api.open-meteo.com/v1/marine')
  url.searchParams.set('latitude',String(location.lat))
  url.searchParams.set('longitude',String(location.lon))
  url.searchParams.set('daily','wave_height_max')
  url.searchParams.set('forecast_days','7')
  url.searchParams.set('apikey',key)
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(6500),
      next:{revalidate:3600}})
    if(!response.ok)return {value:null,state:'unavailable',url:null}
    const value=parseMarineWave(await response.json() as unknown)
    return {value,state:value===null?'missing':'available',
      url:'https://open-meteo.com/en/docs/marine-weather-api'}
  }catch{return {value:null,state:'unavailable',url:null}}
}
export async function collectLogisticsEvidence(country:string):Promise<ExternalLogistics>{
  const hub=getExportHub(country)
  if(!hub)throw Error('Missing origin hub')
  const [sea,lpi,marine,road]=await Promise.all([
    fetchSeaRoutes(country),fetchWorldBankLpi(country),
    fetchMarineWave(hub.sea),fetchRoadEvidence(country),
  ])
  let seaDistances=sea.seaRoutes
  const sourceStates={...{searoutes:sea.state,worldBank:lpi.state,marineWeather:marine.state,
    googleRoad:road.status==='not_applicable'?'missing' as const:road.status}}
  const messages=[...sea.messages]
  if(!seaDistances?.sea_direct?.geometry?.length){
    const local=await fetchOpenOceanFallback(country)
    if(local.route){
      seaDistances={...(seaDistances??{}),sea_direct:local.route}
      sourceStates.searoutes='estimated'
    }
    messages.push(local.message)
  }
  return {
    seaRoutes:seaDistances,roadRoute:road.data,lpi:lpi.value,lpiYear:lpi.year,
    waves:marine.value,weatherAgeHours:null,
    states:sourceStates,
    refs:{searoutes:sea.source,
      worldBank:lpi.state==='available'?lpi.url:null,
      marineWeather:marine.url,googleRoad:road.data?.sourceUrl??null},
    messages,
  }
}
