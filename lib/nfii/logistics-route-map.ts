import {getExportHub,QATAR_AIR,QATAR_PORT,QATAR_ROAD,type GeoPoint} from './logistics-lanes'
import {makeAirGreatCircle,splitAtDateline,type GeoLine,type GeoPointTuple} from './logistics-route-geometry'
import type {ScreenedRoute,RouteInputs} from './logistics-screening'

export type RouteMapOverlay={
  id:string;mode:ScreenedRoute['mode']
  paths:GeoLine
  fidelity:'provider_geometry'|'modeled_geometry'|'illustrative'
  from:string;to:string;via:string|null
  origin:GeoPointTuple;destination:GeoPointTuple
  source:string|null
}
const pt=(p:GeoPoint):GeoPointTuple=>[p.lat,p.lon]
/** Links missing source geometry are explicitly illustrative, not navigable tracks. */
export function makeRouteMapOverlays(
  routes:readonly ScreenedRoute[],country:string,
  observed:RouteInputs['seaDistances'],
):RouteMapOverlay[]{
  const hub=getExportHub(country)
  if(!hub)return []
  return routes.map((route):RouteMapOverlay=>{
    const origin=route.mode==='air'?pt(hub.air):pt(hub.sea)
    const destination=route.mode==='air'?pt(QATAR_AIR):
      route.mode==='road'?pt(QATAR_ROAD):pt(QATAR_PORT)
    const published=route.mode==='sea'?observed?.[route.id]?.geometry:null
    // No flight-track provider is connected. An air geodesic is a visible
    // planning reference only, never a verified airway or carrier itinerary.
    const paths=route.mode==='air'?makeAirGreatCircle(origin,destination):
      published?.length?splitAtDateline(published):[]
    return {
      id:route.id,mode:route.mode,
      paths,
      fidelity:route.mode==='air'?'illustrative':
        published?.length?(observed?.[route.id]?.calculationSource==='local_ocean_network'?
          'modeled_geometry':'provider_geometry'):'illustrative',
      from:route.from,to:route.to,via:route.via,
      origin,destination,
      source:route.mode==='air'?'Great-circle reference; not a verified flight path':
        published?.length?(observed?.[route.id]?.calculationSource==='local_ocean_network'?
          'Ocean-grid estimate':'SeaRoutes'):null,
    }
  })
}

/**
 * Initial UI illustration while the user has not run a provider-backed
 * assessment. These lines NEVER imply a bookable maritime/air service.
 */
export function previewRouteMapOverlays(country:string):RouteMapOverlay[]{
  const hub=getExportHub(country)
  if(!hub)return []
  const seaOrigin=pt(hub.sea),airOrigin=pt(hub.air)
  const rows:Array<{id:string;mode:ScreenedRoute['mode'];
    origin:GeoPointTuple;end:GeoPointTuple;via:GeoPointTuple|null}>= [
    {id:'sea_direct',mode:'sea',origin:seaOrigin,end:pt(QATAR_PORT),via:null},
    {id:'air_direct',mode:'air',origin:airOrigin,end:pt(QATAR_AIR),via:null},
  ]
  return rows.map(row=>({
    id:row.id,mode:row.mode,origin:row.origin,destination:row.end,
    from:row.mode==='air'?hub.airport:hub.port,
    to:row.mode==='air'?QATAR_AIR.name:
      row.mode==='road'?QATAR_ROAD.name:QATAR_PORT.name,
    paths:row.mode==='air'?makeAirGreatCircle(row.origin,row.end):[],
    via:row.via?'Candidate transfer hub':null,
    fidelity:'illustrative' as const,source:null,
  }))
}
