/**
 * Optional open maritime AIS snapshot across the provider's actual receiver network.
 * Docs: https://openseafeed.com/docs
 * The provider is young; empty/failed snapshots are never treated as zero traffic.
 * Vessel coordinates and timestamps are source-reported, not simulations.
 */
import {coordinate,type TrackingAsset} from './global-tracking'

type Row=Record<string,unknown>
const obj=(value:unknown):Row=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:{}
const num=(value:unknown):number|null=>{
  const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN
  return Number.isFinite(n)?n:null
}
const label=(value:unknown,length=90):string=>
  typeof value==='string'?value.replace(/[<>]/g,'').trim().slice(0,length):''
const isRegional=(a:{lat:number;lon:number})=>a.lat>=7&&a.lat<=42&&a.lon>=25&&a.lon<=80
export type OpenSeaFeedSnapshot={
  source:'OpenSeaFeed AIS'
  state:'partial'|'stale'|'unavailable'|'unconfigured'
  sourceUrl:string
  generatedAt:string
  sourceAt:string|null
  providerRows:number|null
  accepted:number
  regional:number
  moving:number
  detail:string
  assets:TrackingAsset[]
}
const url='https://api.openseafeed.com/v1/snapshot'
/** Provider shape: { generated_at_ms, count, vessels: [{mmsi,lat,lon,sog,cog,hdg,ts,...}] }. */
export function parseOpenSeaFeedSnapshot(raw:unknown,now=Date.now()):OpenSeaFeedSnapshot{
  const data=obj(raw)
  if(!Array.isArray(data.vessels))throw Error('OpenSeaFeed vessels array unavailable')
  // Current OpenSeaFeed snapshotter publishes generated_at, while some
  // historical fixtures used generated_at_ms. Accept both without inventing time.
  const snapshotMs=num(data.generated_at??data.generated_at_ms)
  if(snapshotMs===null||snapshotMs<Date.UTC(2020,0,1)||snapshotMs>now+120000)
    throw Error('OpenSeaFeed snapshot has no credible source timestamp')
  const mapped:TrackingAsset[]=[]
  for(const item of data.vessels.slice(0,200000)){
    const row=obj(item)
    const id=String(row.mmsi??'').trim()
    const point=coordinate(row.lat,row.lon)
    const ts=num(row.ts)
    const shipType=num(row.type)
    if(!/^[1-9]\d{8}$/.test(id)||!point||ts===null||
      ts<snapshotMs-24*3600000||ts>snapshotMs+120000||now-ts>24*3600000)continue
    const speed=num(row.sog)
    const course=num(row.cog)??num(row.hdg)
    const cargo=shipType!==null&&shipType>=70&&shipType<80
    const imo=String(row.imo??'').trim()
    mapped.push({
      id:'sea:'+id,kind:'vessel',...point,
      label:label(row.name)||id,
      heading:course!==null&&course>=0&&course<360?course:null,
      speedKnots:speed!==null&&speed>=0&&speed<=55?speed:null,
      altitudeFt:null,observedAt:new Date(ts).toISOString(),
      source:'OpenSeaFeed AIS',sourceUrl:/^[1-9]\d{6}$/.test(imo)
        ?'https://www.vesselfinder.com/vessels/details/'+imo
        :'https://openseafeed.com/',
      type:shipType!==null?'AIS vessel class '+shipType:'Unclassified AIS vessel',
      cargo:cargo?'ais_cargo_class':'unverified',
      destination:label(row.dest,90)||null,foodCargoVerified:false,
      observationBasis:'position_report',
    })
  }
  // Distribute worldwide observations geographically. A giant European
  // coastal cluster must not consume every marker before Red Sea/Gulf assets.
  // Do not apply mergeAssets' global cap before geographical sampling.
  // Otherwise a dense receiver region can evict ALL distant real positions.
  const byId=new Map<string,TrackingAsset>()
  for(const item of mapped){
    const previous=byId.get(item.id)
    if(!previous||item.observedAt>previous.observedAt)byId.set(item.id,item)
  }
  const candidates=[...byId.values()].sort((a,b)=>
    Number((b.speedKnots??0)>=1.5)-Number((a.speedKnots??0)>=1.5)||
    b.observedAt.localeCompare(a.observedAt))
  const buckets=new Map<string,number>()
  const selected:TrackingAsset[]=[]
  const add=(a:TrackingAsset,maxPerCell:number)=>{
    const key=Math.floor(a.lat/5)+':'+Math.floor(a.lon/5)
    if((buckets.get(key)??0)>=maxPerCell)return
    selected.push(a);buckets.set(key,(buckets.get(key)??0)+1)
  }
  for(const asset of candidates.filter(isRegional)){
    if(selected.length>=1100)break
    add(asset,190)
  }
  for(const asset of candidates.filter(a=>!isRegional(a))){
    if(selected.length>=3000)break
    add(asset,45)
  }
  const age=now-snapshotMs
  return {
    source:'OpenSeaFeed AIS',sourceUrl:'https://openseafeed.com/',
    generatedAt:new Date(now).toISOString(),
    sourceAt:new Date(snapshotMs).toISOString(),
    providerRows:num(data.count)??data.vessels.length,
    accepted:selected.length,regional:selected.filter(isRegional).length,
    moving:selected.filter(a=>a.speedKnots!==null&&a.speedKnots>=1.5).length,
    state:age>20*60000?'stale':'partial',
    detail:'Source-backed network coverage only, not every ship at sea. '+
      'Unobserved areas are unknown; OpenSeaFeed positions may have gaps. '+
      'AIS class does not prove cargo contents. Receiver/source update timestamps are preserved.',
    assets:selected,
  }
}
const unavailable=(state:'unavailable'|'unconfigured',detail:string):OpenSeaFeedSnapshot=>({
  source:'OpenSeaFeed AIS',sourceUrl:'https://openseafeed.com/',
  generatedAt:new Date().toISOString(),sourceAt:null,providerRows:null,
  accepted:0,regional:0,moving:0,state,detail,assets:[],
})
let cache:{expires:number;value:OpenSeaFeedSnapshot}|null=null
let pending:Promise<OpenSeaFeedSnapshot>|null=null
export async function getOpenSeaFeedSnapshot():Promise<OpenSeaFeedSnapshot>{
  if(process.env.WATCHTOWER_OPENSEAFEED_ENABLED==='false')
    return unavailable('unconfigured','OpenSeaFeed collection disabled by administrator.')
  if(cache&&cache.expires>Date.now())return cache.value
  if(pending)return pending
  pending=(async()=>{
    let value:OpenSeaFeedSnapshot
    try{
      const response=await fetch(url,{
        headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000),
        next:{revalidate:75},
      })
      if(!response.ok||!response.body)throw Error('HTTP '+response.status)
      const contentLength=num(response.headers.get('content-length'))
      if(contentLength!==null&&contentLength>60000000)throw Error('OpenSeaFeed snapshot too large')
      const decoder=new TextDecoder(),reader=response.body.getReader()
      let body='',bytes=0
      try{
        for(;;){
          const {done,value:chunk}=await reader.read()
          if(done)break
          bytes+=chunk.byteLength
          if(bytes>60000000){await reader.cancel();throw Error('OpenSeaFeed snapshot too large')}
          body+=decoder.decode(chunk,{stream:true})
        }
        body+=decoder.decode()
      }finally{reader.releaseLock()}
      value=parseOpenSeaFeedSnapshot(JSON.parse(body) as unknown)
    }catch(error){
      const detail=error instanceof Error?error.message:'unknown source error'
      value=unavailable('unavailable','OpenSeaFeed: '+detail.slice(0,110)+
        '. No AIS positions fabricated. Check endpoint availability and provider access.')
    }
    cache={value,expires:Date.now()+(value.state==='unavailable'?60000:75000)}
    return value
  })()
  try{return await pending}finally{pending=null}
}
