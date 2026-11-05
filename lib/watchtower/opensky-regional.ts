import {mergeAssets,type TrackingAsset} from './global-tracking'
export type OpenSkySnapshot={source:'OpenSky Network';state:'partial'|'unavailable';checkedAt:string;assets:TrackingAsset[];detail:string}
const cacheMs=30*60_000
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
  if(lat<11||lat>33||lon<35||lon>63||now-t*1000>600_000||t*1000>now+60000)continue
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
async function read():Promise<OpenSkySnapshot>{
 const checkedAt=new Date().toISOString()
 try{
  const url='https://opensky-network.org/api/states/all?lamin=11&lomin=35&lamax=33&lomax=63'
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),next:{revalidate:1800}})
  if(!response.ok)throw Error('HTTP '+response.status)
  const body=await response.text()
  if(body.length>5000000)throw Error('Large response')
  const assets=parseOpenSky(JSON.parse(body) as unknown)
  return {source:'OpenSky Network',state:'partial',checkedAt,assets,
   detail:'Second source, reported positions only; aircraft class and cargo not verified.'}
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
  cache={value,until:Date.now()+(value.state==='partial'?cacheMs:10*60_000)}
  return value
 }finally{pending=null}
}
