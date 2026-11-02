import { fetchAviationThreat, fetchMaritimeThreat } from '@/lib/nfii/logistics-security'
import { getExportHub } from '@/lib/nfii/logistics-lanes'
import {adsbdbItinerary,applyFlightRouteLookups,flightLookupInput,vesselReportedItinerary,type RouteItinerary} from './itinerary-sources'
import {withModeledSeaLegs} from './itinerary-sea'
import { mergeAssets, parseAircraft, parseVessels, parseGlobalHazards, freshAsset, REFRESH_SECONDS,
  type TrackingAsset, type MapAlert, type TrackingSource, type TrackingSnapshot } from './global-tracking'

// Global samples, NOT all flights. Passenger variants are not confirmed cargo.
const AIRFRAME_SAMPLE = ['B744', 'B748', 'B77L', 'B763', 'B752', 'A306'] as const
const FAST_AIRFRAME_SAMPLE = ['B77L', 'B763', 'B744', 'B748'] as const
const ADDITIONAL_AIRFRAME_SAMPLE = ['B752', 'A306'] as const
type Batch<T> = { items: T[]; source: TrackingSource }
async function json(url: string, revalidate: number, maxBytes = 3000000): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7500), next: { revalidate } })
  if (!response.ok || !response.body) throw Error('Provider unavailable')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let content = '', bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) { await reader.cancel(); throw Error('Provider response exceeds limit') }
      content += decoder.decode(value, { stream: true })
    }
    content += decoder.decode()
    return JSON.parse(content) as unknown
  } finally { reader.releaseLock() }
}
function source(id: string, name: string, url: string, detail: string): TrackingSource {
  return { id, name, url, detail, state: 'unavailable', checkedAt: new Date().toISOString(), latestObservationAt: null }
}
const latest = (items: { observedAt: string | null }[]) => items.reduce<string | null>((value, row) => row.observedAt && (!value || row.observedAt > value) ? row.observedAt : value, null)
async function jsonResponseLimited(response:Response,maxBytes:number):Promise<unknown>{
  const contentLength=Number(response.headers.get('content-length')??0)
  if(contentLength>maxBytes)throw Error('Route lookup oversized')
  const data=await response.text()
  if(data.length>maxBytes)throw Error('Route lookup oversized')
  return JSON.parse(data) as unknown
}
async function aircraft(types:readonly string[]=AIRFRAME_SAMPLE): Promise<Batch<TrackingAsset>> {
  const meta = source('adsb', 'ADSB.lol', 'https://api.adsb.lol/docs',
    'Selected global cargo-capable airframe types, not all aircraft. Receiver coverage varies. Cargo operator inferred from callsign; no manifest. ODbL 1.0.')
  if (process.env.WATCHTOWER_ADSB_ENABLED === 'false') return { items: [], source: { ...meta, state: 'unconfigured', detail: 'Public ADS-B feed disabled by administrator.' } }
  const results = await Promise.allSettled(types.map(async type => parseAircraft(await json('https://api.adsb.lol/v2/type/' + type, 60))))
  const good = results.filter((r): r is PromiseFulfilledResult<TrackingAsset[]> => r.status === 'fulfilled')
  let items = mergeAssets(good.flatMap(r => r.value))
  meta.state = !good.length ? 'unavailable' : items.length && !items.some(a => freshAsset(a)) ? 'stale' : 'partial'
  meta.latestObservationAt = latest(items)
  if (good.length < types.length) meta.detail += ' Some queries failed. Missing observations do not mean zero traffic.'
  return { items, source: meta }
}
async function vessels(): Promise<Batch<TrackingAsset>> {
  const meta = source('ais', 'VesselFinder AIS', 'https://api.vesselfinder.com/docs/livedata.html',
    'AIS cargo types 70-79 in the licensed LiveData area, capped at 2,000 latest positions. Not guaranteed global coverage; no cargo manifests.')
  const key = process.env.VESSELFINDER_API_KEY?.trim()
  if (!key) return { items: [], source: { ...meta, state: 'unconfigured', detail: 'Maritime tracking not connected. Configure server-only VESSELFINDER_API_KEY with a LiveData subscription. No simulated vessels are shown.' } }
  try {
    const url = new URL('https://api.vesselfinder.com/livedata')
    url.searchParams.set('userkey', key); url.searchParams.set('format', 'json'); url.searchParams.set('interval', '30')
    const raw=await json(url.toString(),60,5000000)
    const items=parseVessels(raw)
    if(Array.isArray(raw)){
      const report=new Map<string,unknown>()
      for(const value of raw){
        if(typeof value!=='object'||value===null)continue
        const ais=(value as {AIS?:{MMSI?:number|string}}).AIS
        if(ais?.MMSI)report.set('sea:'+String(ais.MMSI),value)
      }
      let modeled=0,attempted=0
      for(const asset of items){
        const rawItem=report.get(asset.id)
        if(!rawItem)continue
        const itinerary=vesselReportedItinerary(rawItem)
        if(!itinerary)continue
        // Land-avoiding modeled geometry costs CPU; bounded and optional.
        const canModel=attempted<8&&itinerary.origin?.lat!=null&&
          itinerary.destination?.lat!=null
        if(canModel)attempted++
        asset.itinerary=canModel?withModeledSeaLegs(itinerary,asset):itinerary
        if(asset.itinerary.modelSeaLegs)modeled++
      }
      meta.detail+=' Last-port and destination metadata depend on subscribed VOYAGE data; modeled sea paths are not actual vessel voyages.'
    }
    meta.state = items.length && !items.some(a => freshAsset(a)) ? 'stale' : 'partial'
    meta.latestObservationAt = latest(items)
    return { items, source: meta }
  } catch { return { items: [], source: { ...meta, detail: 'AIS provider unavailable, oversized response or missing LiveData entitlement. Vessel positions unknown.' } } }
}
async function hazards(): Promise<Batch<MapAlert>> {
  const meta = source('gdacs', 'GDACS', 'https://www.gdacs.org/', 'Recent reported red/orange hazards, not confirmed supply disruption. Returned geolocated events capped at 120; not a complete hazard inventory.')
  try {
    const now = Date.now(), url = new URL('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH')
    url.searchParams.set('eventlist', 'EQ;TC;FL;VO;DR;WF')
    url.searchParams.set('fromdate', new Date(now - 14 * 86400000).toISOString().slice(0, 10))
    url.searchParams.set('todate', new Date(now).toISOString().slice(0, 10)); url.searchParams.set('alertlevel', 'red;orange')
    const items = parseGlobalHazards(await json(url.toString(), 900), now)
    return { items, source: { ...meta, state: 'partial', latestObservationAt: latest(items) } }
  } catch { return { items: [], source: meta } }
}
async function advisories(): Promise<Batch<MapAlert>> {
  const result = await fetchAviationThreat()
  const meta = source('easa', 'EASA CZIB', result.sourceUrl, 'Aviation advisories, NOT confirmed closures or NOTAMs. Markers use representative country airports, not affected airspace boundaries.')
  const items: MapAlert[] = result.notices.flatMap(notice => notice.countries.flatMap(country => {
    const hub = getExportHub(country)
    if (!hub) return []
    return [{ id: 'easa:' + notice.id + ':' + country, kind: 'aviation' as const, title: notice.title,
      severity: 'attention' as const, lat: hub.air.lat, lon: hub.air.lon,
      observedAt: notice.updatedAt && /(?:Z|[+-]\d\d:\d\d)$/.test(notice.updatedAt) ? notice.updatedAt : null,
      source: 'EASA CZIB', sourceUrl: notice.url,
      detail: 'Advisory covering ' + country + ', valid until ' + notice.validUntil + '. Check carrier routing and NOTAMs; closure and delays unverified.',
      locationBasis: 'Representative ' + country + ' airport, NOT the advisory boundary.' }]
  })).slice(0, 80)
  return { items, source: { ...meta, state: result.state === 'available' ? 'partial' : result.state, checkedAt: result.checkedAt, latestObservationAt: latest(items) } }
}
async function maritime(): Promise<Batch<MapAlert>> {
  const result = await fetchMaritimeThreat()
  const meta = source('hormuz', 'Hormuz / UKMTO', result.sourceUrl, result.attribution + '. Regional reports, not exact incident locations or closures.')
  const items: MapAlert[] = result.recentIncidents.map((incident, index) => ({
    id: 'hormuz:' + incident.date + ':' + index, kind: 'maritime', title: incident.kind + ' / Hormuz region',
    severity: /attack|strike|missile|projectile|uav/i.test(incident.kind + ' ' + incident.description) ? 'high' : 'attention',
    lat: 26.56, lon: 56.25, observedAt: incident.date, source: 'UKMTO via Hormuz tracker', sourceUrl: result.incidentSourceUrl,
    detail: incident.description + ' Report from the last 30 days; current operational impact requires verification.',
    locationBasis: 'Approximate Hormuz regional anchor, not the precise incident location or a confirmed closure.' }))
  meta.state = result.incidentsState === 'available' || result.state === 'available' ? 'partial' : result.state
  meta.latestObservationAt = result.lastPoll
  meta.detail += ' AIS summary: ' + result.state + '; incident feed: ' + result.incidentsState + '.'
  return { items, source: meta }
}
/**
 * Route lookups must NEVER block ADS-B position delivery. Bounded cache
 * includes positive and negative results, avoiding six expensive route checks
 * on every 60-second refresh.
 */
type CachedRoute={itinerary:RouteItinerary|null;expires:number}
const routeCache=new Map<string,CachedRoute>()
let routePending:Promise<import('./tracking-merge').RouteLookupResponse>|null=null
async function routeBatch(air:TrackingAsset[]){
  const input=flightLookupInput(air,65)
  if(!input.length)return {matches:new Map<string,RouteItinerary>(),checked:0}
  const pairs=new Map<string,RouteItinerary>()
  try{
    const reply=await fetch('https://api.adsb.lol/api/0/routeset',{
      method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({planes:input}),signal:AbortSignal.timeout(2500),
      cache:'no-store',
    })
    if(reply.ok){
      const result=applyFlightRouteLookups(air,await jsonResponseLimited(reply,1000000))
      for(const a of result.results)if(a.itinerary?.origin&&a.itinerary.destination)
        pairs.set(a.label.trim().toUpperCase(),a.itinerary)
    }
  }catch{ /* fallback below; positions never wait */ }
  return {matches:pairs,checked:input.length}
}
export async function getFlightRouteLookups():Promise<import('./tracking-merge').RouteLookupResponse>{
  if(routePending)return routePending
  routePending=(async()=>{
    const quick=await getTrackingSnapshot('quick')
    const flights=quick.assets.filter(a=>a.kind==='aircraft')
      .sort((a,b)=>Number(b.cargo==='operator_inferred')-Number(a.cargo==='operator_inferred'))
    const active=flights.slice(0,65)
    const at=Date.now()
    const missing=active.filter(a=>!routeCache.has(a.label.trim().toUpperCase())||
      routeCache.get(a.label.trim().toUpperCase())!.expires<=at)
    if(missing.length){
      const batch=await routeBatch(missing)
      for(const a of missing){
        const key=a.label.trim().toUpperCase()
        const itinerary=batch.matches.get(key)??null
        routeCache.set(key,{itinerary,expires:at+(itinerary?30*60000:5*60000)})
      }
      // ADSBdb fallback only for a handful of unmatched priority cargo callsigns.
      // Four concurrent calls max, each capped at 1.8s.
      const unmatched=missing.filter(a=>a.cargo==='operator_inferred'&&
        !routeCache.get(a.label.trim().toUpperCase())?.itinerary).slice(0,8)
      for(let offset=0;offset<unmatched.length;offset+=4){
        await Promise.allSettled(unmatched.slice(offset,offset+4).map(async asset=>{
          const key=asset.label.trim().toUpperCase()
          if(!/^[A-Z0-9]{3,10}$/.test(key))return
          try{
            const response=await fetch('https://api.adsbdb.com/v0/callsign/'+
              encodeURIComponent(key),{
              headers:{Accept:'application/json'},signal:AbortSignal.timeout(1800),
              cache:'no-store',
            })
            if(!response.ok)return
            const itinerary=adsbdbItinerary(await jsonResponseLimited(response,150000))
            if(itinerary)routeCache.set(key,{itinerary,expires:at+30*60000})
          }catch{ /* no asserted route on missing provider evidence */ }
        }))
      }
    }
    // Keep cache bounded; stale reused callsigns are never tied permanently
    // to a particular plane, and client still rechecks ICAO + callsign.
    for(const [key,value] of routeCache)if(value.expires<=at)routeCache.delete(key)
    while(routeCache.size>300)routeCache.delete(routeCache.keys().next().value!)
    const routes:import('./tracking-merge').RouteLookupResponse['routes']={}
    for(const asset of active){
      const cached=routeCache.get(asset.label.trim().toUpperCase())
      if(cached?.itinerary)routes[asset.id]={
        callsign:asset.label,itinerary:cached.itinerary,
      }
    }
    return {
      checkedAt:new Date().toISOString(),routes,
      checked:active.length,matched:Object.keys(routes).length,
      status:Object.keys(routes).length?'partial' as const:'no_matches' as const,
      sourceNote:'ADSB.lol batch and limited ADSBdb fallback; callsign associations are not authenticated flight plans.',
    }
  })()
  try{return await routePending}finally{routePending=null}
}
// Public observations only: no organization ledger, user tokens or secrets in cache.
const snapshots=new Map<'quick'|'full',{expires:number;snapshot:TrackingSnapshot}>()
const pendingByStage=new Map<'quick'|'full',Promise<TrackingSnapshot>>()
export async function getTrackingSnapshot(stage:'quick'|'full'='full'):Promise<TrackingSnapshot>{
  const cached=snapshots.get(stage)
  if(cached&&cached.expires>Date.now())return cached.snapshot
  const pending=pendingByStage.get(stage)
  if(pending)return pending
  const request=(async()=>{
    if(stage==='quick'){
      // Fast lane: flights only. No risk feeds, AIS processing or airport lookup.
      const air=await aircraft(FAST_AIRFRAME_SAMPLE)
      const snapshot:TrackingSnapshot={
        generatedAt:new Date().toISOString(),refreshSeconds:REFRESH_SECONDS,
        assets:air.items,alerts:[],sources:[air.source],
      }
      snapshots.set('quick',{expires:Date.now()+55000,snapshot})
      return snapshot
    }
    const [air,extra,sea,hazard,aviation,marine]=await Promise.all([
      // The UI already received four priority airframes on the quick path.
      // Two additional types enrich the full snapshot without delaying it.
      getTrackingSnapshot('quick'),aircraft(ADDITIONAL_AIRFRAME_SAMPLE),
      vessels(),hazards(),advisories(),maritime(),
    ])
    const allAircraft=mergeAssets([...air.assets,...extra.items])
    const fullAirSource=air.sources[0]
    const airSource={...fullAirSource,
      state:allAircraft.length && !allAircraft.some(asset=>freshAsset(asset))
        ?'stale' as const:'partial' as const,
      detail:fullAirSource.detail+' Additional airframe samples: '+
        extra.source.state+'. Origins/destinations are fetched independently.',
      latestObservationAt:latest(allAircraft),
    }
    const snapshot:TrackingSnapshot={
      generatedAt:new Date().toISOString(),refreshSeconds:REFRESH_SECONDS,
      assets:[...allAircraft,...sea.items],
      alerts:[...hazard.items,...aviation.items,...marine.items],
      sources:[airSource,sea.source,hazard.source,aviation.source,marine.source],
    }
    snapshots.set('full',{expires:Date.now()+55000,snapshot})
    return snapshot
  })()
  pendingByStage.set(stage,request)
  try{return await request}finally{pendingByStage.delete(stage)}
}
