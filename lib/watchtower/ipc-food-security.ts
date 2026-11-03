/**
 * Country-level IPC/CH acute food insecurity intelligence.
 * Actual classified populations and validity dates only, no country-centre
 * map pins masquerading as local incidents or ad-hoc severity scores.
 *
 * API docs: https://docs.api.ipcinfo.org/
 * Public category: GET https://api.ipcinfo.org/country?type=A&format=json
 * Returned regions are the assessed countries, NOT all world countries.
 */
type Obj=Record<string,unknown>
const obj=(v:unknown):Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{}
const num=(v:unknown):number|null=>{
  const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN
  return Number.isFinite(n)?n:null
}
const str=(v:unknown,max=140)=>typeof v==='string'?v.trim().slice(0,max):''
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
  state:'available'|'partial'|'unavailable'
  checkedAt:string
  risks:IpcCountryRisk[]
  countryCount:number
  detail:string
  sourceUrl:string
}
function displayCountry(code:string):string{
  try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code)??code}
  catch{return code}
}
export function parseIpcCountryRisks(raw:unknown,now=Date.now()):IpcCountryRisk[]{
  // IPC country-level public response is a flat list. Refuse unexpected
  // schemas instead of inventing severity or geolocation.
  if(!Array.isArray(raw))throw Error('Unexpected IPC country data')
  const risks:IpcCountryRisk[]=[]
  const seen=new Set<string>()
  for(const value of raw.slice(0,2500)){
    const row=obj(value)
    const country=str(row.country,2).toUpperCase()
    const period=str(row.period,1)
    const from=str(row.from,30),to=str(row.to,30)
    const count=num(row.phase3_worse_population)
    const share=num(row.phase3_worse_percentage)
    const toMs=Date.parse(to),fromMs=Date.parse(from)
    if(!/^[A-Z]{2}$/.test(country)||!['C','P','A'].includes(period)||
      !Number.isFinite(toMs)||!Number.isFinite(fromMs)||
      fromMs>now+400*86400000||toMs<now-90*86400000||
      count===null||!Number.isInteger(count)||count<0)continue
    const key=[country,period,from,to].join(':')
    if(seen.has(key))continue
    seen.add(key)
    const phases=Array.isArray(row.phases)?row.phases.map(obj):[]
    const pop=(phase:number)=>{
      const entry=phases.find(p=>num(p.phase)===phase)
      const n=num(entry?.population)
      return n!==null&&Number.isInteger(n)&&n>=0?n:null
    }
    const periodLabel=period==='C'?'current':period==='P'?'projected':'second projection'
    risks.push({
      id:'ipc:'+key,countryCode:country,country:displayCountry(country),
      period:periodLabel,from,to,
      phase3Plus:count,
      share3Plus:share!==null&&share>=0&&share<=1?share:null,
      phase4:pop(4),phase5:pop(5),
      populationAnalysed:num(row.estimated_population),
      sourceUrl:'https://www.ipcinfo.org/ipcinfo-website/ipc-dashboard/',
    })
  }
  return risks.sort((a,b)=>Number(a.period!=='current')-Number(b.period!=='current')||
    b.phase3Plus-a.phase3Plus||a.country.localeCompare(b.country)).slice(0,300)
}
let cache:{expires:number;data:IpcRiskSnapshot}|null=null
let pending:Promise<IpcRiskSnapshot>|null=null
export async function getIpcRiskSnapshot():Promise<IpcRiskSnapshot>{
  if(cache&&cache.expires>Date.now())return cache.data
  if(pending)return pending
  pending=(async()=>{
    const checkedAt=new Date().toISOString()
    const url=new URL('https://api.ipcinfo.org/country')
    url.searchParams.set('type','A')
    url.searchParams.set('format','json')
    const key=process.env.WATCHTOWER_IPC_API_KEY?.trim()
    if(key)url.searchParams.set('key',key)
    const sourceUrl='https://www.ipcinfo.org/ipcinfo-website/ipc-dashboard/'
    let data:IpcRiskSnapshot
    try{
      const response=await fetch(url.toString(),{
        headers:{Accept:'application/json'},signal:AbortSignal.timeout(11500),
        next:{revalidate:1800},
      })
      if(!response.ok)throw Error('IPC HTTP '+response.status)
      const size=Number(response.headers.get('content-length')??0)
      if(size>3200000)throw Error('IPC response too large')
      const body=await response.text()
      if(body.length>3200000)throw Error('IPC response too large')
      const risks=parseIpcCountryRisks(JSON.parse(body) as unknown)
      data={
        source:'IPC/CH acute food insecurity',state:risks.length?'available':'partial',
        checkedAt,risks,countryCount:new Set(risks.map(r=>r.countryCode)).size,
        sourceUrl,
        detail:risks.length?
          'IPC/CH assessed-country population estimates and validity periods, not real-time incident locations; source coverage is not worldwide.':
          'No valid acute food insecurity country rows supplied. This is not evidence of worldwide food security.',
      }
    }catch(error){
      const reason=error instanceof Error?error.message:'IPC source unavailable'
      data={source:'IPC/CH acute food insecurity',state:'unavailable',
        checkedAt,risks:[],countryCount:0,sourceUrl,
        detail:reason.slice(0,100)+'. Public IPC access may require an approved API key; no classification is fabricated.',
      }
    }
    cache={data,expires:Date.now()+(data.state==='unavailable'?120000:20*60000)}
    return data
  })()
  try{return await pending}finally{pending=null}
}
