/**
 * hormuz.now regional AIS snapshot, CC BY 4.0.
 * Source: https://hormuz.now/data
 *
 * The compact API's "id" is a SOURCE-SPECIFIC vessel key, not an MMSI.
 * "ageMin" is relative to the source snapshot time. No historical
 * trajectory, manifest, sailing status or voyage is inferred.
 */
import {coordinate,mergeAssets,type TrackingAsset} from './global-tracking'

type Raw=Record<string,unknown>
const obj=(v:unknown):Raw=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{}
const number=(v:unknown):number|null=>{
  const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
  return Number.isFinite(n)?n:null
}
const clean=(v:unknown,max=100):string=>
  typeof v==='string'?v.replace(/[<>]/g,'').trim().slice(0,max):''
export type HormuzNowFeed={
  source:'hormuz.now'
  sourceUrl:'https://hormuz.now/data'
  checkedAt:string
  providerAt:string|null
  providerCount:number|null
  acceptedCount:number
  movingCount:number
  cargoCount:number
  state:'available'|'stale'|'unavailable'
  detail:string
  assets:TrackingAsset[]
}
export function parseHormuzNowCompact(raw:unknown,now=Date.now()):HormuzNowFeed{
  const root=obj(raw)
  if(!Array.isArray(root.fields)||!Array.isArray(root.rows))throw Error('Unexpected hormuz.now schema')
  const columns=root.fields.filter((v):v is string=>typeof v==='string')
  if(columns.length!==root.fields.length)throw Error('Invalid AIS columns')
  const index=(name:string)=>columns.indexOf(name)
  for(const required of ['id','name','lat','lon','speed','course','ageMin'])
    if(index(required)<0)throw Error('Missing AIS column '+required)
  const stamp=number(root.t)
  if(stamp===null||stamp<Date.UTC(2020,0,1)||stamp>now+120000)
    throw Error('Invalid provider AIS snapshot timestamp')
  const providerAt=new Date(stamp).toISOString()
  const byRow=(row:unknown[],name:string):unknown=>{
    const i=index(name)
    return i>=0?row[i]:undefined
  }
  const mapped:TrackingAsset[]=[]
  for(const value of root.rows.slice(0,12000)){
    if(!Array.isArray(value))continue
    const id=String(byRow(value,'id')??'').trim()
    if(!/^\d{1,16}$/.test(id))continue
    const point=coordinate(byRow(value,'lat'),byRow(value,'lon'))
    const ageMinutes=number(byRow(value,'ageMin'))
    if(!point||ageMinutes===null||ageMinutes<0||ageMinutes>1440)continue
    const observedMs=stamp-Math.round(ageMinutes*60000)
    if(now-observedMs>24*3600000||observedMs>now+120000)continue
    const speed=number(byRow(value,'speed'))
    const heading=number(byRow(value,'course'))??number(byRow(value,'heading'))
    const group=clean(byRow(value,'category'),40).toLowerCase()
    const shipType=clean(byRow(value,'type'),75)
    const cargo=group==='cargo'||/container|bulk.carrier|general.cargo|reefer|refrigerated|ro.ro|freight/i.test(shipType)
    const label=clean(byRow(value,'name'),80)||'Vessel '+id
    const destination=clean(byRow(value,'destination'),95)
    mapped.push({
      id:'sea:hn:'+id,kind:'vessel',label,...point,
      heading:heading!==null&&heading>=0&&heading<360?heading:null,
      speedKnots:speed!==null&&speed>=0&&speed<=55?speed:null,
      altitudeFt:null,
      observedAt:new Date(observedMs).toISOString(),
      source:'hormuz.now AIS',
      sourceUrl:'https://hormuz.now/live',
      type:shipType||group||'Unknown AIS vessel class',
      cargo:cargo?'ais_cargo_class':'unverified',
      destination:destination||null,foodCargoVerified:false,
      observationBasis:'position_report',
    })
  }
  const assets=mergeAssets(mapped)
  const providerN=number(root.n)
  const state=now-stamp>25*60000?'stale':'available'
  return {
    source:'hormuz.now',sourceUrl:'https://hormuz.now/data',
    checkedAt:new Date(now).toISOString(),providerAt,
    providerCount:providerN!==null&&providerN>=0?providerN:root.rows.length,
    acceptedCount:assets.length,
    movingCount:assets.filter(a=>a.speedKnots!==null&&a.speedKnots>=1.5).length,
    cargoCount:assets.filter(a=>a.cargo==='ais_cargo_class').length,
    state,assets,
    detail:(state==='stale'?'Provider snapshot delayed. ':'')+
      'AIS-visible positions in the Persian Gulf / Gulf of Oman only. '+
      'The source-specific vessel identifier is not an MMSI. '+
      'Each position timestamp is estimated from the provider ageMin field, '+
      'not from a verified raw AIS message. Speed over ground does not prove voyage or cargo. '+
      'Data CC BY 4.0, hormuz.now.',
  }
}

let cached:{expires:number;result:HormuzNowFeed}|null=null
let pending:Promise<HormuzNowFeed>|null=null
export async function getHormuzNowFeed():Promise<HormuzNowFeed>{
  if(cached&&cached.expires>Date.now())return cached.result
  if(pending)return pending
  pending=(async()=>{
    let result:HormuzNowFeed
    try{
      const response=await fetch('https://hormuz.now/api/snapshot?format=compact',{
        headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),
        next:{revalidate:30},
      })
      if(!response.ok)throw Error('hormuz.now HTTP '+response.status)
      const size=Number(response.headers.get('content-length')??0)
      if(size>4000000)throw Error('AIS snapshot exceeds allowed size')
      const raw=await response.text()
      if(raw.length>4000000)throw Error('AIS snapshot exceeds allowed size')
      result=parseHormuzNowCompact(JSON.parse(raw) as unknown)
    }catch{
      result={
        source:'hormuz.now',sourceUrl:'https://hormuz.now/data',
        checkedAt:new Date().toISOString(),providerAt:null,providerCount:null,
        acceptedCount:0,movingCount:0,cargoCount:0,
        state:'unavailable',assets:[],
        detail:'hormuz.now AIS snapshot is unavailable or its schema changed; no positions are fabricated.',
      }
    }
    cached={result,expires:Date.now()+(result.state==='unavailable'?30000:30000)}
    return result
  })()
  try{return await pending}finally{pending=null}
}
