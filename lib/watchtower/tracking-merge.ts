import {mergeAssets,type TrackingAsset,type TrackingSnapshot} from './global-tracking'
import type {RouteItinerary} from './itinerary-sources'

export type RouteLookupRecord={callsign:string;itinerary:RouteItinerary}
export type RouteLookupResponse={
  checkedAt:string
  routes:Record<string,RouteLookupRecord>
  status:'partial'|'unavailable'|'no_matches'
  checked:number
  matched:number
  sourceNote:string
}

/**
 * An early aircraft-only response must never erase the full alert snapshot
 * received independently. Preserve the latest coordinates and source-backed
 * route metadata across successive quick/full requests.
 */
export function mergeTrackingUpdate(
  previous:TrackingSnapshot|null,
  incoming:TrackingSnapshot,
  stage:'quick'|'full',
):TrackingSnapshot{
  if(!previous)return incoming
  const sourceMap=new Map(previous.sources.map(s=>[s.id,s]))
  for(const next of incoming.sources)sourceMap.set(next.id,next)
  const routeById=new Map<string,{callsign:string;itinerary:RouteItinerary}>()
  for(const asset of previous.assets)if(asset.itinerary)routeById.set(asset.id,{
    callsign:asset.label.trim().toUpperCase(),itinerary:asset.itinerary,
  })
  const assets=mergeAssets([...previous.assets,...incoming.assets]).map(asset=>{
    const cached=routeById.get(asset.id)
    return !asset.itinerary&&cached&&cached.callsign===asset.label.trim().toUpperCase()
      ?{...asset,itinerary:cached.itinerary}:asset
  })
  return {
    generatedAt:incoming.generatedAt>previous.generatedAt?incoming.generatedAt:previous.generatedAt,
    refreshSeconds:incoming.refreshSeconds,
    assets,
    alerts:stage==='full'?incoming.alerts:previous.alerts,
    sources:[...sourceMap.values()],
  }
}
/** Enrich only matching current hex + callsign; never attach reused callsign data. */
export function mergeFlightItineraries(
  previous:TrackingSnapshot|null,response:RouteLookupResponse,
):TrackingSnapshot|null{
  if(!previous)return previous
  const assets:TrackingAsset[]=previous.assets.map(asset=>{
    if(asset.kind!=='aircraft')return asset
    const resolved=response.routes[asset.id]
    if(!resolved||resolved.callsign.trim().toUpperCase()!==asset.label.trim().toUpperCase())
      return asset
    return {...asset,itinerary:resolved.itinerary}
  })
  return {...previous,assets}
}
