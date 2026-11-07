'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowUpRight,ExternalLink,Globe2,RefreshCw} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {CommodityMarketsSnapshot} from '@/lib/watchtower/commodity-markets'

/** Selected-commodity published global benchmark (not a supplier offer). */
export function CommodityPublicPriceCard({commodityId}:{commodityId:string}){
 const {locale}=useI18n()
 const ar=locale==='ar'
 const [data,setData]=useState<CommodityMarketsSnapshot|null>(null)
 const [loading,setLoading]=useState(true)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  setLoading(true)
  void (async()=>{
   try{
    const response=await fetch('/api/watchtower/commodity-markets',{
     signal:controller.signal,cache:'no-store',
    })
    if(!response.ok)throw Error('Public price source unavailable')
    const snapshot=await response.json() as CommodityMarketsSnapshot
    if(!controller.signal.aborted)setData(snapshot)
   }catch{
    if(!controller.signal.aborted)setData(null)
   }finally{if(!controller.signal.aborted)setLoading(false)}
  })()
  return()=>controller.abort()
 },[retry])
 const price=data?.instruments.find(x=>x.id===commodityId)
 const release=data?.usdaReports?.find(x=>x.markets.includes(commodityId)&&x.status==='published')
 return <section className="rounded-xl border border-line bg-card p-4" aria-label="Public commodity price evidence">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div>
    <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
     <Globe2 size={16} className="text-sage-700"/>
     {ar?'السعر العالمي المنشور':'Published global price benchmark'}
    </h2>
    <p className="mt-1 text-[11px] text-content-soft">
     {ar?'مصادر دولية مجانية، ليست عروض أسعار موردين':'No-key official data, not supplier offers or live exchange quotes'}
    </p>
   </div>
   <button type="button" onClick={()=>setRetry(x=>x+1)} disabled={loading}
    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3 text-xs text-content disabled:opacity-50">
    <RefreshCw size={14} className={loading?'animate-spin':''}/>
    {ar?'تحديث':'Refresh'}
   </button>
  </div>
  {price?<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
   <div className="rounded-lg bg-muted p-3">
    <p className="text-[10px] text-content-soft">USD / metric tonne</p>
    <strong className="text-[22px] font-semibold text-ink">{price.latestUsdTonne.toLocaleString('en-US',{maximumFractionDigits:2})}</strong>
   </div>
   <div className="rounded-lg bg-muted p-3">
    <p className="text-[10px] text-content-soft">QAR / metric tonne</p>
    <strong className="text-[22px] font-semibold text-ink">{price.latestQarTonne.toLocaleString('en-US',{maximumFractionDigits:2})}</strong>
   </div>
   <div className="rounded-lg bg-muted p-3">
    <p className="text-[10px] text-content-soft">Observation month</p>
    <strong className="text-[17px] font-semibold text-ink">{price.latestDate.slice(0,7)}</strong>
    <p className="mt-1 text-[10px] text-content-soft">{price.sourceName??'IMF via FRED'}</p>
   </div>
  </div>:<p className="mt-3 text-[12px] text-content-soft" role="status">
   {loading?(ar?'جارٍ تحميل السعر المرجعي المنشور':'Loading published benchmark…'):
    ar?'لا يتوفر حالياً سعر مرجعي منشور موثوق لهذه السلعة.':'No verified international monthly benchmark is available for this commodity.'}
  </p>}
  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[11px]">
   {price&&<a href={price.sourceUrl} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-sage-700">
    {ar?'المصدر الأصلي':'Original source'}<ExternalLink size={12}/>
   </a>}
   {release&&<a href={release.sourceUrl} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-sage-700">
    USDA daily report · {release.reportDate}<ExternalLink size={12}/>
   </a>}
   <Link href="/dashboard?module=watchtower#watchtower-markets"
    className="inline-flex items-center gap-1 text-sage-700">
    {ar?'جميع مؤشرات السلع':'All commodity benchmarks'}<ArrowUpRight size={12}/>
   </Link>
  </div>
  <p className="mt-2 text-[10px] leading-5 text-content-soft">
   {ar?'مرجع شهري دولي بسعر صرف 3.64 ريال للدولار. لا يشمل الجودة أو الشحن أو الرسوم أو هامش المورد.':
    'International monthly benchmark, USD/QAR parity 3.64. Excludes quality, freight, customs and supplier margin. USDA publication date is not a numeric bid.'}
  </p>
 </section>
}
