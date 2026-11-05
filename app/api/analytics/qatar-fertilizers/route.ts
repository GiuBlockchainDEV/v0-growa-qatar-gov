import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {
 FERTILIZER_PRODUCTS,QAFCO_REPORT_URL,
 parseFertilizerTrade,type FertilizerSnapshot,type FertilizerTrade,
} from '@/lib/analytics/qatar-fertilizer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=25
const TRADE_API='https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/trade-data-for-fertilizers/records?limit=100'
const TRADE_CACHE_MS=4*60*60*1000
let cached:{until:number;payload:FertilizerSnapshot}|null=null
let pending:Promise<FertilizerSnapshot>|null=null

async function build():Promise<FertilizerSnapshot>{
 let trade:FertilizerTrade[]=[]
 let tradeStatus:FertilizerSnapshot['tradeStatus']='unavailable'
 let tradeDetail='Official trade series could not be fetched.'
 try{
  const response=await fetch(TRADE_API,{
   headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(10_000),
   next:{revalidate:TRADE_CACHE_MS/1000},
  })
  if(!response.ok)throw Error('HTTP '+response.status)
  const text=await response.text()
  if(text.length>2_000_000)throw Error('Oversized trade response')
  const result=JSON.parse(text) as unknown
  trade=parseFertilizerTrade(result)
  tradeStatus=trade.length?'available':'empty'
  tradeDetail=trade.length?
   'Qatar Ministry of Commerce and Industry: annual trade VALUE in QAR, last published record '+trade.at(-1)!.year+'. Not inventory tonnage or current supply.':
   'Official dataset reachable but returned no compatible records.'
 }catch(error){
  tradeDetail='Qatar annual trade feed unavailable: '+
   (error instanceof Error?error.message:'source error')+
   '. No values have been manufactured.'
 }
 return {
  scope:'qatar-national-fertilizers',asOf:'2026-10',
  generatedAt:new Date().toISOString(),benchmarkPeriod:'2026-10',
  benchmarks:FERTILIZER_PRODUCTS,trade,tradeStatus,tradeDetail,
  production:{
   producer:'QAFCO',product:'Urea',capacityTonnesPerYear:5_600_000,
   sourceYear:2026,sourceUrl:QAFCO_REPORT_URL,
   note:'Published nominal annual production capacity, NOT real-time output, available fertilizer stock, domestic sales or export commitments.',
  },
 }
}
export async function GET(){
 const supabase=await createClient()
 const {data:{user},error}=await supabase.auth.getUser()
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401})
 if(cached&&cached.until>Date.now())
  return NextResponse.json(cached.payload,{headers:{'Cache-Control':'private, max-age=120'}})
 if(!pending)pending=build()
 try{
  const payload=await pending
  cached={until:Date.now()+(payload.tradeStatus==='available'?TRADE_CACHE_MS:10*60_000),payload}
  return NextResponse.json(payload,{headers:{'Cache-Control':'private, max-age=120'}})
 }finally{pending=null}
}
