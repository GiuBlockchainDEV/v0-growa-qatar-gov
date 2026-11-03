/** Bounded, cacheable ADSB.lol geographic tile requests.
 * A whole 60-circle scan is split into six independent 10-circle batches
 * so a regional outage never blocks the remainder or the aircraft type feed. */
import {mergeAssets,parseAircraft} from './global-tracking'
import {REGIONAL_AIR_BATCH_COUNT,REGIONAL_AIR_CENTERS,type RegionalAirBatch} from './regional-air-shared'

const cache=new Map<number,{expires:number;value:RegionalAirBatch}>()
const pending=new Map<number,Promise<RegionalAirBatch>>()

const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))
async function fetchCircle(lat:number,lon:number){
  // ADSB.lol applies dynamic rate limits. Do not burst requests or bypass
  // provider controls: one query at a time, respecting rate-limit responses.
  const response=await fetch('https://api.adsb.lol/v2/lat/'+lat+'/lon/'+lon+'/dist/250',{
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(4000),next:{revalidate:180},
  })
  if(!response.ok)throw Error('HTTP '+response.status)
  const declared=Number(response.headers.get('content-length')??0)
  if(declared>5500000)throw Error('oversize')
  const raw=await response.text()
  if(raw.length>5500000)throw Error('oversize')
  return parseAircraft(JSON.parse(raw) as unknown).map(asset=>({
    ...asset,source:'ADSB.lol regional grid',
  }))
}
function failureCode(reason:unknown):string{
  if(reason instanceof Error){
    if(/^HTTP \d{3}$/.test(reason.message))return reason.message
    if(reason.name==='TimeoutError'||reason.name==='AbortError')return 'timeout'
    if(reason.message==='oversize')return 'oversize'
    if(/Expired ADS-B response|Unexpected ADS-B response/.test(reason.message))return 'invalid_schema'
  }
  return 'network_or_parse'
}
async function collect(batch:number):Promise<RegionalAirBatch>{
  const checkedAt=new Date().toISOString()
  const centers=REGIONAL_AIR_CENTERS.filter(c=>c.batch===batch)
  if(process.env.WATCHTOWER_ADSB_ENABLED==='false')return {
    source:'ADSB.lol regional grid',batch,checkedAt,state:'unconfigured',
    centers:centers.length,succeeded:0,failed:centers.length,
    failureCodes:{disabled:centers.length},circles:centers.map(c=>({
      lat:c.lat,lon:c.lon,count:0,status:'failed' as const,code:'disabled',
    })),
    latestObservationAt:null,assets:[],note:'ADSB.lol disabled on server.',
  }
  const hits:ReturnType<typeof parseAircraft>[]=[]
  const failureCodes:Record<string,number>={}
  const circles:RegionalAirBatch['circles']=[]
  let succeeded=0
  for(const [index,center] of centers.entries()){
    if(index>0)await sleep(1050)
    try{
      const assets=await fetchCircle(center.lat,center.lon)
      hits.push(assets)
      succeeded++
      circles.push({lat:center.lat,lon:center.lon,count:assets.length,status:'ok'})
    }catch(error){
      const code=failureCode(error)
      failureCodes[code]=(failureCodes[code]??0)+1
      circles.push({lat:center.lat,lon:center.lon,count:0,status:'failed',code})
    }
  }
  const assets=mergeAssets(hits.flat())
  return {
    source:'ADSB.lol regional grid',batch,checkedAt,
    state:succeeded?'partial':'unavailable',
    centers:centers.length,succeeded,failed:centers.length-succeeded,
    failureCodes,circles,
    latestObservationAt:assets.reduce<string|null>((a,b)=>
      !a||b.observedAt>a?b.observedAt:a,null),
    assets,
    note:'Actual ADS-B positions only; one geographic API call at a time. '+
      'A search circle returning zero is not evidence of empty skies. '+
      'Failed searches remain failed, not zero observed aircraft. ODbL 1.0.',
  }
}
export async function getRegionalAirBatch(batch:number):Promise<RegionalAirBatch>{
  if(!Number.isInteger(batch)||batch<0||batch>=REGIONAL_AIR_BATCH_COUNT)
    throw Error('Invalid ADS-B grid batch')
  const cached=cache.get(batch)
  if(cached&&cached.expires>Date.now())return cached.value
  const current=pending.get(batch)
  if(current)return current
  const promise=collect(batch)
  pending.set(batch,promise)
  try{
    const value=await promise
    cache.set(batch,{value,expires:Date.now()+(value.succeeded?120000:30000)})
    return value
  }finally{pending.delete(batch)}
}
