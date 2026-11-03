import {hazards} from './tracking-providers'
import {
  combineRiskZones,hazardScreeningZone,parseAdministrativeMatch,
  type AdministrativeMatch,type ProductionRiskSnapshot,
  type ProductionRiskZone,
} from './production-risk'

const BOUNDARY_SERVICE=
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Administrative_Divisions/FeatureServer/0/query'
const BOUNDARY_URL=
  'https://hub.arcgis.com/datasets/esri::world-administrative-divisions/about'
const MAX_EVENTS=24
const BOUNDARY_BYTES=650000
const TTL_MS=20*60000

type Cache={expires:number;data:ProductionRiskSnapshot}
let cache:Cache|null=null
let pending:Promise<ProductionRiskSnapshot>|null=null

/** Public Esri feature geometry, queried by source event coordinate only. */
async function administrativeRegion(lat:number,lon:number):Promise<AdministrativeMatch|null>{
  const url=new URL(BOUNDARY_SERVICE)
  url.searchParams.set('where','1=1')
  url.searchParams.set('geometry',JSON.stringify({
    x:lon,y:lat,spatialReference:{wkid:4326},
  }))
  url.searchParams.set('geometryType','esriGeometryPoint')
  url.searchParams.set('spatialRel','esriSpatialRelIntersects')
  url.searchParams.set('inSR','4326')
  url.searchParams.set('outSR','4326')
  url.searchParams.set('outFields','NAME,COUNTRY,ISO_SUB')
  url.searchParams.set('resultRecordCount','1')
  url.searchParams.set('geometryPrecision','3')
  url.searchParams.set('maxAllowableOffset','0.035')
  url.searchParams.set('returnGeometry','true')
  url.searchParams.set('f','geojson')
  const response=await fetch(url.toString(),{
    headers:{Accept:'application/geo+json,application/json'},
    signal:AbortSignal.timeout(3900),next:{revalidate:3600},
  })
  if(!response.ok)return null
  const length=Number(response.headers.get('content-length')??0)
  if(length>BOUNDARY_BYTES)return null
  const body=await response.text()
  if(body.length>BOUNDARY_BYTES)return null
  try{return parseAdministrativeMatch(JSON.parse(body) as unknown)}catch{return null}
}

async function loadProductionRisks():Promise<ProductionRiskSnapshot>{
  const result=await hazards()
  if(result.source.state==='unavailable'||result.source.state==='unconfigured'){
    return {
      generatedAt:new Date().toISOString(),zones:[],status:'unavailable',
      checkedEvents:0,mappedRegions:0,
      sourceNote:'GDACS event feed unavailable. Empty polygons do not mean the world is risk-free.',
      sourceUrl:'https://www.gdacs.org/',
      boundaryAttribution:'Esri, Garmin International, Inc. / World Administrative Divisions',
    }
  }
  const sourceEvents=result.items
    .filter(a=>a.kind==='hazard'&&a.source==='GDACS')
    .slice(0,MAX_EVENTS)
  // Limit boundary requests, no user-defined URLs or unbounded loops.
  const zones:ProductionRiskZone[]=[]
  for(let offset=0;offset<sourceEvents.length;offset+=4){
    const batch=sourceEvents.slice(offset,offset+4)
    const resolved=await Promise.all(batch.map(async alert=>{
      const boundary=await administrativeRegion(alert.lat,alert.lon)
        .catch(()=>null)
      return {zone:hazardScreeningZone(alert,boundary),mapped:boundary!==null}
    }))
    for(const item of resolved){
      if(item.zone)zones.push(item.zone)
    }
  }
  const deduplicated=combineRiskZones(zones)
  return {
    generatedAt:new Date().toISOString(),
    zones:deduplicated,
    checkedEvents:sourceEvents.length,
    mappedRegions:deduplicated.filter(z=>z.geometry!==null).length,
    status:deduplicated.length?'partial':'available',
    sourceNote:'Recent GDACS red/orange events; Esri ADM1 polygon when the event point matches a region. Highlighted areas are SCREENING units, not verified disaster boundaries, cropland losses or measured price increases. FAO ASIS drought stress is a separate data source not inferred here.',
    sourceUrl:'https://www.gdacs.org/',
    boundaryAttribution:'Esri, Garmin International, Inc. / World Administrative Divisions — '+BOUNDARY_URL,
  }
}

/** In-memory coalescing and bounded cache. No organization records are stored. */
export async function getProductionRiskSnapshot():Promise<ProductionRiskSnapshot>{
  if(cache&&cache.expires>Date.now())return cache.data
  if(pending)return pending
  pending=loadProductionRisks()
  try{
    const response=await pending
    cache={expires:Date.now()+TTL_MS,data:response}
    return response
  }finally{pending=null}
}
