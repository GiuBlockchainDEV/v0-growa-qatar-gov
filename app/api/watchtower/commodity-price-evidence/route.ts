import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {resolveCommodity} from '@/lib/platform/commodity-catalog'
import {getWits2024Snapshot} from '@/lib/nfii/wits-2024-prices'
import {comtradeOriginUrl,parseImportOriginYear,QAR_PER_USD,type YearObservation} from '@/lib/nfii/origin-price-model'
import {annualQatarImportPrices} from '@/lib/nfii/commodity-import-price-history'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=30
const reply=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'private, no-store, max-age=0'},
})
type PriceReport={
 commodity:string;historicalAnnual:ReturnType<typeof annualQatarImportPrices>
 originPrices:{countryCode:string;countryName:string;qarPerTonne:number;weightTonnes:number}[]
 sourceName:string;sourceUrls:string[];sourceYear:number|null
 productScope:string;dataKind:'annual_customs'|'origin_comparison'|'unavailable'
 notes:string[]
}
const cache=new Map<string,{until:number;result:PriceReport}>()
async function fetchYear(crop:string,year:number):Promise<YearObservation|null>{
 const url=comtradeOriginUrl(crop,year)
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(5500),
   headers:{Accept:'application/json'},next:{revalidate:21600}})
  if(!res.ok)return null
  const raw=await res.text()
  if(raw.length>2000000)return null
  return parseImportOriginYear(JSON.parse(raw) as unknown,crop,year,url)
 }catch{return null}
}
export async function GET(request:Request){
 const crop=new URL(request.url).searchParams.get('commodity')??''
 if(resolveCommodity(crop)?.id!==crop)return reply({error:'Unsupported commodity'},400)
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return reply({error:'Sign in to view import price evidence'},401)
 const existing=cache.get(crop)
 if(existing&&existing.until>Date.now())return reply(existing.result)
 const published=getWits2024Snapshot(crop)
 // One-year WITS evidence is available without network access to the
 // customs source; published partner observations remain independently labeled.
 const candidates=await Promise.all([2025,2024,2023].map(year=>fetchYear(crop,year)))
 const fetched=candidates.filter((x):x is YearObservation=>x!==null)
 const years=new Map(fetched.map(x=>[x.year,x]))
 if(published&&!years.has(2024))years.set(2024,published.observation)
 // If the live preview lacks a national world total, prefer the published
 // world row for that specific calendar year over a partial preview aggregate.
 if(published&&years.has(2024)&&!years.get(2024)?.worldTotal){
  const live=years.get(2024)!
  years.set(2024,{...live,worldTotal:published.observation.worldTotal,
   incompletePreview:true})
 }
 const historicalAnnual=annualQatarImportPrices([...years.values()],
  'UN Comtrade annual customs unit values')
 const comparison=published?.observation.partners.filter(
  p=>Number.isFinite(p.importValueUsd)&&Number.isFinite(p.importWeightKg)&&
   p.importWeightKg>=10000&&p.importValueUsd>=10000
 ).map(p=>({countryCode:p.countryCode,countryName:p.countryName,
  qarPerTonne:Math.round(p.importValueUsd*QAR_PER_USD/p.importWeightKg*1000),
  weightTonnes:Math.round(p.importWeightKg/1000)}))
  .sort((a,b)=>b.weightTonnes-a.weightTonnes).slice(0,8)??[]
 const originPrices=comparison
 const dataKind=historicalAnnual.length>=2?'annual_customs':
  originPrices.length>=2?'origin_comparison':
  historicalAnnual.length===1?'annual_customs':'unavailable'
 const result:PriceReport={commodity:crop,historicalAnnual,originPrices,
  sourceName:published?.sourceName??'UN Comtrade annual customs preview',
  sourceUrls:[...new Set([...fetched.map(y=>y.sourceUrl),
   ...(published?.sourceUrls??[])])],
  sourceYear:published?.year??historicalAnnual.at(-1)?.year??null,
  productScope:published?.productScope??crop,
  dataKind,notes:[
   'These are annual Qatar import unit values (declared import value divided by net weight), not live supplier prices.',
   'Customs values may already include freight, insurance or other CIF-like charges; do not add freight automatically.',
   'An annual origin comparison is not a historical time-series, and product grades and customs headings may differ.',
  ]}
 cache.set(crop,{until:Date.now()+21600000,result})
 return reply(result)
}
