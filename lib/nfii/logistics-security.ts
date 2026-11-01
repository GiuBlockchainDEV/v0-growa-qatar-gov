/**
 * Public, source-attributed regional security signals. These are NOT
 * NOTAMs, airline schedules, official closure confirmations or probabilities.
 * EASA: official active conflict-zone advisories (may apply to only part of FIR).
 * Hormuz: AIS-detected crossings (lower bounds under jamming) + UKMTO-derived incidents.
 * Always fail closed: missing, stale and unparsable evidence is NOT zero risk.
 */
import {WORLD_COUNTRIES} from './world-countries'

export type SourceState='available'|'stale'|'unavailable'
export type EasaNotice={id:string;title:string;countries:string[];
  validUntil:string;url:string;updatedAt:string|null}
export type AviationThreat={state:SourceState;checkedAt:string;
  notices:EasaNotice[];sourceUrl:string;closureStatus:'not_verified'}
export type IncidentSummary={date:string;kind:string;description:string}
export type MaritimeThreat={state:SourceState;checkedAt:string;lastPoll:string|null;
  crossings24h:number|null;crossings30d:number|null;trafficDropPct:number|null;
  incidentCount30d:number|null;attackCount30d:number|null;
  incidentPerCrossingPct:number|null;incidentsState:'available'|'unavailable';
  recentIncidents:IncidentSummary[];sourceUrl:string;incidentSourceUrl:string;
  closureStatus:'not_verified';attribution:string}
export type SecurityIntelligence={aviation:AviationThreat;maritime:MaritimeThreat}

type Obj=Record<string,unknown>
const asObj=(value:unknown):Obj=>value!==null&&typeof value==='object'&&
  !Array.isArray(value)?value as Obj:{}
const validText=(value:unknown)=>typeof value==='string'?value.trim():''
const finite=(value:unknown):number|null=>{
  const number=typeof value==='number'?value:
    typeof value==='string'&&value.trim()?Number(value):NaN
  return Number.isFinite(number)&&number>=0?number:null
}
const round=(n:number,d=0)=>Number(n.toFixed(d))
const readDate=(value:unknown):number|null=>{
  const raw=validText(value)
  if(!raw)return null
  const parsed=Date.parse(raw)
  return Number.isFinite(parsed)?parsed:null
}
const EASA_URL='https://www.easa.europa.eu/en/domains/air-operations/czibs/export-json?_format=json&page='
const EASA_PAGE='https://www.easa.europa.eu/en/domains/air-operations/czibs'
const HORMUZ_API='https://hormuz.data-tracking.net/api'
const HORMUZ_PAGE='https://hormuz.data-tracking.net/'
const UKMTO_URL='https://www.ukmto.org/recent-incidents'
const canonical=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim()
const aliases:Record<string,string>={
  'russian federation':'RU','russia':'RU','turkey':'TR','turkiye':'TR',
  'iran':'IR','united states':'US','united kingdom':'GB','south africa':'ZA',
  'czech republic':'CZ','palestine':'PS',
}
function isoCountry(name:string):string|null{
  const clean=canonical(name)
  const match=WORLD_COUNTRIES.find(row=>canonical(row.name)===clean)
  return match?.code??aliases[clean]??null
}
const until=(raw:unknown):number|null=>{
  const value=validText(raw)
  const parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if(!parts)return null
  const end=Date.UTC(Number(parts[3]),Number(parts[2])-1,Number(parts[1]),23,59,59)
  return Number.isFinite(end)?end:null
}
/** Reject expired, withdrawn and unmappable bulletins. EASA is not a NOTAM. */
export function parseActiveEasa(raw:unknown,now=Date.now()):EasaNotice[]{
  const doc=asObj(raw)
  if(!Array.isArray(doc.conflict_zones))throw Error('Invalid EASA JSON')
  return doc.conflict_zones.slice(0,120).flatMap((entry:unknown)=>{
    const row=asObj(entry)
    if(validText(row.status).toLowerCase()!=='active')return []
    const expiry=until(row.valid_until_date)
    if(expiry===null||expiry<now)return []
    const names=validText(row.country).split(',').map(s=>s.trim()).filter(Boolean)
    const countries=[...new Set(names.map(isoCountry).filter((v):v is string=>Boolean(v)))]
    if(!countries.length)return []
    const id=validText(row.Nid).replace(/[^0-9]/g,'')
    if(!id)return []
    return [{
      id,title:validText(row.name).slice(0,180),countries,
      validUntil:new Date(expiry).toISOString().slice(0,10),
      url:'https://www.easa.europa.eu/en/node/'+id,
      updatedAt:validText(row.updated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)?.[0]??null,
    }]
  })
}
function candidates(raw:unknown,keys:string[]):unknown[]|null{
  if(Array.isArray(raw))return raw
  const root=asObj(raw)
  for(const key of keys)if(Array.isArray(root[key]))return root[key] as unknown[]
  const nested=asObj(root.data)
  for(const key of keys)if(Array.isArray(nested[key]))return nested[key] as unknown[]
  return null
}
function incidentDate(item:Obj):number|null{
  for(const key of ['date','incident_date','report_date','reported_at',
    'datetime','timestamp','created_at','occurred_at','time']){
    const value=item[key]
    if(typeof value==='number'&&value>1000000000)
      return value<10000000000?value*1000:value
    const stamp=readDate(value)
    if(stamp!==null)return stamp
  }
  return null
}
function isHormuz(item:Obj):boolean{
  const location=[item.location,item.area,item.region,item.title,item.description,
    item.summary,item.details,item.text].map(validText).join(' ').toLowerCase()
  if(/hormuz|khasab|lavan island|bandar abbas|kumzar/.test(location))return true
  const geometry=asObj(item.geometry)
  const coords=geometry.coordinates
  const lon=finite(item.longitude??item.lon??(Array.isArray(coords)?coords[0]:null))
  const lat=finite(item.latitude??item.lat??(Array.isArray(coords)?coords[1]:null))
  return lon!==null&&lat!==null&&lat>=25.2&&lat<=28.1&&lon>=55.7&&lon<=57.6
}
/** Only incidents explicitly located in/near Hormuz are counted. */
export function parseHormuzIncidents(raw:unknown,now=Date.now()):{
  count:number;attacks:number;recent:IncidentSummary[]
}{
  const items=candidates(raw,['incidents','reports','events','items'])
  if(!items)throw Error('Invalid UKMTO incidents feed')
  const relevant:IncidentSummary[]=[]
  const cutoff=now-30*86400000
  for(const value of items.slice(0,1500)){
    const item=asObj(value),date=incidentDate(item)
    if(date===null||date<cutoff||date>now+86400000||!isHormuz(item))continue
    const kind=validText(item.type??item.kind??item.category??item.incident_type)
    const description=validText(item.description??item.summary??item.title??item.text)
    relevant.push({
      date:new Date(date).toISOString().slice(0,10),
      kind:kind.slice(0,80)||'Unclassified UKMTO report',
      description:description.slice(0,240),
    })
  }
  relevant.sort((a,b)=>b.date.localeCompare(a.date))
  return {count:relevant.length,attacks:relevant.filter(x=>
    /attack|strike|missile|projectile|uav/i.test(x.kind+' '+x.description)).length,
    recent:relevant.slice(0,4)}
}
export function parseHormuzSummaries(raw24:unknown,raw30:unknown,now=Date.now()):{
  crossings24h:number;crossings30d:number;lastPoll:string|null;
  stale:boolean;trafficDropPct:number|null
}{
  const day=asObj(raw24),month=asObj(raw30)
  const short=finite(day.total_crossings)
  const long=finite(month.total_crossings)
  if(short===null||long===null)throw Error('Missing AIS crossing counts')
  const poll=readDate(day.last_poll)
  const stale=poll===null||poll>now+3600000||now-poll>2*3600000
  const valid30=long>=short&&long>0
  const rate=valid30&&!stale?Math.max(0,Math.min(100,
    round((1-short/(long/30))*100))):null
  return {crossings24h:short,crossings30d:long,
    lastPoll:poll===null?null:new Date(poll).toISOString(),
    stale,trafficDropPct:rate}
}
async function fetchJson(url:string):Promise<unknown>{
  const response=await fetch(url,{headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(6500),next:{revalidate:1800}})
  if(!response.ok)throw Error('Provider HTTP '+response.status)
  const raw=await response.text()
  if(raw.length>700000)throw Error('Oversized provider response')
  return JSON.parse(raw) as unknown
}
export async function fetchAviationThreat(now=Date.now()):Promise<AviationThreat>{
  const checkedAt=new Date(now).toISOString()
  try{
    const notices=parseActiveEasa(await fetchJson(EASA_URL),now)
    return {state:'available',checkedAt,notices,sourceUrl:EASA_PAGE,
      closureStatus:'not_verified'}
  }catch{
    return {state:'unavailable',checkedAt,notices:[],sourceUrl:EASA_PAGE,
      closureStatus:'not_verified'}
  }
}
export async function fetchMaritimeThreat(now=Date.now()):Promise<MaritimeThreat>{
  const checkedAt=new Date(now).toISOString()
  const common={checkedAt,sourceUrl:HORMUZ_PAGE,incidentSourceUrl:UKMTO_URL,
    closureStatus:'not_verified' as const,
    attribution:'AIS: hormuz.data-tracking.net (CC BY 4.0); incidents: UKMTO (OGL)'}
  const [day,month,reports]=await Promise.allSettled([
    fetchJson(HORMUZ_API+'/summary?hours=24'),
    fetchJson(HORMUZ_API+'/summary?hours=720'),
    fetchJson(HORMUZ_API+'/incidents'),
  ])
  let state:SourceState='unavailable',lastPoll:string|null=null
  let crossings24h:number|null=null,crossings30d:number|null=null
  let trafficDropPct:number|null=null
  if(day.status==='fulfilled'&&month.status==='fulfilled'){
    try{
      const s=parseHormuzSummaries(day.value,month.value,now)
      state=s.stale?'stale':'available'
      lastPoll=s.lastPoll;crossings24h=s.crossings24h
      crossings30d=s.crossings30d;trafficDropPct=s.trafficDropPct
    }catch{/* no fabricated traffic from an unexpected schema */}
  }
  let incidentsState:'available'|'unavailable'='unavailable'
  let incidentCount30d:number|null=null,attackCount30d:number|null=null
  let recentIncidents:IncidentSummary[]=[]
  if(reports.status==='fulfilled'){
    try{
      const p=parseHormuzIncidents(reports.value,now)
      incidentsState='available';incidentCount30d=p.count
      attackCount30d=p.attacks;recentIncidents=p.recent
    }catch{/* don't report an API parse failure as zero incidents */}
  }
  const incidentPerCrossingPct=incidentCount30d!==null&&crossings30d!==null&&
    crossings30d>0?round(incidentCount30d/crossings30d*100,2):null
  return {...common,state,lastPoll,crossings24h,crossings30d,
    trafficDropPct,incidentCount30d,attackCount30d,
    incidentPerCrossingPct,incidentsState,recentIncidents}
}
export async function collectSecurityIntelligence(now=Date.now()):
  Promise<SecurityIntelligence>{
  const [aviation,maritime]=await Promise.all([
    fetchAviationThreat(now),fetchMaritimeThreat(now)])
  return {aviation,maritime}
}
