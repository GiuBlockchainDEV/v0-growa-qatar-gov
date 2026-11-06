import {mergeAssets,type TrackingAsset} from './global-tracking'
export type OpenSkySnapshot={source:'OpenSky Network';state:'partial'|'unavailable';checkedAt:string;assets:TrackingAsset[];detail:string}
const cacheMs=120_000
let cache:{until:number;value:OpenSkySnapshot}|null=null
let pending:Promise<OpenSkySnapshot>|null=null
const cargoCallsign=/^(FDX|UPS|GTI|CLX|ABW|CKK|ICL|PAC|NCA|MPH|TAY|DHK|BCS|BOX|GEC|CKS|ABR|AZG|AZQ|CJT|MFX|KYE|MNB|SRR|NPT)/i
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null
export function parseOpenSky(raw:unknown,now=Date.now()):TrackingAsset[]{
 if(!raw||typeof raw!=='object')throw Error('Invalid OpenSky object')
 const data=raw as {time?:unknown;states?:unknown}
 const sourceTime=finite(data.time)
 if(sourceTime===null||Math.abs(now-sourceTime*1000)>600_000||!Array.isArray(data.states))throw Error('OpenSky stale or incomplete')
 const result:TrackingAsset[]=[]
 for(const value of data.states.slice(0,12000)){
  if(!Array.isArray(value)||value.length<14)continue
  const [hexValue,call,,lastPos,,lonValue,latValue,heightValue,ground,velocity,heading,,,geoHeight]=value as unknown[]
  const hex=typeof hexValue==='string'?hexValue.trim().toLowerCase():''
  const lat=finite(latValue),lon=finite(lonValue),t=finite(lastPos)
  if(!/^[a-f0-9]{6}$/.test(hex)||ground===true||lat===null||lon===null||t===null)continue
  if(lat<7||lat>42||lon<25||lon>80||now-t*1000>600_000||t*1000>now+60000)continue
  const label=typeof call==='string'?call.trim().slice(0,24):''
  const v=finite(velocity),bearing=finite(heading),height=finite(heightValue)??finite(geoHeight)
  result.push({id:'air:'+hex,kind:'aircraft',label:label||hex.toUpperCase(),lat,lon,
   heading:bearing!==null&&bearing>=0&&bearing<360?bearing:null,
   speedKnots:v!==null&&v>=0?v*1.943844:null,altitudeFt:height!==null?height*3.28084:null,
   observedAt:new Date(t*1000).toISOString(),source:'OpenSky Network',
   sourceUrl:'https://opensky-network.org/',type:'Unverified aircraft type',
   cargo:cargoCallsign.test(label)?'operator_inferred':'unverified',
   destination:null,foodCargoVerified:false,observationBasis:'position_report'})
 }
 return mergeAssets(result)
}
let bearer:{token:string;until:number}|null=null
let authPending:Promise<string|null>|null=null
async function getOpenSkyBearer():Promise<string|null>{
 const id=process.env.OPENSKY_CLIENT_ID?.trim()
 const secret=process.env.OPENSKY_CLIENT_SECRET?.trim()
 if(!id||!secret)return null
 if(bearer&&Date.now()<bearer.until-60000)return bearer.token
 if(authPending)return authPending
 authPending=(async()=>{
  const response=await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',{
   method:'POST',
   headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:secret}),
   signal:AbortSignal.timeout(9000),cache:'no-store',
  })
  if(!response.ok)throw Error('OpenSky OAuth HTTP '+response.status)
  const raw=await response.json() as {access_token?:unknown;expires_in?:unknown}
  if(typeof raw.access_token!=='string'||!raw.access_token)throw Error('Invalid OpenSky token')
  const lifetime=typeof raw.expires_in==='number'&&Number.isFinite(raw.expires_in)?raw.expires_in:300
  bearer={token:raw.access_token,until:Date.now()+Math.max(60,lifetime)*1000}
  return bearer.token
 })()
 try{return await authPending}finally{authPending=null}
}
async function read():Promise<OpenSkySnapshot>{
 const checkedAt=new Date().toISOString()
 try{
  const url='https://opensky-network.org/api/states/all?lamin=7&lomin=25&lamax=42&lomax=80'
  const credentialsConfigured=Boolean(process.env.OPENSKY_CLIENT_ID?.trim()&&process.env.OPENSKY_CLIENT_SECRET?.trim())
  const token=credentialsConfigured?await getOpenSkyBearer():null
  const response=await fetch(url,{headers:token?{Authorization:'Bearer '+token}:{},
    signal:AbortSignal.timeout(10000),cache:'no-store'})
  if(!response.ok)throw Error('OpenSky HTTP '+response.status)
  const body=await response.text()
  if(body.length>8000000)throw Error('Large response')
  const assets=parseOpenSky(JSON.parse(body) as unknown)
  return {source:'OpenSky Network',state:'partial',checkedAt,assets,
   detail:(token?'Authenticated OpenSky OAuth2 observations. ':'Anonymous OpenSky observations. ')+
    'Regional 7–42°N, 25–80°E, 120-second provider cache. Cargo and manifests not verified.'}
 }catch(error){
  return {source:'OpenSky Network',state:'unavailable',checkedAt,assets:[],
   detail:'Source unavailable ('+(error instanceof Error?error.message:'network error')+
   '); zero returned observations does not prove empty airspace.'}
 }
}
export async function getOpenSkySnapshot():Promise<OpenSkySnapshot>{
 if(process.env.WATCHTOWER_OPENSKY_ENABLED==='false')
  return {source:'OpenSky Network',state:'unavailable',checkedAt:new Date().toISOString(),
   assets:[],detail:'Source disabled.'}
 if(cache&&cache.until>Date.now())return cache.value
 if(pending)return pending
 pending=read()
 try{
  const value=await pending
  cache={value,until:Date.now()+(value.state==='partial'?cacheMs:45_000)}
  return value
 }finally{pending=null}
}
