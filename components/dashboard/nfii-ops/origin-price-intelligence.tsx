'use client'

import {useEffect,useState} from 'react'
import {BarChart3,CheckCircle2,ExternalLink,Loader2,ShieldAlert,TrendingDown} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import type {OriginPriceReport} from '@/lib/nfii/origin-price-model'

export type FeasibleCropCountry={
  countryCode:string
  countryName:string
  documentedLeads:number
  observedQatarImports:boolean
  historicalUnitValueQarKg:number|null
  importTonnes:number|null
  year:number|null
  feasibility:'observed_import_route'|'documented_company_only'|'local_supplier_research'
}

type OriginResponse={
  commodity:string
  provider:'un-comtrade-public-preview'
  requestedYear:number
  yearsWithRecords:number[]
  report:OriginPriceReport
  shortlist:FeasibleCropCountry[]
  localQatar:{countryCode:'QA';countryName:string;documentedLeads:number;
    historicalUnitValueQarKg:null;feasibility:'local_supplier_research'}
  dataStatus:'available'|'unavailable'
  providerWarnings:number
  historicalFallbackUsed?:boolean
  provenance?:{publisher:string;hsCode:string;productScope:string;sourceUrls:string[]}|null
  priceUnavailabilityReason?:string|null
}

const fmt=(value:number|null,digits=2):string=>value===null?'N/A':
  value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const whole=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:0})

export function OriginPriceIntelligence({
  commodity,organizationId,onCountriesLoaded,onSelectCountry,
}:{
  commodity:string
  organizationId:string|null
  onCountriesLoaded:(countries:FeasibleCropCountry[])=>void
  onSelectCountry:(country:string)=>void
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [data,setData]=useState<OriginResponse|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [year,setYear]=useState(2025)
  useEffect(()=>{
    const controller=new AbortController()
    const params=new URLSearchParams({
      commodity,year:String(year),
      ...(organizationId?{organizationId}:{}),
    })
    setLoading(true)
    setData(null)
    setError('')
    void fetch('/api/nfii/procurement/origin-prices?'+params.toString(),{
      cache:'no-store',signal:controller.signal,
    }).then(async response=>{
      const body=await response.json() as OriginResponse & {error?:string}
      if(!response.ok)throw Error(body.error??'Import market data unavailable')
      if(body.commodity!==commodity)throw Error('Unexpected crop price response')
      if(controller.signal.aborted)return
      setData(body)
      onCountriesLoaded(body.localQatar.documentedLeads>0?
        [...body.shortlist,{...body.localQatar,observedQatarImports:false,
          importTonnes:null,year:null}]:body.shortlist)
    }).catch(reason=>{
      if(!controller.signal.aborted){
        setError(reason instanceof Error?reason.message:'Provider unavailable')
        onCountriesLoaded([])
      }
    }).finally(()=>{
      if(!controller.signal.aborted)setLoading(false)
    })
    return ()=>controller.abort()
  },[commodity,organizationId,year,onCountriesLoaded])

  const report=data?.report
  const origins=report?.origins??[]
  const maxPrice=Math.max(...origins.map(row=>row.unitValueQarKg),0.01)
  const maxTons=Math.max(...origins.map(row=>row.importWeightTonnes),1)
  const cheapest=origins[0]

  return <section aria-label={tx('Origin intelligence and historical prices','تحليل المناشئ والأسعار التاريخية')}
    className="rounded-xl border border-line bg-background p-4 md:p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sage-700" aria-hidden="true"/>
          <h3 className="text-[17px] font-semibold text-content">
            {tx('Where should Qatar source this crop?','ما هي أفضل أسواق توريد هذا المحصول لقطر؟')}
          </h3>
        </div>
        <p className="mt-1 max-w-[86ch] text-[12px] leading-relaxed text-content-soft">
          {tx('Compare import origins using observed Qatar trade value and weight. Prices are historical weighted customs unit values in QAR/kg, not supplier quotations.',
            'مقارنة مناشئ الاستيراد بالقيمة والوزن المسجلين. الأسعار التاريخية بالريال للكيلوغرام ليست عروض أسعار للموردين.')}
        </p>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-content-soft">
        {tx('Historical year','السنة التاريخية')}
        <select className="nfii-input min-h-9" value={year} onChange={event=>setYear(Number(event.target.value))}>
          {[2025,2024,2023,2022].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </div>

    {loading&&<div role="status" className="flex items-center gap-2 rounded-lg border border-line bg-muted/20 p-3 text-[12px] text-content-soft">
      <Loader2 className="h-4 w-4 animate-spin"/>
      {tx('Checking Qatar import origins and prices from UN Comtrade…','جارٍ التحقق من مناشئ الواردات والأسعار من بيانات الأمم المتحدة…')}
    </div>}
    {error&&<div role="alert" className="flex items-center gap-2 rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-warning-strong">
      <ShieldAlert className="h-4 w-4"/>{error}
    </div>}

    {report&&<>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          {name:tx('Historical weighted mean','المتوسط المرجح التاريخي'),
            value:report.weightedAverageQarKg===null?'N/A':fmt(report.weightedAverageQarKg)+' QAR/kg'},
          {name:tx('Lowest observed origin','أقل منشأ مسجل'),
            value:report.lowestObservedQarKg===null?'N/A':fmt(report.lowestObservedQarKg)+' QAR/kg'},
          {name:tx('Import origins shown','مناشئ الاستيراد المعروضة'),value:String(origins.length)},
          {name:tx('Observed trade year','سنة التداول المرصودة'),value:report.analyzedYear?.toString()??'N/A'},
        ].map(item=><div key={item.name} className="rounded-lg border border-line bg-card p-3">
          <p className="text-[10px] text-content-soft">{item.name}</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-content">{item.value}</p>
        </div>)}
      </div>

      {data?.historicalFallbackUsed&&<div role="status"
        className="rounded-lg border border-line-accent bg-cream-100/25 p-3 text-[12px] text-content">
        <strong>{tx('Historical fallback: World Bank WITS 2024','مصدر تاريخي بديل: البنك الدولي ٢٠٢٤')}</strong>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('The live trade API had no usable observations, so this comparison uses attributed, published 2024 import records. It does not show 2025 or live prices.',
            'تستخدم المقارنة بيانات واردات قطر المنشورة لعام ٢٠٢٤ وليست أسعاراً مباشرة.')}
          {' '}{data.provenance?.productScope}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {data.provenance?.sourceUrls.map(url=><a key={url} href={url}
            target="_blank" rel="noopener noreferrer"
            className="text-sage-700 underline">
            {tx('Published WITS table','جدول WITS')} <ExternalLink className="inline h-3 w-3"/>
          </a>)}
        </div>
      </div>}
      {cheapest&&<div className="rounded-lg border border-line-accent bg-cream-100/25 p-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-sage-700"/>
          <strong className="text-[12px] text-content">
            {tx('First origin to request a quotation from (price screening only)',
              'المنشأ الأول لطلب عرض سعر (فحص السعر فقط)')}
          </strong>
        </div>
        <p className="mt-1 text-[13px] text-content">
          <strong>{cheapest.countryName}</strong> · {fmt(cheapest.unitValueQarKg)} QAR/kg ·
          {' '}{whole(cheapest.importWeightTonnes)} {tx('tonnes historically imported','طن مستوردة تاريخياً')}
        </p>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('Cheapest historical recorded customs unit value among screened routes. Not necessarily the lowest current offer; quality, variety, seasonal availability and landed costs must be compared.',
            'أقل قيمة جمركية تاريخية للمسارات المعروضة؛ يجب التحقق من السعر الحالي والجودة والتوافر وتكلفة التسليم.')}
        </p>
      </div>}

      {origins.length>0?<div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <h4 className="text-[12px] font-semibold text-content">
            {tx('Historical unit value by origin · QAR/kg','القيمة التاريخية حسب المنشأ · ريال/كغ')}
          </h4>
          <p className="mb-3 text-[10px] text-content-soft">
            {tx('Lower bar = cheaper observed import unit value','الشريط الأقصر = أقل قيمة للواردات')}
          </p>
          <div className="space-y-2">
            {origins.map(row=><div key={row.countryCode} className="grid grid-cols-[minmax(72px,1fr)_minmax(90px,2.7fr)_70px] items-center gap-2">
              <span className="truncate text-[11px] text-content" title={row.countryName}>{row.countryName}</span>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-sage-600" style={{width:(row.unitValueQarKg/maxPrice*100).toFixed(2)+'%'}}/>
              </div>
              <span className="text-right text-[11px] tabular-nums text-content">{fmt(row.unitValueQarKg)}</span>
            </div>)}
          </div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <h4 className="text-[12px] font-semibold text-content">
            {tx('Qatar imported volume · tonnes','حجم واردات قطر · طن')}
          </h4>
          <p className="mb-3 text-[10px] text-content-soft">
            {tx('Higher bar = more observed trade volume, not available supplier stock','الشريط الأطول = حجم تجاري تاريخي وليس مخزون المورد')}
          </p>
          <div className="space-y-2">
            {origins.map(row=><div key={row.countryCode} className="grid grid-cols-[minmax(72px,1fr)_minmax(90px,2.7fr)_70px] items-center gap-2">
              <span className="truncate text-[11px] text-content" title={row.countryName}>{row.countryName}</span>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-sage-400" style={{width:(row.importWeightTonnes/maxTons*100).toFixed(2)+'%'}}/>
              </div>
              <span className="text-right text-[11px] tabular-nums text-content">{whole(row.importWeightTonnes)}</span>
            </div>)}
          </div>
        </div>
      </div>:<div className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
        {tx('No trustworthy price comparison from live trade or published historical data. The provider may be unavailable or the available records do not meet minimum trade thresholds. No prices were fabricated.',
          'لا توجد مقارنة موثوقة للأسعار: السجلات المتاحة لا تحقق الحد الأدنى للحجم والقيمة السنوية.')}
      </div>}

      {origins.length>0&&<div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full text-left text-[11px]">
          <thead className="bg-muted/40 text-content-soft"><tr>
            <th className="p-2">{tx('Origin','المنشأ')}</th>
            <th className="p-2 text-right">QAR/kg</th>
            <th className="p-2 text-right">{tx('vs mean','مقارنة بالمتوسط')}</th>
            <th className="p-2 text-right">{tx('Tonnes','طن')}</th>
            <th className="p-2 text-center">{tx('Previous year','العام السابق')}</th>
            <th className="p-2 text-center">{tx('Research','بحث')}</th>
          </tr></thead>
          <tbody>{origins.map(row=><tr key={row.countryCode} className="border-t border-line">
            <td className="p-2 font-medium text-content">{row.countryName}</td>
            <td className="p-2 text-right tabular-nums">{fmt(row.unitValueQarKg)}</td>
            <td className="p-2 text-right tabular-nums">{row.differenceVsMeanPct>0?'+':''}{fmt(row.differenceVsMeanPct,1)}%</td>
            <td className="p-2 text-right tabular-nums">{whole(row.importWeightTonnes)}</td>
            <td className="p-2 text-center">{row.importedPreviousYear?
              <CheckCircle2 className="mx-auto h-4 w-4 text-sage-700" aria-label="Observed in previous year"/>:'—'}</td>
            <td className="p-2 text-center">
              <button type="button" onClick={()=>onSelectCountry(row.countryCode)}
                className="font-medium text-sage-700 underline">
                {tx('Select','اختر')}
              </button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>}

      {data&&<div className="rounded-lg border border-line bg-muted/20 p-3">
        <p className="text-[12px] font-semibold text-content">
          {tx('Other plausible countries with published suppliers','دول إضافية لديها جهات توريد منشورة')}
        </p>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('These countries have named crop-sector candidates, but no comparable Qatar import unit value in this report. They are unpriced research options, not proven affordable origins.',
            'لدى هذه الدول جهات منشورة لكن لا يوجد سعر واردات قطري قابل للمقارنة.')}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.shortlist.filter(row=>!row.observedQatarImports).slice(0,15).map(row=>
            <button key={row.countryCode} type="button"
              onClick={()=>onSelectCountry(row.countryCode)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-content hover:border-line-accent">
              {row.countryName} · {row.documentedLeads} {tx('leads','جهات')}
            </button>)}
          {data.localQatar.documentedLeads>0&&
            <button type="button" onClick={()=>onSelectCountry('QA')}
              className="rounded-full border border-line-accent bg-card px-3 py-1.5 text-[11px] text-sage-700">
              {tx('Qatar local · ','قطر محلي · ')}{data.localQatar.documentedLeads}
            </button>}
        </div>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-content-soft">
        <p>
          {tx('Source: historical UN Comtrade / World Bank WITS Qatar imports; customs values, not quotations. ',
            'المصدر: بيانات التجارة السنوية للأمم المتحدة، ليست عروض أسعار. ')}
          {tx('Exchange: 1 USD = 3.64 QAR. Minimum annual volume: ','الصرف: الدولار = 3.64 ريال. الحد الأدنى السنوي: ')}
          {report.annualMinimumTonnes} {tx('tonnes.','طن.')}
        </p>
        {report.sourceUrl&&<a href={report.sourceUrl} rel="noopener noreferrer" target="_blank"
          className="inline-flex items-center gap-1 text-sage-700 underline">
          {tx('View trade source','عرض المصدر')}<ExternalLink className="h-3 w-3"/>
        </a>}
      </div>
      {report.incompletePreview&&<p className="text-[11px] text-warning-strong">
        {tx('Public preview may be truncated: results are indicative, not complete rankings.',
          'قد تكون البيانات العامة مقتطعة: النتائج إرشادية وليست ترتيباً كاملاً.')}
      </p>}
      {data?.providerWarnings>0&&!data.historicalFallbackUsed&&<p className="text-[11px] text-warning-strong">
        {tx('Some requested years were unavailable; comparison uses available historical reports.',
          'بعض السنوات غير متاحة؛ المقارنة تعتمد على البيانات المتوفرة.')}
      </p>}
    </>}
  </section>
}
