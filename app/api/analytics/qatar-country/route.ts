import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {
 DATASET_URL,QATAR_DATASETS,WORLD_BANK_INDICATORS,
 parseQatarProduction,parseQatarFarms,QATAR_VERIFIED_SUFFICIENCY_2025,QATAR_VERIFIED_SUFFICIENCY_SOURCES,
 parseWorldBank,latestYear,type QatarCountrySnapshot,
 type SourceHealth,type IndicatorSeries,
} from '@/lib/analytics/qatar-country'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=45
const CACHE_MS=6*60*60*1000
let cached:{until:number;data:QatarCountrySnapshot}|null=null
let pending:Promise<QatarCountrySnapshot>|null=null
const header={'Cache-Control':'private, max-age=180'}
const HOST='https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/'
async function fetchJson(url:string,timeout=9000):Promise<unknown>{
 const response=await fetch(url,{cache:'no-store',
  headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(timeout)})
 if(!response.ok)throw Error('HTTP '+response.status)
 const body=await response.text()
 if(body.length>1800000)throw Error('Source response exceeds size limit')
 return JSON.parse(body) as unknown
}
async function publicDataset(
 key:keyof typeof QATAR_DATASETS,
 parser:(payload:unknown)=>{year:number}[],
){
 const url=DATASET_URL(key)
 const sourceUrl=HOST+QATAR_DATASETS[key]+'/records?limit=100&offset='
 let all:{year:number}[]=[]
 try{
  // Paginate instead of silently truncating the annual crops dataset.
  for(let offset=0;offset<2500;offset+=100){
   const response=await fetchJson(sourceUrl+offset,8500) as {results?:unknown[];total_count?:number}
   if(!response||!Array.isArray(response.results))throw Error('Invalid source pagination')
   const data=parser({results:response.results})
   all=[...all,...data]
   if(response.results.length<100||offset+100>=(response.total_count??Infinity))break
  }
  const status:SourceHealth={id:key,label:key==='production'?'Crop production':
   key==='farms'?'Registered farms':'Food self-sufficiency',status:'available',
   url,latestYear:latestYear(all),count:all.length,
   note:all.length?'National Planning Council / Qatar Open Data':'No compatible published observations'}
  return {rows:all,status}
 }catch(error){
  const status:SourceHealth={id:key,label:key==='production'?'Crop production':
   key==='farms'?'Registered farms':'Food self-sufficiency',status:'unavailable',
   url,latestYear:null,count:0,
   note:error instanceof Error?error.message:'Source not reachable'}
  return {rows:[],status}
 }
}
async function worldBank(){
 const indicators=Object.values(WORLD_BANK_INDICATORS)
 const settled=await Promise.allSettled(indicators.map(async def=>{
  const url='https://api.worldbank.org/v2/country/QAT/indicator/'+
   encodeURIComponent(def.code)+'?format=json&per_page=100'
  const data=await fetchJson(url,8000)
  return parseWorldBank(data)
 }))
 const byKey=new Map<string,IndicatorSeries>()
 settled.forEach(result=>{
  if(result.status==='fulfilled')result.value.forEach(series=>{
   if(series.history.length>0)byKey.set(series.key,series)
  })
 })
 const series=(Object.keys(WORLD_BANK_INDICATORS) as (keyof typeof WORLD_BANK_INDICATORS)[])
  .map(key=>byKey.get(key)??({
   key,...WORLD_BANK_INDICATORS[key],
   url:'https://data.worldbank.org/country/qatar',
   history:[],latest:null,
  } as IndicatorSeries))
 const status:SourceHealth={id:'world-bank',label:'World Bank indicators',
  status:series.some(s=>s.latest!==null)?'available':'unavailable',
  url:'https://data.worldbank.org/country/qatar',
  latestYear:latestYear(series.flatMap(s=>s.history)),count:series.reduce((n,s)=>n+s.history.length,0),
  note:'Publication years vary by indicator. Latest available observations only.'}
 return {rows:series,status}
}
async function collect():Promise<QatarCountrySnapshot>{
 const [production,farms,bank]=await Promise.all([
  publicDataset('production',parseQatarProduction),
  publicDataset('farms',parseQatarFarms),
  worldBank(),
 ])
 // The historic 2013-2023 agricultural-ratio field is incompatible with
 // verified 2025 ministerial reporting and produced misleading sub-1% values.
 // Never ingest that raw ratio for the national dashboard or AI context.
 // Use separately source-attributed 2025 Ministry of Municipality indicators.
 const sufficiency:{
  rows:typeof QATAR_VERIFIED_SUFFICIENCY_2025[number][]
  status:SourceHealth
 }={
  rows:[...QATAR_VERIFIED_SUFFICIENCY_2025],
  status:{id:'sufficiency',label:'Food self-sufficiency',status:'available',
   url:QATAR_VERIFIED_SUFFICIENCY_SOURCES.ministry,
   latestYear:2025,count:QATAR_VERIFIED_SUFFICIENCY_2025.length,
   note:'2025 Ministry of Municipality reported indicators (QNA / The Peninsula); not 2013-2023 raw dataset'},
 }
 return {generatedAt:new Date().toISOString(),
  production:production.rows as QatarCountrySnapshot['production'],
  farms:farms.rows as QatarCountrySnapshot['farms'],
  sufficiency:sufficiency.rows as QatarCountrySnapshot['sufficiency'],
  indicators:bank.rows,sources:[production.status,farms.status,sufficiency.status,bank.status]}
}
export async function GET(){
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Sign in to access country analytics'},{status:401})
 if(cached&&cached.until>Date.now())return NextResponse.json(cached.data,{headers:header})
 if(!pending)pending=collect()
 try{
  const data=await pending
  // Cache partial but correctly sourced responses briefly. Never fabricate
  // fallback figures from unrelated organization-scoped farm records.
  cached={data,until:Date.now()+(data.sources.every(s=>s.status==='available')?CACHE_MS:300000)}
  return NextResponse.json(data,{headers:header})
 }catch(error){
  console.error('[Qatar Country Analytics]',error)
  return NextResponse.json({error:'Country indicators temporarily unavailable'},{status:503})
 }finally{pending=null}
}
