/**
 * Worldwide production-supply exposure: a geographic screening layer, not
 * confirmed damaged acreage or a price forecast.
 *
 * Source: recent GDACS red/orange hazard events (existing authenticated
 * Watchtower feed). A point is assigned to an Esri ADM1 polygon only when
 * Esri spatial query identifies the administrative division containing it.
 * The whole division is a SCREENING area, never the disaster's footprint.
 * Offshore/unlocated events fall back to a labelled point-radius proxy.
 */
import type {MapAlert} from './global-tracking'

export type ProductionDriver='flood'|'drought'|'storm'|'wildfire'|'volcano'|'earthquake'
export type ProductionLevel='high'|'elevated'
export type RiskPolygon={
  type:'Polygon'|'MultiPolygon'
  coordinates:number[][][]|number[][][][]
}
export type ProductionRiskZone={
  id:string
  name:string
  country:string|null
  center:{lat:number;lon:number}
  geometry:RiskPolygon|null
  radiusKm:number|null
  boundaryBasis:'esri_admin1_screening'|'approximate_point_radius'
  driver:ProductionDriver
  severity:ProductionLevel
  observedAt:string|null
  source:'GDACS'
  sourceUrl:string
  evidenceCount:number
  eventTitles:string[]
  productionExposure:string
  costChannels:string
  scopeNote:string
}
export type ProductionRiskSnapshot={
  generatedAt:string
  zones:ProductionRiskZone[]
  status:'available'|'partial'|'unavailable'
  checkedEvents:number
  mappedRegions:number
  sourceNote:string
  boundaryAttribution:string
  sourceUrl:string
}
export const RISK_DRIVERS:Record<ProductionDriver,{
  production:string;cost:string;radiusKm:number
}>={
  drought:{production:'Possible soil moisture stress, reduced yields and livestock-feed availability in exposed growing areas.',
    cost:'Potential higher irrigation, pumping, feed and agricultural import procurement costs.',radiusKm:140},
  flood:{production:'Possible waterlogging, crop loss, harvesting interruptions and post-harvest losses near affected fields.',
    cost:'Potential farm-to-port transport, cold-chain, storage and replacement procurement costs.',radiusKm:90},
  storm:{production:'Potential crop lodging, damaged protected cultivation and farm power or irrigation interruptions.',
    cost:'Potential higher repair, logistics, storage, and substitute sourcing costs.',radiusKm:140},
  wildfire:{production:'Potential damage to crops, grazing land and farm infrastructure; smoke exposure.',
    cost:'Potential supply interruptions, insurance, transport and replacement sourcing costs.',radiusKm:85},
  volcano:{production:'Potential ash impacts on vegetation, livestock and farm operations near the event.',
    cost:'Potential handling, route disruption and farm equipment cleanup costs.',radiusKm:75},
  earthquake:{production:'Agricultural land damage is NOT established; logistics, water and power infrastructure may be exposed.',
    cost:'Potential cold-chain, transport, energy and infrastructure costs, not a measured food-price rise.',radiusKm:65},
}
export function gdacsDriver(alert:MapAlert):ProductionDriver|null{
  if(alert.source!=='GDACS'||alert.kind!=='hazard')return null
  const code=alert.id.split(':')[1]?.toUpperCase()
  if(code==='FL')return 'flood'
  if(code==='DR')return 'drought'
  if(code==='TC')return 'storm'
  if(code==='WF')return 'wildfire'
  if(code==='VO')return 'volcano'
  if(code==='EQ')return 'earthquake'
  return null
}
const safe=(raw:unknown,max=120)=>typeof raw==='string'?raw.trim().slice(0,max):''
function isPoint(p:unknown):p is number[]{
  return Array.isArray(p)&&p.length>=2&&p.length<=4&&
    typeof p[0]==='number'&&Number.isFinite(p[0])&&Math.abs(p[0])<=180&&
    typeof p[1]==='number'&&Number.isFinite(p[1])&&Math.abs(p[1])<=90
}
function isRing(input:unknown):input is number[][]{
  return Array.isArray(input)&&input.length>=4&&input.length<=35000&&input.every(isPoint)
}
export function validRiskPolygon(raw:unknown):RiskPolygon|null{
  if(!raw||typeof raw!=='object')return null
  const g=raw as Record<string,unknown>,coordinates=g.coordinates
  if(g.type==='Polygon'&&Array.isArray(coordinates)&&coordinates.length<=400&&
    coordinates.every(isRing))
    return {type:'Polygon',coordinates:coordinates as number[][][]}
  if(g.type==='MultiPolygon'&&Array.isArray(coordinates)&&coordinates.length<=450&&
    coordinates.every(poly=>Array.isArray(poly)&&poly.length<=400&&poly.every(isRing)))
    return {type:'MultiPolygon',coordinates:coordinates as number[][][][]}
  return null
}
export type AdministrativeMatch={name:string;country:string|null;code:string|null;geometry:RiskPolygon}
/** A single point-in-polygon ArcGIS query must be treated as a SCREENING area. */
export function parseAdministrativeMatch(raw:unknown):AdministrativeMatch|null{
  if(!raw||typeof raw!=='object')return null
  const features=(raw as {features?:unknown}).features
  if(!Array.isArray(features)||!features.length)return null
  const f=features[0]
  if(!f||typeof f!=='object')return null
  const row=f as {properties?:unknown;geometry?:unknown}
  const p=row.properties as Record<string,unknown>|null
  const geometry=validRiskPolygon(row.geometry)
  const name=safe(p?.NAME),country=safe(p?.COUNTRY)
  if(!name||!geometry)return null
  return {name,country:country||null,code:safe(p?.ISO_SUB)||null,geometry}
}
export function hazardScreeningZone(alert:MapAlert,admin:AdministrativeMatch|null):ProductionRiskZone|null{
  const driver=gdacsDriver(alert)
  if(!driver||!Number.isFinite(alert.lat)||!Number.isFinite(alert.lon)||
    Math.abs(alert.lat)>85||Math.abs(alert.lon)>180)return null
  const configuration=RISK_DRIVERS[driver]
  return {
    id:'production:'+alert.id,
    name:admin?.name??alert.title,
    country:admin?.country??null,
    center:{lat:alert.lat,lon:alert.lon},
    geometry:admin?.geometry??null,
    radiusKm:admin?null:configuration.radiusKm,
    boundaryBasis:admin?'esri_admin1_screening':'approximate_point_radius',
    driver,severity:alert.severity==='high'?'high':'elevated',
    observedAt:alert.observedAt,source:'GDACS',sourceUrl:alert.sourceUrl,
    evidenceCount:1,eventTitles:[alert.title],
    productionExposure:configuration.production,costChannels:configuration.cost,
    scopeNote:admin
      ?'One reported GDACS event point falls inside this administrative region. The highlighted region is a screening boundary, NOT the verified impact footprint; crop area and losses are unknown.'
      :'Approximate event-centred screening radius, NOT GDACS event footprint or verified farmland exposure. The administrative boundary service did not identify a region.',
  }
}
/** Avoid stacked duplicate highlights when multiple events hit the same ADM1. */
export function combineRiskZones(zones:ProductionRiskZone[]):ProductionRiskZone[]{
  const byKey=new Map<string,ProductionRiskZone>()
  for(const zone of zones){
    const key=zone.boundaryBasis==='esri_admin1_screening'
      ?[zone.country,zone.name,zone.driver].join('|'):zone.id
    const old=byKey.get(key)
    if(!old){byKey.set(key,{...zone});continue}
    old.evidenceCount+=zone.evidenceCount
    old.eventTitles=[...old.eventTitles,...zone.eventTitles].slice(0,6)
    if(zone.severity==='high')old.severity='high'
    if((zone.observedAt??'')>(old.observedAt??'')){
      old.observedAt=zone.observedAt
      old.sourceUrl=zone.sourceUrl
    }
  }
  return [...byKey.values()].sort((a,b)=>
    Number(b.severity==='high')-Number(a.severity==='high')||
    b.evidenceCount-a.evidenceCount||(b.observedAt??'').localeCompare(a.observedAt??''))
}
