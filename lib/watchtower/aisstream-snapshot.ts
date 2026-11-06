import {mergeAssets,type TrackingAsset} from './global-tracking'
/**
 * Bounded AISStream sampling for Vercel functions.
 * An 8-second sample is NOT a persistent live AIS subscription.
 * Production continuous ingestion requires a durable off-Vercel receiver.
 */
export type AisStreamSnapshot={
 source:'AISStream.io';state:'partial'|'unconfigured'|'unavailable';
 checkedAt:string;assets:TrackingAsset[];received:number;accepted:number;detail:string
}
const SUBSCRIPTION_AREAS=[
 [[22,46],[32,62]], // Gulf, Oman, Hormuz
 [[10,32],[31.5,46]], // Red Sea and Suez
 [[7,43],[22,62]], // Gulf of Aden and Arabian Sea west
 [[7,62],[30,81]], // Arabian Sea east, Karachi and Indian Ocean north
]
const POSITION_TYPES=['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport'] as const
const MAX_SAMPLE_MS=8500
const MAX_ACCEPTED=1800
const CACHE_MS=5*60_000
let cached:{until:number;value:AisStreamSnapshot}|null=null
let pending:Promise<AisStreamSnapshot>|null=null
const obj=(raw:unknown):Record<string,unknown>=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{}
const num=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null
export function parseAisStreamMessage(raw:unknown,receivedAt=Date.now()):TrackingAsset|null{
 const envelope=obj(raw),type=envelope.MessageType
 if(typeof type!=='string'||!POSITION_TYPES.includes(type as typeof POSITION_TYPES[number]))return null
 const body=obj(obj(envelope.Message)[type]),meta=obj(envelope.MetaData)
 const mmsi=String(meta.MMSI??body.UserID??'')
 if(!/^[1-9]\d{8}$/.test(mmsi))return null
 const lat=num(body.Latitude)??num(meta.latitude)
 const lon=num(body.Longitude)??num(meta.longitude)
 const sog=num(body.Sog),cog=num(body.Cog),heading=num(body.TrueHeading)
 if(lat===null||lon===null||Math.abs(lat)>85||Math.abs(lon)>180)return null
 // The operational map intentionally removes stationary and port ships.
 if(sog===null||sog<5.1||sog>55)return null
 const rawTime=typeof meta.time_utc==='string'?Date.parse(meta.time_utc):NaN
 const hasFixTime=Number.isFinite(rawTime)&&rawTime<=receivedAt+60000&&receivedAt-rawTime<=3600000
 const stamp=hasFixTime?rawTime:receivedAt
 const label=typeof meta.ShipName==='string'?meta.ShipName.trim().slice(0,80):''
 return {id:'sea:'+mmsi,kind:'vessel',label:label||mmsi,lat,lon,
  heading:heading!==null&&heading>=0&&heading<360?heading:
    cog!==null&&cog>=0&&cog<360?cog:null,
  speedKnots:sog,altitudeFt:null,observedAt:new Date(stamp).toISOString(),
  source:'AISStream.io (short sample)',sourceUrl:'https://aisstream.io/',
  type:'AIS position report, vessel class unverified',cargo:'unverified',
  destination:null,foodCargoVerified:false,
  observationBasis:hasFixTime?'position_report':'snapshot_poll'}
}
async function collect(key:string):Promise<AisStreamSnapshot>{
 const checkedAt=new Date().toISOString()
 if(typeof WebSocket==='undefined')return {source:'AISStream.io',state:'unavailable',checkedAt,
  assets:[],received:0,accepted:0,detail:'WebSocket transport unavailable in this runtime.'}
 return new Promise(resolve=>{
  const byId=new Map<string,TrackingAsset>()
  let received=0,connected=false,done=false,errorText=''
  let socket:WebSocket|null=null
  const finish=()=>{
   if(done)return
   done=true;clearTimeout(timer)
   try{socket?.close(1000,'sampling completed')}catch{/*no-op*/}
   const assets=mergeAssets([...byId.values()])
   resolve({source:'AISStream.io',state:connected?'partial':'unavailable',
    checkedAt,assets,received,accepted:assets.length,
    detail:connected
     ?'Bounded 8.5-second AISStream WebSocket sample; '+received+
       ' position frames received, '+assets.length+
       ' unique underway ship fixes. This is NOT continuous coverage or a live voyage history.'
     :'AISStream connection unavailable'+(errorText?' ('+errorText+')':'')+
       '. Other AIS sources remain available.'})
  }
  const timer=setTimeout(finish,MAX_SAMPLE_MS)
  try{
   socket=new WebSocket('wss://stream.aisstream.io/v0/stream')
   socket.addEventListener('open',()=>{
    connected=true
    socket?.send(JSON.stringify({
     APIKey:key,BoundingBoxes:SUBSCRIPTION_AREAS,
     FilterMessageTypes:[...POSITION_TYPES,'ShipStaticData','StaticDataReport'],
    }))
   })
   socket.addEventListener('message',event=>{
    if(done||typeof event.data!=='string'||event.data.length>160000)return
    try{
     const raw=JSON.parse(event.data) as unknown
     const t=obj(raw).MessageType
     if(typeof t!=='string'||!POSITION_TYPES.includes(t as typeof POSITION_TYPES[number]))return
     received++
     const item=parseAisStreamMessage(raw)
     if(item&&byId.size<MAX_ACCEPTED){
      const old=byId.get(item.id)
      if(!old||item.observedAt>old.observedAt)byId.set(item.id,item)
     }
    }catch{/* malformed messages are not valid fixes */}
   })
   socket.addEventListener('error',()=>{errorText='WebSocket transport error'})
   socket.addEventListener('close',()=>finish())
  }catch(e){errorText=e instanceof Error?e.message:'Connection failed';finish()}
 })
}
export async function getAisStreamSnapshot():Promise<AisStreamSnapshot>{
 const key=process.env.AISSTREAM_API_KEY?.trim()
 const checkedAt=new Date().toISOString()
 if(!key)return {source:'AISStream.io',state:'unconfigured',checkedAt,
  assets:[],received:0,accepted:0,detail:'AISSTREAM_API_KEY is not configured.'}
 if(cached&&cached.until>Date.now())return cached.value
 if(pending)return pending
 pending=collect(key)
 try{const value=await pending
  cached={value,until:Date.now()+(value.state==='partial'?CACHE_MS:60_000)}
  return value
 }finally{pending=null}
}
