/**
 * Data-tracking.net maritime chokepoint observations.
 *
 * Public, CC BY 4.0 AIS-derived positions, NOT a globally complete ship feed.
 * Official documented coverage: Hormuz and Bab el-Mandeb only.
 * Polls are published about every 30 minutes. Source snapshots may be delayed.
 * A ship's type does NOT identify whether it carries food.
 */
import {coordinate,epoch,mergeAssets,type TrackingAsset} from './global-tracking'

export type ChokepointId='hormuz'|'bab_el_mandeb'|'suez'|'malacca'|'panama'|'gibraltar'|'bosporus'
export type ChokepointState='partial'|'stale'|'unavailable'|'not_covered'
export type ChokepointInfo={
  id:ChokepointId
  label:string
  lat:number
  lon:number
  feed:boolean
  pageUrl:string
}
export const TRACKED_CHOKEPOINTS:readonly ChokepointInfo[]=[
  {id:'hormuz',label:'Strait of Hormuz',lat:26.56,lon:56.25,feed:true,pageUrl:'https://hormuz.data-tracking.net/live-map'},
  {id:'bab_el_mandeb',label:'Bab el-Mandeb',lat:12.58,lon:43.33,feed:true,pageUrl:'https://hormuz.data-tracking.net/bab-el-mandeb'},
  {id:'suez',label:'Suez Canal',lat:30.45,lon:32.35,feed:false,pageUrl:'https://hormuz.data-tracking.net/api-docs'},
  {id:'malacca',label:'Strait of Malacca',lat:2.5,lon:101.2,feed:false,pageUrl:'https://hormuz.data-tracking.net/api-docs'},
  {id:'panama',label:'Panama Canal',lat:9.08,lon:-79.68,feed:false,pageUrl:'https://hormuz.data-tracking.net/api-docs'},
  {id:'gibraltar',label:'Strait of Gibraltar',lat:35.98,lon:-5.6,feed:false,pageUrl:'https://hormuz.data-tracking.net/api-docs'},
  {id:'bosporus',label:'Bosporus',lat:41.12,lon:29.06,feed:false,pageUrl:'https://hormuz.data-tracking.net/api-docs'},
]
export type ChokepointReport={
  id:ChokepointId
  label:string
  state:ChokepointState
  vesselCount:number|null
  freshObservedCount:number|null
  crossings24h:number|null
  lastPoll:string|null
  checkedAt:string
  sourceUrl:string
  detail:string
}
export type DataTrackingSnapshot={
  generatedAt:string
  source:'hormuz.data-tracking.net'
  sourceUrl:'https://hormuz.data-tracking.net/api-docs'
  license:'CC BY 4.0'
  cadenceMinutes:30
  assets:TrackingAsset[]
  chokepoints:ChokepointReport[]
  disclaimer:string
}
type Row=Record<string,unknown>
const obj=(raw:unknown):Row=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Row:{}
const string=(raw:unknown,max=100):string=>
  typeof raw==='string'?raw.trim().replace(/[<>]/g,'').slice(0,max):''
const num=(raw:unknown):number|null=>{
  const n=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()?Number(raw):NaN
  return Number.isFinite(n)?n:null
}
const date=(raw:unknown):string|null=>{
  const t=epoch(raw)
  return t!==null&&t>=Date.UTC(2020,0,1)&&t<=Date.now()+60000?
    new Date(t).toISOString():null
}
function rows(raw:unknown):Row[]{
  const root=obj(raw),data=obj(root.data)
  const candidates=[raw,root.ships,root.vessels,root.results,root.positions,
    data.ships,data.vessels,data.results,data.positions]
  for(const candidate of candidates){
    if(Array.isArray(candidate))return candidate.slice(0,12000).map(obj)
    // Some API versions expose a dictionary keyed by MMSI.
    if(candidate&&typeof candidate==='object'){
      const values=Object.values(candidate as Row)
      if(values.length&&values.length<=12000&&values.every(v=>v&&typeof v==='object'))
        return values.map(obj)
    }
  }
  return []
}
function timestamp(raw:unknown):string|null{
  const root=obj(raw),data=obj(root.data)
  return date(root.last_poll??root.lastPoll??root.poll_timestamp??
    root.updated_at??root.as_of??data.last_poll??data.lastPoll??data.updated_at)
}
export function dryCargoCategory(raw:unknown):boolean{
  const r=obj(raw)
  const fields=[r.ship_type,r.vessel_type,r.category,r.type,r.ship_category,
    r.shiptype,r.shipType,r.vessel_category,r.type_name]
  const code=fields.map(num).find(n=>n!==null&&n>=0&&n<100)
  const categories=fields.map(v=>string(v,80)).filter(Boolean).join(' ').toLowerCase()
  if(/tanker|oil|chemical|lng|lpg|fishing|tug|passenger|yacht|cruise|offshore|pilot|dredg/.test(categories))
    return false
  if(code!==undefined&&code!==null&&code>=70&&code<80)return true
  return /container|bulk|general cargo|cargo|reefer|refrigerated|ro.ro|roll.on|freight|vehicle.carrier|multipurpose|multi.purpose|livestock carrier/.test(categories)
}
const maxSnapshotAge=7*86400000
export function parseDataTrackingShips(raw:unknown,id:'hormuz'|'bab_el_mandeb',now=Date.now()):{
  assets:TrackingAsset[]
  lastPoll:string|null
  totalRows:number
  timestamped:number
}{
  const root=obj(raw),data=obj(root.data)
  const poll=timestamp(raw)
  const sourceName='hormuz.data-tracking.net AIS'
  const site=id==='hormuz'
    ?'https://hormuz.data-tracking.net/live-map'
    :'https://hormuz.data-tracking.net/bab-el-mandeb'
  const values=rows(raw)
  let timestamped=0
  const parsed:TrackingAsset[]=[]
  for(const value of values){
    const pos=obj(value.position),ais=obj(value.AIS)
    const row={...ais,...value}
    if(!dryCargoCategory(row))continue
    const mmsi=String(row.mmsi??row.MMSI??row.mmsi_number??'').trim()
    if(!/^[1-9]\d{8}$/.test(mmsi))continue
    const point=coordinate(row.lat??row.latitude??row.LATITUDE??pos.lat??pos.latitude,
      row.lon??row.lng??row.longitude??row.LONGITUDE??pos.lon??pos.lng??pos.longitude)
    if(!point)continue
    const perShip=date(row.timestamp??row.last_seen??row.last_seen_at??
      row.last_position_at??row.position_time??row.updated_at??row.time??pos.timestamp)
    const observedAt=perShip??poll
    if(!observedAt)continue
    const age=now-Date.parse(observedAt)
    if(age < -60000||age > maxSnapshotAge)continue
    if(perShip)timestamped++
    const heading=num(row.course??row.cog??row.COURSE??row.heading??row.HEADING)
    const speed=num(row.speed??row.sog??row.speed_knots??row.SPEED)
    const imo=String(row.imo??row.IMO??'')
    const shipType=[row.ship_type,row.vessel_type,row.type_name,row.category,row.type]
      .map(v=>string(v,45)).find(v=>v&&Number.isNaN(Number(v)))??'Cargo vessel (AIS category)'
    const destination=string(row.destination??row.dest??row.DESTINATION,80)
    const label=string(row.name??row.ship_name??row.vessel_name??row.NAME,80)||mmsi
    parsed.push({
      id:'sea:'+mmsi,kind:'vessel',label,...point,
      heading:heading!==null&&heading>=0&&heading<360?heading:null,
      speedKnots:speed!==null&&speed>=0&&speed<=55?speed:null,
      altitudeFt:null,observedAt,source:sourceName,
      sourceUrl:/^\d{7}$/.test(imo)
        ?'https://www.vesselfinder.com/vessels/details/'+imo:site,
      type:shipType+' · '+(id==='hormuz'?'Hormuz':'Bab el-Mandeb'),
      cargo:'ais_cargo_class',destination:destination||null,foodCargoVerified:false,
      chokepointId:id,observationBasis:perShip?'position_report':'snapshot_poll',
    })
  }
  return {assets:mergeAssets(parsed).slice(0,950),lastPoll:poll,
    totalRows:values.length,timestamped}
}
export function parseCrossingCount(raw:unknown):number|null{
  const root=obj(raw),data=obj(root.data),summary=obj(root.summary)
  const sources=[root,data,summary]
  for(const r of sources){
    const n=num(r.total_crossings??r.crossings_24h??r.crossings_total??r.total)
    if(n!==null&&n>=0&&n<=100000)return Math.floor(n)
    const inbound=num(r.inbound),outbound=num(r.outbound)
    if(inbound!==null&&outbound!==null&&inbound>=0&&outbound>=0&&inbound+outbound<=100000)
      return Math.floor(inbound+outbound)
  }
  return null
}
const origin='https://hormuz.data-tracking.net'
const SOURCE_NOTICE=
  'AIS-derived snapshots, not a continuous global live feed. Some ships are absent due to receiver coverage, AIS-off, spoofing or jamming. Vessel category is not a cargo manifest. Counts of all-vessel crossings are not food shipments.'
async function getJson(path:string,limitBytes=3500000):Promise<unknown>{
  const response=await fetch(origin+path,{
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(8500),
    next:{revalidate:1500},
  })
  if(!response.ok||!response.body)throw Error('Data-tracking provider unavailable')
  const reader=response.body.getReader(),decoder=new TextDecoder()
  let body='',length=0
  try{
    for(;;){
      const {done,value}=await reader.read()
      if(done)break
      length+=value.byteLength
      if(length>limitBytes){await reader.cancel();throw Error('Provider response too large')}
      body+=decoder.decode(value,{stream:true})
    }
    body+=decoder.decode()
  }finally{reader.releaseLock()}
  return JSON.parse(body) as unknown
}
const supported=[
  {id:'hormuz' as const,ships:'/api/ships',summary:'/api/summary?hours=24'},
  {id:'bab_el_mandeb' as const,ships:'/api/bab/ships',summary:'/api/bab/summary?hours=24'},
]
async function fetchArea(spec:typeof supported[number],now:number):Promise<{
  report:ChokepointReport;assets:TrackingAsset[]
}>{
  const cfg=TRACKED_CHOKEPOINTS.find(c=>c.id===spec.id)!
  const [ships,summary]=await Promise.allSettled([
    getJson(spec.ships),getJson(spec.summary,140000),
  ])
  const checkedAt=new Date().toISOString()
  if(ships.status==='rejected')return {assets:[],report:{
    id:spec.id,label:cfg.label,state:'unavailable',vesselCount:null,
    freshObservedCount:null,crossings24h:summary.status==='fulfilled'?
      parseCrossingCount(summary.value):null,lastPoll:null,
    checkedAt,sourceUrl:cfg.pageUrl,
    detail:'AIS ship-position endpoint unavailable. Any crossing aggregate is separate and may also be stale. '+SOURCE_NOTICE,
  }}
  const parsed=parseDataTrackingShips(ships.value,spec.id,now)
  const lastPoll=parsed.lastPoll
  const pollAge=lastPoll?now-Date.parse(lastPoll):null
  const latestShip=parsed.assets.reduce<string|null>((acc,a)=>
    !acc||a.observedAt>acc?a.observedAt:acc,null)
  const evidenceDate=lastPoll??latestShip
  const stale=evidenceDate===null||now-Date.parse(evidenceDate)>90*60000
  const freshCount=parsed.assets.filter(a=>a.observationBasis==='position_report'&&
    now-Date.parse(a.observedAt)<=90*60000).length
  const report:ChokepointReport={
    id:spec.id,label:cfg.label,
    state:stale?'stale':'partial',
    vesselCount:parsed.assets.length,freshObservedCount:freshCount,
    crossings24h:summary.status==='fulfilled'?parseCrossingCount(summary.value):null,
    lastPoll:evidenceDate,checkedAt,sourceUrl:cfg.pageUrl,
    detail:(stale?'SOURCE DELAYED / data is NOT live. ':'AIS provider snapshot. ')+
      'Cargo-like vessel types only; '+parsed.timestamped+'/'+parsed.assets.length+
      ' accepted cargo vessels have their own observation timestamp. '+
      '24h crossing statistics include all vessel classes; not a cargo-specific count. '+SOURCE_NOTICE,
  }
  return {assets:parsed.assets,report}
}
let cached:{expires:number;value:DataTrackingSnapshot}|null=null
let pending:Promise<DataTrackingSnapshot>|null=null
export async function getDataTrackingSnapshot():Promise<DataTrackingSnapshot>{
  if(cached&&cached.expires>Date.now())return cached.value
  if(pending)return pending
  pending=(async()=>{
    const now=Date.now()
    const results=await Promise.all(supported.map(spec=>fetchArea(spec,now)))
    const reports:ChokepointReport[]=TRACKED_CHOKEPOINTS.map(cfg=>{
      const matched=results.find(r=>r.report.id===cfg.id)
      return matched?.report??{
        id:cfg.id,label:cfg.label,state:'not_covered',vesselCount:null,
        freshObservedCount:null,crossings24h:null,lastPoll:null,
        checkedAt:new Date(now).toISOString(),sourceUrl:cfg.pageUrl,
        detail:'This chokepoint is NOT covered by the public data-tracking.net AIS API. No vessels or transit counts are inferred.',
      }
    })
    const value:DataTrackingSnapshot={
      generatedAt:new Date().toISOString(),source:'hormuz.data-tracking.net',
      sourceUrl:'https://hormuz.data-tracking.net/api-docs',
      license:'CC BY 4.0',cadenceMinutes:30,
      assets:mergeAssets(results.flatMap(r=>r.assets)),
      chokepoints:reports,
      disclaimer:SOURCE_NOTICE+
        ' This provider exposes ship-position APIs for Hormuz and Bab el-Mandeb only. '+
        'Other map chokepoints require independently licensed AIS coverage. '+
        'Source: hormuz.data-tracking.net (CC BY 4.0).',
    }
    // Re-request delayed/unavailable data sooner, but never flood the provider.
    cached={value,expires:now+(reports.some(r=>r.state==='unavailable')?180000:1500000)}
    return value
  })()
  try{return await pending}finally{pending=null}
}
