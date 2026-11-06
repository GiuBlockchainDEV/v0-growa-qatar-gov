import type {ProductionRiskZone} from './production-risk'

/**
 * Convert provider-backed GeoJSON screening regions into bounded Cesium-ready
 * coordinate rings. GeoJSON stores [longitude, latitude], not [lat, lon].
 * This does NOT estimate a hazard impact footprint or create new risk areas.
 */
export type GlobeLonLat=[number,number]
export type GlobeRiskPart={outer:GlobeLonLat[];holes:GlobeLonLat[][]}
const MAX_POLYGON_PARTS=24
const MAX_HOLES_PER_PART=12
const MAX_RING_VERTICES=750

function normaliseRiskRing(raw:unknown):GlobeLonLat[]{
 if(!Array.isArray(raw)||raw.length<4)return []
 const original:GlobeLonLat[]=[]
 for(const vertex of raw){
  if(!Array.isArray(vertex)||vertex.length<2)return []
  const lon=vertex[0],lat=vertex[1]
  if(typeof lon!=='number'||typeof lat!=='number'||
     !Number.isFinite(lon)||!Number.isFinite(lat)||
     Math.abs(lon)>180||Math.abs(lat)>90)return []
  original.push([lon,lat])
 }
 // Remove GeoJSON's repeated closing vertex before Cesium PolygonHierarchy.
 const first=original[0],last=original[original.length-1]
 if(first[0]===last[0]&&first[1]===last[1])original.pop()
 if(original.length<3)return []
 // Bound geometry size for Cesium. Administrative boundaries are screening
 // geometries; the user must not infer an exact incident perimeter.
 const stride=Math.ceil(original.length/MAX_RING_VERTICES)
 const ring=original.filter((_,i)=>i%stride===0)
 if(original.length>1&&(original.length-1)%stride!==0)
  ring.push(original[original.length-1])
 return ring.length>=3?ring:[]
}

export function globeRiskParts(zone:ProductionRiskZone):GlobeRiskPart[]{
 const geometry=zone.geometry
 if(!geometry)return []
 const polygons=geometry.type==='Polygon'
  ? [geometry.coordinates as number[][][]]
  : geometry.coordinates as number[][][][]
 const result:GlobeRiskPart[]=[]
 for(const polygon of polygons.slice(0,MAX_POLYGON_PARTS)){
  if(!Array.isArray(polygon)||!polygon.length)continue
  const outer=normaliseRiskRing(polygon[0])
  if(outer.length<3)continue
  const holes=polygon.slice(1,1+MAX_HOLES_PER_PART)
   .map(normaliseRiskRing).filter(ring=>ring.length>=3)
  result.push({outer,holes})
 }
 return result
}

export function hasApproximateRiskRadius(zone:ProductionRiskZone):boolean{
 return zone.geometry===null&&zone.boundaryBasis==='approximate_point_radius'&&
  zone.radiusKm!==null&&Number.isFinite(zone.radiusKm)&&
  zone.radiusKm>0&&zone.radiusKm<=500&&
  Number.isFinite(zone.center.lat)&&Number.isFinite(zone.center.lon)&&
  Math.abs(zone.center.lat)<=85&&Math.abs(zone.center.lon)<=180
}
