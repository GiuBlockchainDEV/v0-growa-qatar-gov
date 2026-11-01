/**
 * Recent *reported* regional hazards near the origin gateway or Qatar.
 * GDACS alert footprints/epicentres are NOT proof of road/sea/air disruptions.
 * Absence of nearby events does not establish that a corridor is safe.
 * Source: https://www.gdacs.org/gdacsapi/swagger/index.html
 */
import {getExportHub,haversineKm,QATAR_PORT,type GeoPoint} from './logistics-lanes'
type Obj=Record<string,unknown>
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{}
const str=(v:unknown)=>typeof v==='string'?v:''
export type RegionalHazard={
  id:string;type:string;severity:'red'|'orange'
  near:'origin'|'qatar';distanceKm:number;label:string
  source:'GDACS';sourceUrl:string
}
export type HazardCoverage={state:'available'|'unavailable';alerts:RegionalHazard[];
  sourceUrl:string;observedAt:string}
function numeric(v:unknown):number|null{
  const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
  return Number.isFinite(n)?n:null
}
export function parseGdacsRegionalEvents(raw:unknown,country:string):RegionalHazard[]{
  const hub=getExportHub(country)
  if(!hub)return []
  const doc=obj(raw),features=doc.features
  if(!Array.isArray(features))throw Error('Invalid GDACS GeoJSON response')
  const output:RegionalHazard[]=[],seen=new Set<string>()
  for(const f of features.slice(0,100)){
    const item=obj(f),p=obj(item.properties),g=obj(item.geometry)
    const severity=str(p.alertlevel??p.alertLevel).toLowerCase()
    if(severity!=='orange'&&severity!=='red')continue
    const coordinates=g.coordinates
    if(g.type!=='Point'||!Array.isArray(coordinates))continue
    const lon=numeric(coordinates[0]),lat=numeric(coordinates[1])
    if(lon===null||lat===null||Math.abs(lon)>180||Math.abs(lat)>90)continue
    const point:GeoPoint={lat,lon}
    const originDist=haversineKm(point,hub.sea),qatDist=haversineKm(point,QATAR_PORT)
    const closest=originDist<=qatDist?'origin':'qatar'
    const d=Math.min(originDist,qatDist)
    if(d>400)continue
    const type=str(p.eventtype??p.eventType) || 'GDACS event'
    const rawId=p.eventid??p.eventId??item.id
    const id=typeof rawId==='number'&&Number.isSafeInteger(rawId)?String(rawId):str(rawId)
    const key=type+':'+id+':'+closest
    if(seen.has(key))continue
    seen.add(key)
    const cleanId=id.replace(/[^0-9A-Za-z_-]/g,'').slice(0,45)
    output.push({
      id:key,type,severity,near:closest,distanceKm:Math.round(d),
      label:type+' '+severity+' alert near '+(closest==='origin'?'origin gateway':'Qatar')+
        ' ('+Math.round(d)+' km, event centroid/point only)',
      source:'GDACS',
      sourceUrl:cleanId?
        'https://www.gdacs.org/report.aspx?eventid='+encodeURIComponent(cleanId)+
          '&eventtype='+encodeURIComponent(type):
        'https://www.gdacs.org/',
    })
    if(output.length>=12)break
  }
  return output
}
export async function fetchGdacsRegionalEvents(country:string):Promise<HazardCoverage>{
  const now=new Date()
  const from=new Date(now.getTime()-21*86400000).toISOString().slice(0,10)
  const to=now.toISOString().slice(0,10)
  const u=new URL('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH')
  u.searchParams.set('eventlist','EQ;TC;FL;VO')
  u.searchParams.set('fromdate',from);u.searchParams.set('todate',to)
  u.searchParams.set('alertlevel','red;orange')
  const sourceUrl='https://www.gdacs.org/gdacsapi/swagger/index.html'
  try{
    const response=await fetch(u.toString(),{
      signal:AbortSignal.timeout(6500),next:{revalidate:3600},
      headers:{Accept:'application/json'},
    })
    if(!response.ok)throw Error('GDACS unavailable')
    const text=await response.text()
    if(text.length>650000)throw Error('GDACS response too large')
    const data=JSON.parse(text) as unknown
    return {state:'available',alerts:parseGdacsRegionalEvents(data,country),
      sourceUrl,observedAt:now.toISOString()}
  }catch{
    return {state:'unavailable',alerts:[],sourceUrl,observedAt:now.toISOString()}
  }
}
