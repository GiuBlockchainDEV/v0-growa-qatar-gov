/**
 * NASA FIRMS near-real-time satellite thermal detections for the food security
 * corridor. Detections are NOT confirmed wildfires or fire perimeters.
 * Server-side MAP_KEY only. Provider responses are bounded and cached.
 */
export type FirmsDetection = {
  id:string; lat:number; lon:number; observedAt:string; source:string;
  confidence:string; frp:number|null
}
export type FirmsSnapshot = {
  source:'NASA FIRMS'; state:'partial'|'unavailable'|'unconfigured';
  checkedAt:string; latestObservedAt:string|null; total:number;
  detections:FirmsDetection[]; detail:string; coverage:string
}
const SOURCES=['VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','VIIRS_SNPP_NRT'] as const
// Food-security routes and agricultural producing countries from East Africa
// through the Gulf, Red Sea and South Asia. Not worldwide fire coverage.
const BBOX='25,0,85,46'
const MAX_BYTES=5_000_000
const CACHE_MS=15*60_000
let cached:{until:number;data:FirmsSnapshot}|null=null
let pending:Promise<FirmsSnapshot>|null=null
const valid=(n:number)=>Number.isFinite(n)
export function parseFirmsCsv(csv:string,source:string,now=Date.now()):FirmsDetection[]{
  const lines=csv.replace(/\r/g,'').split('\n')
  const headers=(lines.shift()??'').replace(/^\uFEFF/,'').split(',').map(s=>s.trim().toLowerCase())
  const ix=(key:string)=>headers.indexOf(key)
  if(ix('latitude')<0||ix('longitude')<0||ix('acq_date')<0||ix('acq_time')<0)
    throw Error('Unexpected FIRMS CSV')
  const out:FirmsDetection[]=[]
  for(const row of lines.slice(0,65000)){
    if(!row||row.length>2000)continue
    const v=row.split(',')
    const lat=Number(v[ix('latitude')]),lon=Number(v[ix('longitude')])
    if(!valid(lat)||!valid(lon)||Math.abs(lat)>85||Math.abs(lon)>180)continue
    const day=v[ix('acq_date')]?.trim()??''
    const clock=(v[ix('acq_time')]??'').trim().padStart(4,'0')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{4}$/.test(clock))continue
    const t=Date.parse(day+'T'+clock.slice(0,2)+':'+clock.slice(2)+':00Z')
    if(!valid(t)||t>now+3600000||now-t>48*3600000)continue
    const n=ix('frp')>=0?Number(v[ix('frp')]):NaN
    const frp=valid(n)&&n>=0&&n<100000?n:null
    const confidence=ix('confidence')>=0?(v[ix('confidence')]??'').trim().slice(0,16):''
    out.push({id:[source,day,clock,lat.toFixed(4),lon.toFixed(4)].join(':'),
      lat,lon,observedAt:new Date(t).toISOString(),
      source,confidence,frp})
  }
  return out
}
async function fetchSource(source:string,key:string):Promise<FirmsDetection[]>{
  const endpoint='https://firms.modaps.eosdis.nasa.gov/api/area/csv/'+
    encodeURIComponent(key)+'/'+source+'/'+BBOX+'/1'
  // Never log the URL. It contains the secret MAP_KEY.
  const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw Error('FIRMS provider HTTP '+response.status)
  if(Number(response.headers.get('content-length')??0)>MAX_BYTES)throw Error('FIRMS response oversized')
  const body=await response.text()
  if(body.length>MAX_BYTES)throw Error('FIRMS response oversized')
  return parseFirmsCsv(body,source)
}
export async function getFirmsSnapshot():Promise<FirmsSnapshot>{
  const checkedAt=new Date().toISOString(),coverage='25°E–85°E, 0°N–46°N'
  const key=(process.env.NASA_FIRMS_MAP_KEY??process.env.FIRMS_MAP_KEY??'').trim()
  if(!key)return {source:'NASA FIRMS',state:'unconfigured',checkedAt,
    latestObservedAt:null,total:0,detections:[],coverage,
    detail:'NASA FIRMS MAP_KEY not configured. No fire observations are inferred.'}
  if(cached&&cached.until>Date.now())return cached.data
  if(pending)return pending
  pending=(async()=>{
    const results=await Promise.allSettled(SOURCES.map(source=>fetchSource(source,key)))
    const success=results.filter((r):r is PromiseFulfilledResult<FirmsDetection[]>=>r.status==='fulfilled')
    const all=success.flatMap(r=>r.value)
    const data:FirmsSnapshot={
      source:'NASA FIRMS',state:success.length?'partial':'unavailable',checkedAt,
      latestObservedAt:all.reduce<string|null>((acc,row)=>!acc||row.observedAt>acc?row.observedAt:acc,null),
      total:all.length,
      detections:all.sort((a,b)=>(b.frp??0)-(a.frp??0)||b.observedAt.localeCompare(a.observedAt)).slice(0,900),
      coverage,detail:success.length?
        success.length+'/'+SOURCES.length+' VIIRS sensors responded; displaying up to 900 thermal detections. These are satellite detections, not verified fires or affected farmland.':
        'NASA FIRMS unavailable or timed out. No hot spots are synthesized.',
    }
    cached={data,until:Date.now()+(success.length?CACHE_MS:3*60_000)}
    return data
  })()
  try{return await pending}finally{pending=null}
}
