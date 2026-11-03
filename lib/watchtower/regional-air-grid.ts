/** Bounded, cacheable ADSB.lol geographic tile requests.
 * A whole 60-circle scan is split into six independent 10-circle batches
 * so a regional outage never blocks the remainder or the aircraft type feed. */
import {mergeAssets,parseAircraft} from './global-tracking'
import {REGIONAL_AIR_BATCH_COUNT,REGIONAL_AIR_CENTERS,type RegionalAirBatch} from './regional-air-shared'

const cache=new Map<number,{expires:number;value:RegionalAirBatch}>()
const pending=new Map<number,Promise<RegionalAirBatch>>()

async function fetchCircle(lat:number,lon:number){
  const response=await fetch('https://api.adsb.lol/v2/lat/'+lat+'/lon/'+lon+'/dist/250',{
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(6500),next:{revalidate:120},
  })
  if(!response.ok)throw Error('ADSB geographic HTTP '+response.status)
  const declared=Number(response.headers.get('content-length')??0)
  if(declared>5500000)throw Error('Oversized ADSB response')
  const raw=await response.text()
  if(raw.length>5500000)throw Error('Oversized ADSB response')
  return parseAircraft(JSON.parse(raw) as unknown).map(asset=>({
    ...asset,source:'ADSB.lol regional grid',
  }))
}
async function collect(batch:number):Promise<RegionalAirBatch>{
  const checkedAt=new Date().toISOString()
  const centers=REGIONAL_AIR_CENTERS.filter(c=>c.batch===batch)
  if(process.env.WATCHTOWER_ADSB_ENABLED==='false')return {
    source:'ADSB.lol regional grid',batch,checkedAt,state:'unconfigured',
    centers:centers.length,succeeded:0,failed:centers.length,
    latestObservationAt:null,assets:[],note:'ADSB.lol disabled on server.',
  }
  // Five concurrent upstream requests per batch. The browser issues at most
  // two batches simultaneously, avoiding a burst of sixty public API calls.
  const outcomes:PromiseSettledResult<Awaited<ReturnType<typeof fetchCircle>>>[]=[]
  for(let start=0;start<centers.length;start+=5){
    const chunk=await Promise.allSettled(centers.slice(start,start+5)
      .map(c=>fetchCircle(c.lat,c.lon)))
    outcomes.push(...chunk)
  }
  const success=outcomes.filter((r):r is PromiseFulfilledResult<
    Awaited<ReturnType<typeof fetchCircle>>>=>r.status==='fulfilled')
  const assets=mergeAssets(success.flatMap(r=>r.value))
  return {
    source:'ADSB.lol regional grid',batch,checkedAt,
    state:success.length?'partial':'unavailable',
    centers:centers.length,succeeded:success.length,failed:centers.length-success.length,
    latestObservationAt:assets.reduce<string|null>((a,b)=>
      !a||b.observedAt>a?b.observedAt:a,null),
    assets,
    note:'Actual ADS-B position observations in 250 NM search circles. '+
      'A successful query is not proof of complete receiver coverage; '+
      'no aircraft or freight manifests are simulated. ODbL 1.0.',
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
