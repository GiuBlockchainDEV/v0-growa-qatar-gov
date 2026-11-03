/**
 * Official IPC/CH country-level acute food insecurity assessment feed.
 *
 * The IPC simplified country endpoint returns CSV (format=csv) and needs an
 * individually issued API key. It is not a keyless global crisis database.
 * https://docs.api.ipcinfo.org / https://www.ipcinfo.org/ipc-country-analysis/api/
 *
 * Source rows are country-level population estimates, not country-wide phase
 * classifications or geolocated crisis events. Some latest assessments expire.
 */
type Obj=Record<string,unknown>
const obj=(v:unknown):Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{}
const num=(v:unknown):number|null=>{
  const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v.replace(/,/g,'')):NaN
  return Number.isFinite(n)?n:null
}
const str=(v:unknown,max=160)=>typeof v==='string'?v.trim().slice(0,max):''
const value=(row:Obj,names:string[])=>{
  for(const name of names)if(row[name]!==undefined&&row[name]!==null&&row[name]!=='')
    return row[name]
  return null
}
export type IpcCountryRisk={
  id:string
  countryCode:string
  country:string
  period:'current'|'projected'|'second projection'
  from:string
  to:string
  phase3Plus:number
  share3Plus:number|null
  phase4:number|null
  phase5:number|null
  populationAnalysed:number|null
  sourceUrl:string
}
export type IpcRiskSnapshot={
  source:'IPC/CH acute food insecurity'
  state:'available'|'partial'|'unconfigured'|'unavailable'
  checkedAt:string
  risks:IpcCountryRisk[]
  countryCount:number
  detail:string
  sourceUrl:string
}
const SOURCE_URL='https://www.ipcinfo.org/ipcinfo-website/ipc-dashboard/'
const KEY_REQUEST_URL='https://www.ipcinfo.org/ipc-country-analysis/api/'

function displayCountry(code:string):string{
  try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code)??code}
  catch{return code}
}
/** Parse RFC4180-style CSV with quoted commas, escaped quotes and newlines. */
export function parseIpcCsv(csv:string):Obj[]{
  const input=csv.replace(/^\uFEFF/,'')
  if(!input.trim()||input.length>4000000)throw Error('Invalid IPC CSV size')
  const rows:string[][]=[],row:string[]=[]
  let cell='',quoted=false
  for(let i=0;i<input.length;i++){
    const c=input[i]
    if(c==='"'){
      if(quoted&&input[i+1]==='"'){cell+='"';i++}
      else if(quoted){quoted=false}
      else if(!cell.length){quoted=true}
      else throw Error('Malformed IPC CSV quote')
    }else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&input[i+1]==='\n')i++
      row.push(cell);cell=''
      if(row.some(v=>v.trim().length))rows.push(row.splice(0))
    }else cell+=c
    if(rows.length>4000)throw Error('Too many IPC CSV rows')
  }
  if(quoted)throw Error('Unclosed IPC CSV field')
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  const headers=rows.shift()?.map(h=>h.trim())??[]
  if(!headers.includes('country')||!headers.includes('from')||
    !headers.includes('to'))throw Error('Unexpected IPC CSV columns')
  if(!headers.some(h=>['phase3_worse_population','p3plus','phase3_population']
    .includes(h)))throw Error('Missing IPC Phase 3+ population column')
  return rows.slice(0,2500).map(values=>
    Object.fromEntries(headers.map((header,i)=>[header,values[i]??''])))
}
/** IPC returns from/to as e.g. "Sep 2026", not always ISO full dates. */
export function ipcPeriodDate(raw:unknown,end=false):string|null{
  const input=str(raw,35)
  if(!input)return null
  const month=/^([A-Za-z]{3,9})\s+(\d{4})$/.exec(input)
  if(month){
    const parsed=Date.parse(month[1]+' 1, '+month[2]+' UTC')
    if(!Number.isFinite(parsed))return null
    const d=new Date(parsed)
    if(end)d.setUTCMonth(d.getUTCMonth()+1,0)
    return d.toISOString().slice(0,10)
  }
  const iso=/^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(input)
  if(iso){
    const year=Number(iso[1]),m=Number(iso[2]),day=iso[3]?Number(iso[3]):1
    const parsed=Date.UTC(year,m-1,day)
    const d=new Date(parsed)
    if(d.getUTCFullYear()!==year||d.getUTCMonth()!==m-1||d.getUTCDate()!==day)return null
    if(end&&!iso[3])d.setUTCMonth(d.getUTCMonth()+1,0)
    return d.toISOString().slice(0,10)
  }
  return null
}
export function parseIpcCountryRisks(raw:unknown,now=Date.now()):IpcCountryRisk[]{
  if(!Array.isArray(raw))throw Error('Unexpected IPC country data')
  const risks:IpcCountryRisk[]=[]
  const seen=new Set<string>()
  for(const record of raw.slice(0,2500)){
    const row=obj(record)
    const country=str(row.country,2).toUpperCase(),period=str(row.period,1).toUpperCase()
    const from=ipcPeriodDate(row.from),to=ipcPeriodDate(row.to,true)
    const directCount=num(value(row,['phase3_worse_population','p3plus','phase3plus_population']))
    const phase3=num(row.phase3_population),phase4=num(row.phase4_population),
      phase5=num(row.phase5_population)
    const count=directCount??(phase3!==null&&phase4!==null
      ?phase3+phase4+(phase5??0):null)
    const shareRaw=num(value(row,['phase3_worse_percentage','p3plus_percentage']))
    const share=shareRaw!==null&&shareRaw>=0&&shareRaw<=100
      ?(shareRaw>1?shareRaw/100:shareRaw):null
    const toMs=to?Date.parse(to):NaN,fromMs=from?Date.parse(from):NaN
    if(!/^[A-Z]{2}$/.test(country)||!['C','P','A'].includes(period)||
      !Number.isFinite(toMs)||!Number.isFinite(fromMs)||toMs<fromMs||
      fromMs>now+400*86400000||count===null||!Number.isInteger(count)||
      count<0)continue
    const key=[country,period,from,to].join(':')
    if(seen.has(key))continue
    seen.add(key)
    let phases:Obj[]=[]
    if(Array.isArray(row.phases))phases=row.phases.map(obj)
    else if(typeof row.phases==='string'){
      try{
        const parsed=JSON.parse(row.phases)
        if(Array.isArray(parsed))phases=parsed.map(obj)
      }catch{ /* optional phase details; retain reported total */ }
    }
    const pop=(phase:number)=>{
      const direct=num(row['phase'+phase+'_population'])
      if(direct!==null&&Number.isInteger(direct)&&direct>=0)return direct
      const entry=phases.find(p=>num(p.phase)===phase)
      const n=num(value(entry??{},['population','num']))
      return n!==null&&Number.isInteger(n)&&n>=0?n:null
    }
    risks.push({
      id:'ipc:'+key,countryCode:country,country:displayCountry(country),
      period:period==='C'?'current':period==='P'?'projected':'second projection',
      from:from!,to:to!,phase3Plus:count,share3Plus:share,
      phase4:pop(4),phase5:pop(5),
      populationAnalysed:num(row.estimated_population),
      sourceUrl:SOURCE_URL,
    })
  }
  // The latest published assessment can be expired. Retain it with its real
  // dates instead of falsely declaring a country safe or discarding its record.
  return risks.sort((a,b)=>Number(a.period!=='current')-Number(b.period!=='current')||
    b.phase3Plus-a.phase3Plus||a.country.localeCompare(b.country)).slice(0,300)
}
let cache:{expires:number;data:IpcRiskSnapshot}|null=null
let pending:Promise<IpcRiskSnapshot>|null=null
function snapshot(state:IpcRiskSnapshot['state'],detail:string,risks:IpcCountryRisk[]=[]):IpcRiskSnapshot{
  return {source:'IPC/CH acute food insecurity',state,
    checkedAt:new Date().toISOString(),risks,
    countryCount:new Set(risks.map(r=>r.countryCode)).size,
    detail,sourceUrl:SOURCE_URL}
}
export async function getIpcRiskSnapshot():Promise<IpcRiskSnapshot>{
  // Official IPC-CH terms require an authorised API key. Never send
  // unauthenticated requests and mistake the 401 response for no countries.
  const key=process.env.WATCHTOWER_IPC_API_KEY?.trim()||process.env.IPC_API_KEY?.trim()
  if(!key)return snapshot('unconfigured',
    'IPC API key required. Request access at '+KEY_REQUEST_URL+
    ' and configure WATCHTOWER_IPC_API_KEY in Vercel. No country count is inferred.')
  if(cache&&cache.expires>Date.now())return cache.data
  if(pending)return pending
  pending=(async()=>{
    const url=new URL('https://api.ipcinfo.org/country')
    url.searchParams.set('type','A')
    url.searchParams.set('format','csv')
    url.searchParams.set('key',key)
    let data:IpcRiskSnapshot
    try{
      const response=await fetch(url.toString(),{
        headers:{Accept:'text/csv'},
        signal:AbortSignal.timeout(11500),next:{revalidate:1800},
      })
      if(!response.ok)throw Error(
        response.status===401||response.status===403?
          'IPC API key rejected or not authorised (HTTP '+response.status+')':
          'IPC country endpoint HTTP '+response.status)
      const declared=Number(response.headers.get('content-length')??0)
      if(declared>4000000)throw Error('IPC CSV too large')
      const body=await response.text()
      if(body.length>4000000)throw Error('IPC CSV too large')
      const risks=parseIpcCountryRisks(parseIpcCsv(body))
      data=risks.length
        ?snapshot('available','Official IPC/CH country rows with reported Phase 3+ populations and source validity dates. Only assessed countries, including latest analyses that may have expired.',risks)
        :snapshot('partial','IPC returned CSV but no usable country-level population rows. Check response columns and access permissions.')
    }catch(error){
      const reason=error instanceof Error?error.message:'IPC source unavailable'
      data=snapshot('unavailable',reason.slice(0,140)+
        '. Count cannot be verified; do not report zero assessed countries.')
    }
    cache={data,expires:Date.now()+(data.state==='unavailable'?120000:20*60000)}
    return data
  })()
  try{return await pending}finally{pending=null}
}
