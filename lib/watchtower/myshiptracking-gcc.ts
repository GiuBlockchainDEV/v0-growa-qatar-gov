/**
 * MyShipTracking licensed GCC radar.
 *
 * Adapted from the user's Python workflow: discover recent calls in strategic
 * ports, examine bounded MMSI candidates, exclude stationary vessels (<1.5 kn)
 * and local same-port voyages, and attach source-reported port endpoints.
 *
 * Commercial/public website scraping and browser bot evasion are NOT used.
 * API terms permit internal organizational use only. No requests without a
 * server key + explicit opt-in + organization allowlist. All prices are in
 * provider credits, never estimates of food cargo or loss.
 */
import {coordinate,epoch,mergeAssets,type TrackingAsset} from './global-tracking'
import {knownPort,type RouteEndpoint,type RouteItinerary} from './itinerary-sources'
import {withModeledSeaLegs} from './itinerary-sea'

export const GCC_RADAR_INTERVAL_MS=5*60000
export const GCC_RADAR_MIN_SPEED_KNOTS=1.5
export const GCC_PORTS=[
  {id:'AEJEA',label:'Jebel Ali · Dubai (UAE)',lat:25.02413,lon:55.04112,unloco:'AEJEA'},
  {id:'QAHMD',label:'Hamad Port (Qatar)',lat:25.02946,lon:51.62450,unloco:'QAHMD'},
  {id:'QADOH',label:'Doha Port (Qatar)',lat:25.30644,lon:51.54737,unloco:'QADOH'},
  {id:'QARLF',label:'Ras Laffan (Qatar)',lat:25.91669,lon:51.62693,unloco:'QARLF'},
] as const
export type GccHubId=typeof GCC_PORTS[number]['id']
export type GccRadarState='not_configured'|'available'|'partial'|'unavailable'
export type GccHubReport={
  id:GccHubId;label:string;status:GccRadarState
  candidates:number;observed:number;withRoutes:number
  sourceUrl:string;detail:string
}
export type GccRadarSnapshot={
  generatedAt:string;refreshSeconds:300;source:'MyShipTracking API'
  status:GccRadarState;configured:boolean
  hubs:GccHubReport[];assets:TrackingAsset[];sourceUrl:string
  checked:number;moving:number;withRoutes:number
  sourceNote:string;maxShipsPerHub:number
  creditsCharged:number|null
}
type Row=Record<string,unknown>
const object=(v:unknown):Row=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:{}
const text=(v:unknown,max=100)=>typeof v==='string'?v.trim().replace(/[<>]/g,'').slice(0,max):''
const num=(v:unknown):number|null=>{
  const value=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
  return Number.isFinite(value)?value:null
}
const clean=(v:unknown)=>text(v,80).toUpperCase().replace(/[^A-Z0-9]/g,'')
const date=(v:unknown):string|null=>{
  const t=epoch(v)
  return t!==null&&t>0&&t<=Date.now()+60000?new Date(t).toISOString():null
}
function dataRows(raw:unknown):Row[]{
  if(Array.isArray(raw))return raw.slice(0,1200).map(object)
  const root=object(raw)
  if(root.status==='error')throw Error('MyShipTracking API returned an error')
  if(root.status!=='success')throw Error('MyShipTracking API response is not authenticated')
  if(!Array.isArray(root.data))throw Error('MyShipTracking API data array missing')
  return root.data.slice(0,1200).map(object)
}
function mmsi(value:unknown):string|null{
  const id=String(value??'').trim()
  return /^[1-9]\d{8}$/.test(id)?id:null
}
function safePort(name:unknown,code:unknown):RouteEndpoint|null{
  const nameText=text(name,95)
  const codeText=clean(code)
  const local=GCC_PORTS.find(h=>h.unloco===codeText||clean(h.label)===clean(nameText))
  const known=knownPort(codeText)||knownPort(nameText)
  if(!known&&!nameText&&!/^[A-Z]{2}[A-Z0-9]{3}$/.test(codeText))return null
  return {
    name:nameText||known?.name||local?.label||codeText,
    code:known?.code||local?.unloco||(/^[A-Z]{2}[A-Z0-9]{3}$/.test(codeText)?codeText:null),
    country:known?.country??(local?.unloco.slice(0,2)??null),
    lat:known?.lat??local?.lat??null,lon:known?.lon??local?.lon??null,
  }
}
export function isDryCargoVessel(row:unknown):boolean{
  const r=object(row)
  const kind=[r.vessel_type,r.ship_type,r.type_name,r.category,r.vessel_category]
    .map(v=>text(v,60)).join(' ').toLowerCase()
  if(/tanker|lng|lpg|gas.carrier|chemical|fishing|passenger|tug|pilot|patrol|naval|yacht|dredger|offshore|workboat/.test(kind))
    return false
  if(/container|bulk.carrier|bulker|dry.cargo|general.cargo|cargo.ship|cargo.vessel|reefer|roll.on|roro|ro.ro|freight|vehicle.carrier|multipurpose|multi.purpose/.test(kind))
    return true
  // MyShipTracking vtype is a GROUP (not AIS type 70-79). Do not
  // misclassify all numerical groups as cargo without the text description.
  const ais=num(r.ais_type)
  return ais!==null&&ais>=70&&ais<80
}
export type GccPortCall={mmsi:string;event:'ARRIVAL'|'DEPARTURE';time:string;hubId:GccHubId}
export function parsePortCalls(raw:unknown,hubId:GccHubId,now=Date.now()):GccPortCall[]{
  const calls:GccPortCall[]=[]
  for(const r of dataRows(raw)){
    const id=mmsi(r.mmsi),event=text(r.event,12).toUpperCase()
    const stamp=date(r.time_utc)
    if(!id||!stamp||(event!=='DEPARTURE'&&event!=='ARRIVAL'))continue
    const age=now-Date.parse(stamp)
    if(age<0||age>4*86400000)continue
    calls.push({mmsi:id,event,time:stamp,hubId})
  }
  const unique=new Map<string,GccPortCall>()
  for(const call of calls.sort((a,b)=>b.time.localeCompare(a.time)))
    if(!unique.has(call.mmsi))unique.set(call.mmsi,call)
  return [...unique.values()]
}
export function parseMstVessels(
  raw:unknown,calls:readonly GccPortCall[],
  now=Date.now(),maxPerHub=4,
):TrackingAsset[]{
  const refs=new Map(calls.map(c=>[c.mmsi,c]))
  const counts=new Map<GccHubId,number>()
  const results:TrackingAsset[]=[]
  const data=dataRows(raw)
  for(const row of data){
    const id=mmsi(row.mmsi),call=id?refs.get(id):undefined
    if(!id||!call||!isDryCargoVessel(row))continue
    const pos=coordinate(row.lat,row.lng??row.lon)
    const received=date(row.received)
    if(!pos||!received||now-Date.parse(received)>7*86400000)continue
    const speed=num(row.speed)
    if(speed===null||speed<GCC_RADAR_MIN_SPEED_KNOTS||speed>55)continue
    if((counts.get(call.hubId)??0)>=maxPerHub)continue
    const reportedOrigin=safePort(row.last_port,row.last_port_unloco)
    const reportedDestination=safePort(row.next_port??row.destination,row.next_port_unloco)
    // A recent, source-backed DEPARTURE event may establish last port when
    // the extended vessel response omitted it. Not a cargo loading proof.
    const eventOrigin=call.event==='DEPARTURE'&&
      now-Date.parse(call.time)<=48*3600000?
        safePort(GCC_PORTS.find(h=>h.id===call.hubId)?.label,call.hubId):null
    const origin=reportedOrigin??eventOrigin
    const destination=reportedDestination
    // Exclude local loops only when BOTH endpoints were explicitly identified;
    // never discard a vessel merely because a guessed default equals destination.
    if(origin?.code&&destination?.code&&origin.code===destination.code)continue
    const description='MyShipTracking API last-port / destination references. '+
      (reportedOrigin?'Last port reported by provider; ':'Origin from a documented recent departure event; ')+
      'neither is evidence of cargo loading. Destination is AIS/port-call information '+
      'that can change. Ocean route is a model, not an observed historical track.'
    const itinerary:RouteItinerary|null=origin||destination?{
      origin,destination,departureAt:date(row.last_port_dep_utc)??(eventOrigin?call.time:null),
      etaAt:date(row.next_port_eta_utc??row.eta),
      source:'myshiptracking_voyage',sourceUrl:'https://api.myshiptracking.com/docs/vessel-current-position-api',
      confidence:'crew_reported',description,
    }:null
    const course=num(row.course),imo=String(row.imo??'')
    results.push({
      id:'sea:'+id,kind:'vessel',label:text(row.vessel_name??row.name,80)||id,
      ...pos,heading:course!==null&&course>=0&&course<360?course:null,
      speedKnots:speed,altitudeFt:null,observedAt:received,
      source:'MyShipTracking API',
      sourceUrl:/^[1-9]\d{6}$/.test(imo)?
        'https://www.myshiptracking.com/vessels/'+imo:
        'https://www.myshiptracking.com/',
      type:text(row.vessel_type,65)||'AIS cargo class',cargo:'ais_cargo_class',
      destination:text(row.destination??row.next_port,100)||null,
      foodCargoVerified:false,
      itinerary,hubId:call.hubId,observationBasis:'position_report',
    })
    counts.set(call.hubId,(counts.get(call.hubId)??0)+1)
  }
  return mergeAssets(results)
}
export function isGccRadarAllowed(orgId:string):boolean{
  const allowed=(process.env.WATCHTOWER_MST_ALLOWED_ORG_IDS??'')
    .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(orgId.toLowerCase())
}
const enabled=()=>process.env.WATCHTOWER_MST_ENABLED==='true'
const apiKey=()=>process.env.MYSHIPTRACKING_API_KEY?.trim()??''
const maxShips=()=>{
  const n=Number(process.env.WATCHTOWER_MST_MAX_SHIPS_PER_HUB??'4')
  return Number.isInteger(n)?Math.max(1,Math.min(12,n)):4
}
const apiBase='https://api.myshiptracking.com/api/v2'
const docUrl='https://api.myshiptracking.com/docs/vessels-in-zone'
const safeFetch=async(path:string,cacheSeconds:number)=>{
  const key=apiKey()
  if(!key)throw Error('MyShipTracking API key missing')
  const response=await fetch(apiBase+path,{
    headers:{'x-api-key':key,Accept:'application/json'},
    signal:AbortSignal.timeout(11000),
    next:{revalidate:cacheSeconds},
  })
  const charged=Number(response.headers.get('X-Credit-Charged')??0)
  const raw=await response.text()
  if(raw.length>2600000)throw Error('MyShipTracking response size exceeds limit')
  if(!response.ok)throw Error('MyShipTracking API HTTP '+response.status)
  const json=JSON.parse(raw) as unknown
  return {json,credits:Number.isFinite(charged)?charged:null}
}
function emptySnapshot(status:GccRadarState,detail:string,max:number):GccRadarSnapshot{
  return {
    generatedAt:new Date().toISOString(),refreshSeconds:300,source:'MyShipTracking API',
    status,configured:status!=='not_configured',
    hubs:GCC_PORTS.map(p=>({id:p.id,label:p.label,status,candidates:0,
      observed:0,withRoutes:0,sourceUrl:docUrl,detail})),
    assets:[],sourceUrl:docUrl,checked:0,moving:0,withRoutes:0,
    sourceNote:detail,maxShipsPerHub:max,creditsCharged:null,
  }
}
let cached:{until:number;result:GccRadarSnapshot}|null=null
let pending:Promise<GccRadarSnapshot>|null=null
/** Five-minute on-demand cache. No Vercel cron, no continuous billing. */
export async function getGccRadarSnapshot():Promise<GccRadarSnapshot>{
  const limit=maxShips()
  if(!enabled()||!apiKey())
    return emptySnapshot('not_configured',
      'Licensed internal MyShipTracking feed requires MYSHIPTRACKING_API_KEY, WATCHTOWER_MST_ENABLED=true and an allowed organization.',limit)
  if(cached&&cached.until>Date.now())return cached.result
  if(pending)return pending
  pending=(async()=>{
    let charge=0
    const discoveries=await Promise.allSettled(GCC_PORTS.map(async hub=>{
      const response=await safeFetch('/port/calls?unloco='+hub.unloco+'&days=2',3600)
      charge+=response.credits??0
      const candidates=parsePortCalls(response.json,hub.id).slice(0,Math.min(24,limit*3))
      return {hub,candidates}
    }))
    const allCalls=discoveries.flatMap(r=>r.status==='fulfilled'?r.value.candidates:[])
      .sort((a,b)=>b.time.localeCompare(a.time))
    const unique=new Map<string,GccPortCall>()
    const perHub=new Map<GccHubId,number>()
    for(const call of allCalls){
      if(unique.has(call.mmsi)||(perHub.get(call.hubId)??0)>=limit*2)continue
      unique.set(call.mmsi,call)
      perHub.set(call.hubId,(perHub.get(call.hubId)??0)+1)
    }
    const candidates=[...unique.values()]
    let assets:TrackingAsset[]=[]
    let providerOK=false
    if(candidates.length){
      try{
        // The extended bulk lookup is credit-metered (3 credits/vessel).
        // At most 2x the displayed sample per hub are requested, to
        // compensate for passenger/tanker/stationary candidates.
        const ids=candidates.map(c=>c.mmsi).join(',')
        const response=await safeFetch('/vessel/bulk?response=extended&mmsi='+ids,300)
        charge+=response.credits??0
        assets=parseMstVessels(response.json,candidates,Date.now(),limit)
        providerOK=true
        // Cap ocean-model CPU, then leave remaining source-reported names
        // visible rather than forging maritime geometries.
        let modeled=0
        assets=assets.map(asset=>{
          const route=asset.itinerary
          if(route?.origin?.lat==null||route?.origin?.lon==null||route?.destination?.lat==null||route?.destination?.lon==null||modeled>=12)
            return asset
          modeled++
          return {...asset,itinerary:withModeledSeaLegs(route,asset)}
        })
      }catch{ /* provider errors reported in hub statuses below */ }
    }
    const hubs:GccHubReport[]=GCC_PORTS.map((hub,i)=>{
      const discovery=discoveries[i]
      const ok=discovery.status==='fulfilled'
      const count=ok?discovery.value.candidates.length:0
      const local=assets.filter(a=>a.hubId===hub.id)
      const routes=local.filter(a=>a.itinerary?.modelSeaLegs).length
      return {id:hub.id,label:hub.label,
        status:ok&&(!candidates.length||providerOK)?'available':
          ok?'partial':'unavailable',
        candidates:count,observed:local.length,withRoutes:routes,
        sourceUrl:'https://api.myshiptracking.com/docs/port-calls',
        detail:ok?(providerOK||!candidates.length?
          'Recent port calls + extended AIS vessel details; speed >=1.5 kn.':
          'Port calls read, bulk vessel lookup unavailable.'):
          'Port call discovery unavailable. Check endpoint entitlement and credits.',
      }
    })
    const good=hubs.filter(h=>h.status==='available').length
    const result:GccRadarSnapshot={
      generatedAt:new Date().toISOString(),refreshSeconds:300,
      source:'MyShipTracking API',configured:true,
      status:good===GCC_PORTS.length?'available':good||assets.length?'partial':'unavailable',
      hubs,assets,sourceUrl:docUrl,
      checked:candidates.length,moving:assets.length,
      withRoutes:assets.filter(a=>a.itinerary?.modelSeaLegs).length,
      sourceNote:'Internal-use licensed terrestrial AIS. Last-port and declared destinations are NOT proof of food cargo. Routes are navigable network references, NOT confirmed voyages. Data is refreshed on demand up to every five minutes; charges may apply.',
      maxShipsPerHub:limit,creditsCharged:charge||null,
    }
    cached={result,until:Date.now()+(result.status==='unavailable'?60000:GCC_RADAR_INTERVAL_MS)}
    return result
  })()
  try{return await pending}finally{pending=null}
}
