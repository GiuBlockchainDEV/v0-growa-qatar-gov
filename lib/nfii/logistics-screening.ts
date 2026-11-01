/**
 * NFII screening of POSSIBLE food transport corridors into Qatar.
 * Never infer commercial service, schedules, customs feasibility or bookings
 * from coordinates alone. Geometry-only air/road figures and transit times
 * are explicitly modelled planning assumptions, not carrier observations.
 */
import {CARGO_SPECS,getExportHub,haversineKm,QATAR_AIR,QATAR_PORT,QATAR_ROAD,type GeoPoint} from './logistics-lanes'
import type {GeoLine} from './logistics-route-geometry'
import type {HazardCoverage} from './logistics-hazards'
import {assessExposure,type ExposureAssessment} from './logistics-risk'
import type {SecurityIntelligence} from './logistics-security'

export type Mode='sea'|'air'|'road'
export type CorridorEvidence='carrier_route_geometry'|'geographic_proxy'
export type RateInput={sea:number|null;air:number|null;road:number|null}
export type RouteInputs={commodity:string;country:string;tonnes:number;limitDays:number;rates:RateInput;
  seaDistances:Record<string,{km:number;durationDays:number|null;routeUrl:string;geometry?:GeoLine|null;calculationSource?:'local_ocean_network'}>|null;
  lpi:number|null;lpiYear:number|null;waves:number|null;weatherAgeHours:number|null;
  roadDistanceKm?:number|null;roadDriveHours?:number|null;hazards?:HazardCoverage|null;
  security?:SecurityIntelligence|null}
export type ScreenedRoute={
  id:string;country:string;commodity:string;mode:Mode;via:string|null;
  from:string;to:string;originCode:string;destinationCode:string;
  distanceKm:number;distanceType:'observed_sea_route'|'observed_road_drive_geometry'|'straight_line_lower_bound'|'geometric_estimate';
  estimatedDays:number|null;timeBasis:string;feasibleBeforeDeadline:boolean|null;
  reeferRequired:boolean;storageNote:string;
  rateQarPerTonne:number|null;freightTotalQar:number|null;freightQarKg:number|null;
  exposure:ExposureAssessment;
  costSource:'user_supplied_rate'|'no_rate';riskScore:number|null;
  riskBand:'reported_alert'|'no_nearby_reported_alert'|'unavailable';riskDrivers:string[];
  riskMethod:string;quality:'route_api'|'model_only';
  evidence:CorridorEvidence;sourceUrl:string|null;
  requiresQuote:true;bookingConfirmed:false;
}
const round=(n:number,decimal=1)=>Number(n.toFixed(decimal))
export const QATAR_GATEWAYS={
  sea:QATAR_PORT,air:QATAR_AIR,road:QATAR_ROAD,
}
const km=(a:GeoPoint,b:GeoPoint)=>haversineKm(a,b)
const MAX=100000
/** Forward-looking feasibility cannot be asserted when departure is not scheduled. */
export function buildScreenedRoutes(inputs:RouteInputs):ScreenedRoute[]{
  const hub=getExportHub(inputs.country)
  const spec=CARGO_SPECS[inputs.commodity]
  if(!hub||!spec)throw Error('Unsupported origin or food type')
  const origin=hub.country,tonnes=inputs.tonnes
  if(!Number.isFinite(tonnes)||tonnes<=0||tonnes>200)throw Error('Invalid tonnes')
  const make=(route:{
    id:string;mode:Mode;via:string|null;from:string;to:string;
    originCode:string;destinationCode:string;geometry:GeoPoint[];
  }):ScreenedRoute=>{
    const observed=inputs.seaDistances?.[route.id]
    const routeKm=observed?.km
    const rawKm=route.geometry.reduce((sum,p,i)=>
      i?sum+km(route.geometry[i-1],p):0,0)
    // Sea fallback: do not dress a direct geodesic as a navigable sea route.
    const realRoad=route.mode==='road'&&inputs.roadDistanceKm!==null&&
      inputs.roadDistanceKm!==undefined&&Number.isFinite(inputs.roadDistanceKm)
    const distance=route.mode==='sea'&&routeKm!==undefined?routeKm:
      realRoad?inputs.roadDistanceKm!:route.mode==='road'?rawKm*1.4:rawKm
    const documentedDistance=route.mode==='sea'&&routeKm!==undefined
    // Single air and road paths are only coarse screening scenarios.
    // Airport-to-airport planning estimate only; NOT a carrier-confirmed ETA.
    const airDays=route.mode==='air'?
      Math.round((rawKm/750+24+6)/24*10)/10:null
    const days=route.mode==='sea'?(observed?.durationDays??null):airDays
    const rate=inputs.rates[route.mode]
    const safeRate=rate!==null&&Number.isFinite(rate)&&rate>0&&rate<MAX?rate:null
    const riskDrivers:string[]=[]
    const coverage=inputs.hazards
    const recent=coverage?.state==='available'?coverage.alerts:[]
    if(coverage?.state!=='available')
      riskDrivers.push('GDACS regional alert coverage unavailable; hazards not assessed')
    else if(recent.length)
      riskDrivers.push(...recent.map(alert=>'GDACS '+alert.label))
    else
      riskDrivers.push('No recent GDACS orange/red point alerts within 400 km of the sampled endpoints; not evidence of a safe corridor')
    if(spec.coldChain)
      riskDrivers.push('Product requires verified temperature controls and remaining shelf-life validation')
    if(route.via)
      riskDrivers.push('Transfer hub is a geographic candidate, not a validated operating service')
    if(route.mode==='sea'&&!documentedDistance)
      riskDrivers.push('No navigable route and duration returned from SeaRoutes for this itinerary')
    if(route.mode==='air')
      riskDrivers.push('No airline itinerary, schedule, cargo acceptance or verified delivery ETA')
    if(route.mode==='road')
      riskDrivers.push(realRoad?
        'Google car-driving geometry is available; heavy truck, border crossing and customs remain unverified':
        'No road network geometry; truck route, border and timing unverified')
    if(days!==null&&days>inputs.limitDays)
      riskDrivers.push('SeaRoutes theoretical voyage duration exceeds requested delivery window')
    if(inputs.lpi!==null)
      riskDrivers.push('World Bank historical LPI: '+inputs.lpi+' ('+inputs.lpiYear+
        '), national context only, not route-specific disruption data')
    if(route.mode==='sea'&&inputs.waves!==null)
      riskDrivers.push('Open-Meteo sampled origin-port maximum forecast wave: '+
        inputs.waves+'m; not full voyage exposure')
    if(safeRate===null)
      riskDrivers.push('Actual carrier price not available for this mode')
    const exposure:ExposureAssessment=inputs.security?
      assessExposure(route.mode,origin,inputs.security,recent.length>0):{
        index:null,label:'unknown',confidence:'unavailable',
        hormuzExposure:route.mode==='sea'&&!['SA','AE','KW','BH','IQ','IR'].includes(origin),
        airspaceClosure:'not_verified',hormuzClosure:'not_verified',
        evidence:['Security data not queried'],sources:[],
      }
    riskDrivers.push(...exposure.evidence)
    if(airDays!==null)
      riskDrivers.push('Air days are modeled: geodesic distance / 750 km/h + 24h handling + 6h buffer; no real flight schedule or operational clearance verified')
    const riskBand:ScreenedRoute['riskBand']=coverage?.state!=='available'?'unavailable':
      recent.length?'reported_alert':'no_nearby_reported_alert'
    return {
      id:route.id,country:origin,commodity:inputs.commodity,mode:route.mode,
      via:route.via,from:route.from,to:route.to,
      originCode:route.originCode,destinationCode:route.destinationCode,
      distanceKm:round(distance,0),
      distanceType:documentedDistance?'observed_sea_route':
        realRoad?'observed_road_drive_geometry':
        route.mode==='road'?'geometric_estimate':'straight_line_lower_bound',
      estimatedDays:days,
      timeBasis:route.mode==='air'?
        'MODELED air cargo days: geodesic/750 km/h + 24h handling + 6h buffer; not a verified carrier ETA or operational airspace clearance':
        documentedDistance?
        (observed?.calculationSource==='local_ocean_network'?
          'Ocean-grid route at assumed 14 knots; navigation-only estimate, NO carrier schedule, dwell or customs':
          observed!.durationDays!==null?'SeaRoutes published route duration':'No published schedule/duration'):
        route.mode==='sea'?'No sea transit ETA; straight-line lower-bound only':
        realRoad?'Google road distance; commercial trucking and border times remain assumptions':
        'Planning estimate from geometric distance, nominal movement and handling; no schedules',
      feasibleBeforeDeadline:days!==null?days<=inputs.limitDays:null,
      reeferRequired:spec.coldChain,storageNote:spec.temperature,
      rateQarPerTonne:safeRate,
      freightTotalQar:safeRate===null?null:round(safeRate*tonnes,2),
      freightQarKg:safeRate===null?null:round(safeRate/1000,3),
      costSource:safeRate===null?'no_rate':'user_supplied_rate',
      riskScore:exposure.index,riskBand,exposure,
      riskDrivers,riskMethod:'Source-backed 0–100 exposure INDEX, not a statistical probability of delay, attack or closure',
      quality:documentedDistance||realRoad?'route_api':'model_only',
      evidence:documentedDistance?'carrier_route_geometry':'geographic_proxy',
      sourceUrl:documentedDistance?observed!.routeUrl:realRoad?
        'https://developers.google.com/maps/documentation/routes/compute_route_directions':null,
      requiresQuote:true,bookingConfirmed:false,
    }
  }
  const originSea=hub.sea,originAir=hub.air
  const wayJebel={lat:24.99,lon:55.06},waySalalah={lat:16.94,lon:54.01}
  const directSea=make({id:'sea_direct',mode:'sea',via:null,from:hub.port,to:QATAR_PORT.name,
    originCode:hub.unlocode,destinationCode:QATAR_PORT.code,
    geometry:[originSea,QATAR_PORT]})
  const variants:ScreenedRoute[]=[directSea]
  if(!['SA','AE','OM','KW','BH','QA'].includes(origin)){
    if(inputs.seaDistances?.sea_jebel_ali?.geometry?.length)
    variants.push(make({id:'sea_jebel_ali',mode:'sea',via:'Jebel Ali transfer candidate',
      from:hub.port,to:QATAR_PORT.name,originCode:hub.unlocode,
      destinationCode:QATAR_PORT.code,
      geometry:[originSea,wayJebel,QATAR_PORT]}))
    if(inputs.seaDistances?.sea_salalah?.geometry?.length)
    variants.push(make({id:'sea_salalah',mode:'sea',via:'Salalah transfer candidate',
      from:hub.port,to:QATAR_PORT.name,originCode:hub.unlocode,
      destinationCode:QATAR_PORT.code,geometry:[originSea,waySalalah,QATAR_PORT]}))
  }
  variants.push(make({id:'air_direct',mode:'air',via:null,from:hub.airport,
    to:QATAR_AIR.name,originCode:hub.iata,destinationCode:QATAR_AIR.code,
    geometry:[originAir,QATAR_AIR]}))
  // Do not propose a Dubai air connection without airline schedules/cargo service.
  if(hub.roadEligible&&inputs.roadDistanceKm!==null&&
    inputs.roadDistanceKm!==undefined){
    variants.push(make({id:'road_candidate',mode:'road',via:'Border crossing unverified',
      from:hub.port,to:'Abu Samra / Doha',originCode:origin,
      destinationCode:QATAR_ROAD.code,
      geometry:[originSea,QATAR_ROAD]}))
  }
  return variants.sort((a,b)=>
    (a.feasibleBeforeDeadline===false?1:0)-(b.feasibleBeforeDeadline===false?1:0)||
    (a.mode==='sea'?0:a.mode==='air'?1:2)-
      (b.mode==='sea'?0:b.mode==='air'?1:2))
}
export const LOGISTICS_DATA_RULES=[
  'No live carrier schedules or bookable routings without carrier API.',
  'Air days are a geodesic planning estimate at 750 km/h + 24h handling + 6h buffer, not a scheduled carrier ETA.',
  'The 0–100 security exposure index is not a percentage probability; unavailable evidence stays N/A.',
  'When no SeaRoutes response exists, a locally computed ocean-grid route may be shown at 14-knot assumed vessel speed; not a live service.',
  'Cost values only from user-provided freight rate per tonne; do not imply spot quotes.',
  'GDACS alerts near origin/Qatar are endpoint hazard observations, not route disruption estimates.',
  'LPI is a historical national benchmark, not a current shipment risk probability.',
  'Wave height is sampled at the departure port; not entire-route storm intelligence.',
  'Shelf-life constraints depend on harvest date, loading temperature and SKU.',
] as const
