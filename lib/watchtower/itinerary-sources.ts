/**
 * Source-backed airport/port endpoints for Watchtower.
 *
 * ADS-B positions do not transmit an itinerary. ADSB.lol /api/0/routeset
 * returns a callsign-based route *lookup*, not a current authenticated
 * flight plan. We keep provider plausibility and avoid implying certainty.
 *
 * VesselFinder AIS destination is entered by the crew. Its optional VOYAGE
 * dataset identifies the last port, not necessarily a cargo loading port.
 * All actual coordinates come from the source or an identified port reference.
 */
import {getExportHub,HUB_COUNTRIES,QATAR_PORT} from '@/lib/nfii/logistics-lanes'
import type {TrackingAsset} from './global-tracking'

export type RouteEndpoint={
  name:string;code:string|null;country:string|null
  lat:number|null;lon:number|null
}
export type RouteItinerary={
  origin:RouteEndpoint|null
  destination:RouteEndpoint|null
  departureAt:string|null
  etaAt:string|null
  source:'adsb_lol_routeset'|'adsbdb_callsign'|'vesselfinder_ais_voyage'|'myshiptracking_voyage'|'myshiptracking_public'
  sourceUrl:string
  confidence:'lookup_plausible'|'lookup_unverified'|'crew_reported'
  description:string
  // Optional offline model, NOT a vessel track or captain's itinerary.
  modelSeaLegs?:{completed:{lat:number;lon:number}[];remaining:{lat:number;lon:number}[]}
}
type Dict=Record<string,unknown>
const obj=(x:unknown):Dict=>typeof x==='object'&&x!==null&&!Array.isArray(x)?x as Dict:{}
const safe=(x:unknown,max=110)=>typeof x==='string'?x.replace(/[<>]/g,'').trim().slice(0,max):''
const upper=(x:unknown,max=20)=>safe(x,max).toUpperCase().replace(/\s+/g,'')
const coord=(x:unknown,limit:number):number|null=>{
  const n=typeof x==='number'?x:typeof x==='string'&&x.trim()?Number(x):NaN
  return Number.isFinite(n)&&Math.abs(n)<=limit?n:null
}
const date=(x:unknown)=>{
  const t=safe(x,50)
  if(!t)return null
  const iso=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}( UTC)?$/.test(t)?
    t.replace(' UTC','').replace(' ','T')+'Z':t
  const ms=Date.parse(iso)
  return Number.isFinite(ms)?new Date(ms).toISOString():null
}
const catalog=[
  ...HUB_COUNTRIES.flatMap(x=>{
    const hub=getExportHub(x.countryCode)
    return hub?[{name:hub.port,code:hub.unlocode,lat:hub.sea.lat,lon:hub.sea.lon,country:hub.country}]:[]
  }),
  {name:QATAR_PORT.name,code:QATAR_PORT.code,lat:QATAR_PORT.lat,lon:QATAR_PORT.lon,country:'QA'},
]
const compact=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,'')
export function knownPort(value:unknown):RouteEndpoint|null{
  const raw=safe(value,80)
  if(!raw)return null
  const key=compact(raw)
  const match=catalog.find(x=>key===compact(x.code)||key===compact(x.name))
  return match?{name:match.name,code:match.code,country:match.country,
    lat:match.lat,lon:match.lon}:null
}
function portWithEvidence(name:unknown,code:unknown):RouteEndpoint|null{
  const raw=safe(name,80),key=upper(code,12)
  const looked=knownPort(key)||knownPort(raw)
  if(!raw&&!looked)return null
  return {name:raw||looked!.name,code:looked?.code||(key&&/^[A-Z]{2}[A-Z0-9]{3}$/.test(key)?key:null),
    country:looked?.country??null,lat:looked?.lat??null,lon:looked?.lon??null}
}
export function vesselReportedItinerary(raw:unknown):RouteItinerary|null{
  const record=obj(raw),ais=obj(record.AIS),voyage=obj(record.VOYAGE)
  const reported=safe(ais.DESTINATION,80)
  // AIS destination is often free text, e.g. "FRURO>NOMLK".
  // Resolve only exact, recognised five-character UN/LOCODEs or known names.
  const locode=upper(ais.LOCODE,12)
  const tail=reported.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z]{2}[A-Z0-9]{3})$/)?.[1]??''
  const destination=portWithEvidence(reported,knownPort(locode)?locode:tail)
  const origin=portWithEvidence(voyage.LASTPORT,voyage.LOCODE)
  if(!origin&&!destination)return null
  return {
    origin,destination,
    departureAt:origin?date(voyage.DEPARTURE):null,
    etaAt:destination?date(ais.ETA):null,
    source:'vesselfinder_ais_voyage',
    sourceUrl:'https://api.vesselfinder.com/docs/livedata.html',
    confidence:'crew_reported',
    description:origin
      ?'Last port reported by licensed VesselFinder VOYAGE; not verified cargo-loading origin. Destination is crew-entered AIS and may change.'
      :'Previous port unavailable without VesselFinder VOYAGE entitlement. Destination is crew-entered AIS and may change.',
  }
}
function airport(x:unknown):RouteEndpoint|null{
  const v=obj(x),lat=coord(v.lat??v.latitude,85),lon=coord(v.lon??v.longitude,180)
  if(lat===null||lon===null)return null
  const name=safe(v.name,110),code=upper(v.iata??v.iata_code??v.icao??v.icao_code,8)
  if(!name&&!code)return null
  return {name:name||code,code:code||null,country:upper(v.countryiso2??v.country_iso_name,8)||null,lat,lon}
}
const callsign=(x:unknown)=>{
  const key=upper(x,15)
  return /^[A-Z0-9]{3,10}$/.test(key)?key:null
}
export type FlightRouteLookup={results:TrackingAsset[];matches:number;plausible:number}
/** Parses ADSB.lol batch route lookup response, preserving the same order. */
export function applyFlightRouteLookups(
  assets:readonly TrackingAsset[],raw:unknown,
):FlightRouteLookup{
  const data=Array.isArray(raw)?raw.slice(0,600):[]
  const byCallsign=new Map<string,Dict>()
  for(const item of data){
    const entry=obj(item),key=callsign(entry.callsign)
    if(key&&!byCallsign.has(key))byCallsign.set(key,entry)
  }
  let matches=0,plausible=0
  const results=assets.map(asset=>{
    if(asset.kind!=='aircraft')return asset
    const key=callsign(asset.label),entry=key?byCallsign.get(key):undefined
    const airports=entry?entry._airports:null
    // Multi-hop routes cannot identify the leg currently being flown.
    if(!Array.isArray(airports)||airports.length!==2)return asset
    const origin=airport(airports[0]),destination=airport(airports[1])
    if(!origin||!destination||(origin.lat===destination.lat&&origin.lon===destination.lon))return asset
    matches++
    if(entry!.plausible===true)plausible++
    const itinerary:RouteItinerary={
      origin,destination,departureAt:null,etaAt:null,
      source:'adsb_lol_routeset',sourceUrl:'https://api.adsb.lol/docs',
      confidence:entry!.plausible===true?'lookup_plausible':'lookup_unverified',
      description:'Callsign-based airport pair supplied by ADSB.lol. '+
        'Not a dated flight plan, not proof of actual departure/arrival, '+
        'and not an observed flown path. Callsigns and routes may be reused or stale.',
    }
    return {...asset,itinerary}
  })
  return {results,matches,plausible}
}
/** Independent ADSBdb origin/destination lookup, never an authenticated flight plan. */
export function adsbdbItinerary(raw:unknown):RouteItinerary|null{
  const response=obj(obj(raw).response),flight=obj(response.flightroute)
  if(!Object.keys(flight).length)return null
  const rawOrigin=obj(flight.origin),rawDestination=obj(flight.destination)
  const airportFrom=(v:Dict):RouteEndpoint|null=>{
    const lat=coord(v.latitude??v.lat,85),lon=coord(v.longitude??v.lon,180)
    const code=upper(v.iata_code??v.icao_code,8)
    const name=safe(v.name,110)
    if(lat===null||lon===null||(!name&&!code))return null
    return {name:name||code,code:code||null,country:upper(v.country_iso_name,8)||null,lat,lon}
  }
  const origin=airportFrom(rawOrigin),destination=airportFrom(rawDestination)
  if(!origin||!destination||(origin.lat===destination.lat&&origin.lon===destination.lon))return null
  return {
    origin,destination,departureAt:null,etaAt:null,
    source:'adsbdb_callsign',sourceUrl:'https://www.adsbdb.com/',
    confidence:'lookup_unverified',
    description:'ADSBdb callsign association. Not a dated flight plan or verified active leg. '+
      'Coordinates identify airports only; origin-to-position and position-to-destination lines are model references.',
  }
}
/** Per-snapshot batch input, bounded and deduplicated for courteous API use. */
export function flightLookupInput(assets:readonly TrackingAsset[],limit=140){
  const seen=new Set<string>()
  return [...assets].filter(a=>a.kind==='aircraft').sort((a,b)=>
    Number(b.cargo==='operator_inferred')-Number(a.cargo==='operator_inferred'))
    .flatMap(a=>{
      const key=callsign(a.label)
      if(!key||seen.has(key))return []
      seen.add(key)
      return [{callsign:key,lat:a.lat,lng:a.lon}]
    }).slice(0,limit)
}
