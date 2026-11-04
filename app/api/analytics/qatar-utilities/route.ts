import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {UTILITY_DATASETS,parseUtilityDataset,datasetUrl,
 type UtilityDomain,type UtilitySnapshot,type UtilitySource,type UtilitySeries,
} from '@/lib/analytics/qatar-utilities'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=35
const base='https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/'
const cache=new Map<UtilityDomain,{until:number;data:UtilitySnapshot}>()
const pending=new Map<UtilityDomain,Promise<UtilitySnapshot>>()
async function fetchSource(spec:typeof UTILITY_DATASETS[UtilityDomain][number]){
 let records:unknown[]=[]
 try{
  for(let offset=0;offset<500;offset+=100){
   const url=base+encodeURIComponent(spec.dataset)+'/records?limit=100&offset='+offset
   const response=await fetch(url,{cache:'no-store',
    signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}})
   if(!response.ok)throw Error('HTTP '+response.status)
   const raw=await response.text()
   if(raw.length>3000000)throw Error('Oversized source response')
   const json=JSON.parse(raw) as {results?:unknown[];total_count?:number}
   if(!Array.isArray(json.results))throw Error('Unexpected schema')
   records.push(...json.results)
   if(json.results.length<100||offset+100>=(json.total_count??Infinity))break
  }
  const series=parseUtilityDataset(spec,{results:records})
  const years=series.flatMap(s=>s.points.map(p=>p.year))
  const source:UtilitySource={id:spec.id,label:spec.label,url:datasetUrl(spec.dataset),
   status:series.length?'available':'empty',
   latestYear:years.length?Math.max(...years):null,count:records.length,
   note:series.length?'Published annual records with metric units preserved':
    'Source reached, but no compatible numeric fields returned'}
  return {series,source}
 }catch(error){
  const source:UtilitySource={id:spec.id,label:spec.label,url:datasetUrl(spec.dataset),
   status:'unavailable',latestYear:null,count:0,
   note:error instanceof Error?error.message:'Source unavailable'}
  return {series:[] as UtilitySeries[],source}
 }
}
async function load(domain:UtilityDomain):Promise<UtilitySnapshot>{
 const results=await Promise.all(UTILITY_DATASETS[domain].map(fetchSource))
 return {domain,scope:'qatar-national',generatedAt:new Date().toISOString(),
  sources:results.map(r=>r.source),series:results.flatMap(r=>r.series)}
}
export async function GET(request:Request){
 const domain=new URL(request.url).searchParams.get('domain')
 if(domain!=='water'&&domain!=='energy')
  return NextResponse.json({error:'Choose water or energy'},{status:400})
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401})
 const existing=cache.get(domain)
 if(existing&&existing.until>Date.now())
  return NextResponse.json(existing.data,{headers:{'Cache-Control':'private, max-age=120'}})
 let req=pending.get(domain)
 if(!req){req=load(domain);pending.set(domain,req)}
 try{
  const data=await req
  const all=data.sources.every(s=>s.status==='available')
  cache.set(domain,{data,until:Date.now()+(all?3600000:300000)})
  return NextResponse.json(data,{headers:{'Cache-Control':'private, max-age=120'}})
 }catch(error){
  console.error('[National Utilities]',domain,error)
  return NextResponse.json({error:'National utility records unavailable'},{status:503})
 }finally{if(pending.get(domain)===req)pending.delete(domain)}
}
