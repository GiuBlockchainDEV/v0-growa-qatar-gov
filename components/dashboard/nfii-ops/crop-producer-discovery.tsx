'use client'

import {useCallback,useRef,useState,type FormEvent} from 'react'
import {
  ArrowUpRight,ClipboardCheck,ExternalLink,FileCheck2,
  Leaf,Loader2,Search,ShieldAlert,Trash2,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {COMMODITY_CATALOG} from '@/lib/platform/commodity-catalog'
import {OriginPriceIntelligence,type FeasibleCropCountry} from './origin-price-intelligence'
import {
  FAIRTSA_REGISTRY_URL,FAIRTSA_EXCERPT_CHECKED,
  GLOBALGAP_REGISTRY_URL,USDA_ORGANIC_REGISTRY_URL,
  type CropProducerEvidence,
} from '@/lib/nfii/crop-producer-directory'

type CropResult={
  provider:'crop-sector-directory'
  commodity:string
  country:string
  excerptCheckedOn:string
  sourceUrl:string
  results:CropProducerEvidence[]
  completeGlobalCoverage:false
  liveCertificateVerified:false
  note:string
  sourceCoverage:Record<string,number>
  sourceCount:number
  countryCount:number
  evidenceBreakdown:Record<string,number>
  research:'curated'|'mapped'|'expanded'|'places'
  cropTaggedCount:number
  agriculturalCandidateCount:number
  countryHasDocumentedCropMatches:boolean
  researchStatus:'not_requested'|'available'|'no_matches'|'not_configured'|'unavailable'
  researchMessage:string
  documentedCount:number
  exploratoryCount:number
}


export function CropProducerDiscovery({organizationId}:{organizationId:string|null}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [crop,setCrop]=useState('rice')
  const [country,setCountry]=useState('')
  const [feasibleCountries,setFeasibleCountries]=useState<FeasibleCropCountry[]>([])
  const [research,setResearch]=useState<'curated'|'mapped'|'expanded'|'places'>('expanded')
  const [data,setData]=useState<CropResult|null>(null)
  const [queryLoading,setQueryLoading]=useState(false)
  const [error,setError]=useState('')
  const [shortlist,setShortlist]=useState<CropProducerEvidence[]>([])
  const [copyStatus,setCopyStatus]=useState('')
  const [visibleCount,setVisibleCount]=useState(20)
  const [roleFilter,setRoleFilter]=useState('all')
  const controller=useRef<AbortController|null>(null)
  const onCountriesLoaded=useCallback((countries:FeasibleCropCountry[])=>{
    setFeasibleCountries(countries)
  },[])

  const invalidate=()=>{
    controller.current?.abort()
    controller.current=null
    setQueryLoading(false)
    setError('')
    setData(null)
    setCopyStatus('')
    setVisibleCount(20)
    setRoleFilter('all')
  }

  const search=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    invalidate()
    const abort=new AbortController()
    controller.current=abort
    setQueryLoading(true)
    const params=new URLSearchParams({
      commodity:crop,country,research,
      ...(organizationId?{organizationId}:{}),
    })
    try{
      const response=await fetch('/api/nfii/procurement/crop-producers?'+params,{
        signal:abort.signal,cache:'no-store',
      })
      const body=await response.json() as CropResult & {error?:string}
      if(!response.ok)throw Error(body.error??'Source cannot be consulted')
      if(body.provider!=='crop-sector-directory'||body.commodity!==crop)
        throw Error('Unexpected registry response')
      if(!abort.signal.aborted)setData(body)
    }catch(reason){
      if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:
        'Certified product search unavailable')
    }finally{
      if(!abort.signal.aborted){
        setQueryLoading(false)
        controller.current=null
      }
    }
  }

  const toggle=(record:CropProducerEvidence)=>{
    const key=record.sourceUrl+':'+record.recordId+':'+record.organizationName
    setShortlist(items=>items.some(x=>x.sourceUrl+':'+x.recordId+':'+x.organizationName===key)
      ?items.filter(x=>x.sourceUrl+':'+x.recordId+':'+x.organizationName!==key)
      :items.length>=250?items:[...items,record])
    setCopyStatus('')
  }

  const copy=async()=>{
    if(!shortlist.length)return
    const rows=[
      ['Organization','Crop / sector evidence','Country','Evidence type',
        'Registry reference','Registry source','Status'],
      ...shortlist.map(record=>[
        record.organizationName,record.matchedProduct,
        record.countryName,record.evidenceType+(record.supplierRole?' / '+record.supplierRole:''),record.recordId,
        record.sourceUrl,'Current certificate and grower role NOT verified',
      ]),
    ]
    try{
      await navigator.clipboard.writeText(rows.map(row=>row.join('\t')).join('\n'))
      setCopyStatus(tx('Research shortlist copied','تم نسخ قائمة البحث'))
    }catch{
      setCopyStatus(tx('Clipboard unavailable; use the registry links above.',
        'النسخ غير متاح؛ استخدم روابط السجل أعلاه.'))
    }
  }

  const filtered=data?.results.filter(record=>roleFilter==='all'||
    (roleFilter==='farm'?(record.supplierRole==='farm_claim'||record.supplierRole==='farm_other'):
      roleFilter==='other'?!record.supplierRole:record.supplierRole===roleFilter))??[]
  return <section aria-label={tx('Search producers by crop','البحث عن المنتجين حسب المحصول')}
    className="nfii-panel space-y-4 p-4 md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-cream-100 p-2.5">
          <Leaf className="h-5 w-5 text-sage-700" aria-hidden="true"/>
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-sage-700">
            {tx('START WITH A CROP · DOCUMENTED PRODUCT MATCHES',
              'ابدأ بالمحصول · مطابقة المنتجات الموثقة')}
          </p>
          <h2 className="mt-1 text-[20px] font-medium text-content">
            {tx('Find organizations associated with a crop',
              'البحث عن مؤسسات مرتبطة بمحصول')}
          </h2>
          <p className="mt-1 max-w-[84ch] text-[12px] leading-relaxed text-content-soft">
            {tx('Select a crop, not a company name. Discover documented leads from published crop associations, product certificates, dairy listings and dates registries. Each result links to its original source.',
              'اختر المحصول وليس اسم شركة. الأسماء مأخوذة من دليل علني لمنتجات الاعتماد، مع المنتج والدولة وجهة التصديق والمرجع الأصلي.')}
          </p>
        </div>
      </div>
      <span className="rounded-full border border-warning-line bg-warning-soft px-3 py-1.5 text-[10px] font-medium text-warning-strong">
        {tx('MULTI-SOURCE DIRECTORY · NOT LIVE','مقتطف منشور محدود · غير مباشر')}
      </span>
    </div>

    <OriginPriceIntelligence commodity={crop} organizationId={organizationId}
      onCountriesLoaded={onCountriesLoaded}
      onSelectCountry={next=>{invalidate();setCountry(next)}}/>

    <form onSubmit={event=>void search(event)}
      className="grid gap-3 rounded-xl border border-line bg-background p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.9fr)_auto] md:items-end">
      <label className="space-y-1.5">
        <span className="nfii-label">{tx('1. Select crop / food product','١. اختر المحصول / المنتج')}</span>
        <select className="nfii-input min-h-11" value={crop}
          onChange={event=>{invalidate();setCountry('');setFeasibleCountries([]);setCrop(event.target.value)}}>
          {COMMODITY_CATALOG.map(item=><option key={item.id} value={item.id}>
            {ar?item.nameAr:item.name}
          </option>)}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="nfii-label">{tx('2. Feasible sourcing origin','٢. منشأ توريد مدعوم')}</span>
        <select className="nfii-input min-h-11" value={country}
          onChange={event=>{invalidate();setCountry(event.target.value)}}>
          <option value="">{tx('All documented countries','جميع الدول الموثقة')}</option>
          {feasibleCountries.map(item=><option key={item.countryCode} value={item.countryCode}>
            {item.countryName} · {item.documentedLeads} {tx('published leads','جهات منشورة')}
            {item.observedQatarImports&&item.historicalUnitValueQarKg!==null?
              ' · '+item.historicalUnitValueQarKg.toFixed(2)+' QAR/kg':''}
          </option>)}

        </select>
      </label>
      <button type="submit" disabled={queryLoading||(research==='places'&&(!country||!organizationId))}
        className="nfii-button inline-flex min-h-11 items-center justify-center gap-2 disabled:opacity-40">
        {queryLoading?<Loader2 className="h-4 w-4 animate-spin"/>:
          <Search className="h-4 w-4"/>}
        {queryLoading?tx('Searching…','جارٍ البحث…'):
          tx('Find crop matches','بحث حسب المحصول')}
      </button>
    </form>

    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[11px] text-content-soft">{tx('3. Search source','٣. مصدر البحث')}</span>
        <select className="nfii-input min-h-10" value={research}
          onChange={event=>{invalidate();setResearch(event.target.value as 'curated'|'mapped'|'expanded'|'places')}}>
          <option value="expanded">{tx('Broad free search: crops + mapped farms','بحث مجاني موسع: محاصيل ومزارع')}</option>
          <option value="mapped">{tx('Strict crop-tagged map locations only','مواقع بخريطة تحمل تسمية المحصول فقط')}</option>
          <option value="curated">{tx('Published source listings only','السجلات المنشورة فقط')}</option>
          <option value="places">{tx('Published leads + Google Places (paid)','جهات منشورة + جوجل المدفوع')}</option>
        </select>
      </label>
      <p className="w-full text-[11px] text-content-soft">
        {research==='expanded'?
          tx('Search mapped crop-tagged sites PLUS named farms/greenhouses when supplier directories are sparse. Generic mapped farms have NOT been confirmed for the selected crop.',
            'يبحث عن مواقع المحصول والمزارع المسماة. المحصول المختار غير مؤكد للمزارع العامة.'):
        research==='mapped'?
          tx('Strict mapping requires an explicit crop tag on a named site; very few farms have one.',
            'يتطلب البحث الدقيق وسم المحصول نفسه، لذلك قد تكون النتائج قليلة.'):
        research==='places'?
          tx('Google Places uses paid, server-side billing and requires a selected country and authorized organization. Keyword matches are unverified.',
            'يتطلب بحث جوجل المدفوع دولة محددة ومؤسسة مخولة. نتائج الكلمات المفتاحية غير محققة.'):
          tx('Only previously documented names from curated registries; missing matches do not imply no producers exist.',
            'الأسماء المنشورة فقط؛ عدم وجود نتائج لا يعني عدم وجود منتجين.')}
      </p>
    </div>

    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-content-soft">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"/>
      {tx('Association membership, a product certificate, a dates mark or a published price list are different types of evidence. None independently confirms own-farm production, current export permissions, certification, stock or availability. Treat every record as an unqualified sourcing lead.',
        'وجود المنتج في دليل الاعتماد لا يعني أن المؤسسة تزرعه بنفسها أو أن الشهادة سارية أو يمكنها التصدير إلى قطر أو لديها مخزون للبيع. جميع النتائج مرشحون يحتاجون تحققاً مستقلاً.')}
    </p>

    {error&&<p role="alert" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-critical">
      {error}
    </p>}

    {!data&&!error&&!queryLoading&&
      <p className="rounded-lg border border-line bg-muted/30 p-4 text-[12px] text-content-soft">
        {tx('Choose a crop and press Find crop matches. No company-name keyword is required.',
          'اختر محصولاً واضغط بحث حسب المحصول. لا يلزم إدخال اسم الشركة.')}
      </p>}

    {data&&<div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="text-[13px] font-medium text-content">
            {tx('Published crop-sector sourcing leads','مطابقات المؤسسة والمنتج الموثقة')}
            <span className="ms-2 rounded-full border border-line bg-muted px-2 py-0.5 text-[11px] tabular-nums text-content">
              {data.results.length}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-content-soft">
            {data.countryCount} {tx('countries','دول')} · {data.sourceCount} {tx('source documents','مصادر')}
          </p>
          <p className="mt-1 text-[10px] text-content-soft">
            {tx('Multiple published sources · directory reviewed ','مصادر منشورة متعددة · تاريخ المراجعة ')}
            {data.excerptCheckedOn}
            {tx(' · historical evidence, not live verification',' · بيانات تاريخية وليست تحققاً مباشراً')}
          </p>
        </div>
        <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sage-700 hover:underline">
          {tx('FairTSA reference directory','دليل FairTSA المرجعي')}
          <ExternalLink className="h-3.5 w-3.5"/>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {[
          {name:tx('Published crop evidence','أدلة المحصول المنشورة'),
            count:data.documentedCount},
          {name:tx('Mapped crop tags','مواقع المحصول على الخريطة'),
            count:data.cropTaggedCount??0},
          {name:tx('Other agricultural candidates · crop unverified','مرشحون زراعيون غير مؤكدين للمحصول'),
            count:data.agriculturalCandidateCount??0},
        ].map(stat=><div key={stat.name}
          className="rounded-lg border border-line bg-muted/20 p-3">
          <p className="text-[10px] text-content-soft">{stat.name}</p>
          <strong className="mt-1 block text-[20px] font-medium tabular-nums text-content">
            {stat.count}
          </strong>
        </div>)}
      </div>
      {data.country&&!data.countryHasDocumentedCropMatches&&
        <button type="button" onClick={()=>{invalidate();setCountry('')}}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line-accent px-3 py-1.5 text-[11px] font-medium text-sage-700">
          {tx('Search published crop suppliers across all countries','بحث عن موردي المحاصيل المنشورين في جميع الدول')}
          <ArrowUpRight className="h-3 w-3"/>
        </button>}
      {data.country&&!data.countryHasDocumentedCropMatches&&
        <p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[11px] leading-relaxed text-content">
          {tx('No source-verified crop-company match in this country. The wider agricultural results below are only exploratory locations. Request original product and business evidence before qualifying any supplier.',
            'لا يوجد تطابق مؤكد بين شركة ومحصول في هذا البلد. المواقع الزراعية التالية للبحث فقط ولا تثبت إنتاج المحصول.')}
        </p>}
      {data.researchStatus==='unavailable'&&
        <p role="status" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[11px] text-content">
          {tx('The free live map source did not respond. Published companies remain available. Try the paid business provider if configured, or consult the independent registers below.',
            'مصدر الخرائط المجاني لم يستجب. الشركات الموثقة لا تزال متاحة.')}
        </p>}
      {data.researchStatus==='no_matches'&&
        <p role="status" className="rounded-lg border border-line bg-muted/20 p-3 text-[11px] text-content-soft">
          {tx('No matching named agricultural locations were available in this map source. This is not evidence that the country has no farms.',
            'لم تتوفر مواقع زراعية مسماة مطابقة في مصدر الخريطة. هذا لا يعني عدم وجود مزارع.')}
        </p>}
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <label className="inline-flex items-center gap-2"><span className="text-content-soft">{tx('Supplier role','نوع المورد')}</span>
          <select aria-label={tx('Supplier role','نوع المورد')} className="nfii-input min-h-9" value={roleFilter}
            onChange={event=>{setRoleFilter(event.target.value);setVisibleCount(20)}}>
            <option value="all">{tx('All documented leads','جميع الجهات الموثقة')}</option>
            <option value="farm">{tx('Farms / growers','المزارع والمنتجون')}</option>
            <option value="manufacturer">{tx('Food manufacturers','مصنعو الأغذية')}</option>
            <option value="trader">{tx('Importers / traders','المستوردون والتجار')}</option>
            <option value="other">{tx('Other registries','سجلات أخرى')}</option>
          </select></label>
        <span className="text-content-soft">{filtered.length} {tx('matches for selected role','نتيجة للدور المحدد')}</span>
      </div>
      {filtered.length>0?(
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.slice(0,visibleCount).map(record=>{
            const chosen=shortlist.some(x=>x.recordId===record.recordId&&
              x.sourceUrl===record.sourceUrl&&x.organizationName===record.organizationName)
            return <article key={record.sourceUrl+record.recordId}
              className="rounded-lg border border-line bg-background p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-sage-700">
                {tx(record.evidenceType==='keyword_business_listing'?'KEYWORD BUSINESS LEAD · PRODUCT UNVERIFIED':
                  record.evidenceType==='community_mapped_crop_tag'?'COMMUNITY-MAPPED CROP LOCATION · COMPANY UNVERIFIED':
                  record.evidenceType==='mapped_agricultural_business'?'MAPPED FARM / BUSINESS · CROP NOT VERIFIED':
                  'DOCUMENTED CROP / SECTOR LINK','ارتباط بالمحصول / القطاع مع مصدر')}
              </p>
              <h3 className="mt-1 text-[15px] font-medium text-content">
                {record.organizationName}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-[12px]">
                {[
                  [tx('Crop / sector listed','المحصول / القطاع المدرج'),record.matchedProduct],
                  [tx('Country','الدولة'),record.countryName],
                  [tx('Evidence type','نوع الدليل'),record.evidenceType.replaceAll('_',' ')],
                  [tx('Directory ID','معرف الدليل'),record.recordId],
                  [tx('Publisher','الناشر'),record.sourceName],
                  ...(record.supplierRole?[[tx('Supplier role','دور المورد'),record.supplierRole.replaceAll('_',' ')]]:[]),
                ].map(([label,value])=>(
                  <div key={label} className="min-w-0">
                    <p className="text-[10px] text-content-soft">{label}</p>
                    <p className="mt-1 break-words font-medium text-content">{value}</p>
                  </div>
                ))}
              </div>
              {record.evidenceSummary&&<p className="mt-3 rounded-md border border-line bg-muted/20 p-2 text-[11px] text-content-soft">{record.evidenceSummary}</p>}
              <div className="mt-3 rounded-lg border border-warning-line bg-warning-soft p-2.5 text-[11px] text-content">
                {tx(record.evidenceType==='mapped_agricultural_business'?
                  'Selected crop: NOT VERIFIED · Farm/business identity: NOT VERIFIED · Export/stock: UNKNOWN':
                  'Grower role: NOT independently confirmed · Certification varies by source · Export/stock: UNKNOWN',
                  'صفة المزارع: غير مثبتة · سريان الشهادة: غير مفحوص · التصدير والمخزون: غير معروف')}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sage-700 hover:underline">
                  <FileCheck2 className="h-3.5 w-3.5"/>
                  {tx('Open evidence','فتح المصدر')}
                  <ArrowUpRight className="h-3 w-3"/>
                </a>
                <button type="button"
                  onClick={()=>toggle(record)}
                  className="ms-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-accent bg-card px-3 py-1.5 text-[11px] text-sage-700">
                  <ClipboardCheck className="h-3.5 w-3.5"/>
                  {chosen?tx('Remove from research list','إزالة من قائمة البحث'):
                    tx('Add to research list','إضافة إلى قائمة البحث')}
                </button>
              </div>
            </article>
          })}
          {filtered.length>visibleCount&&<div className="col-span-full text-center">
            <button type="button" onClick={()=>setVisibleCount(count=>count+30)}
              className="nfii-button min-h-10 px-5">
              {tx('Show more documented leads','عرض المزيد من الجهات')} ({filtered.length-visibleCount})
            </button>
          </div>}
        </div>
      ):(
        <div className="rounded-lg border border-line bg-background p-4">
          <p className="text-[13px] font-medium text-content">
            {tx(roleFilter==='all'?'No published crop match in the current directory':'No documented matches for this supplier role','لا توجد مطابقة في هذا المقتطف المحدود')}
          </p>
          <p className="mt-1 text-[12px] text-content-soft">
            {tx('No match is not proof that producers do not exist. Check the broader official databases below; NFII does not invent suppliers.',
              'هذا لا يعني عدم وجود منتجين للمحصول. راجع الأدلة الرسمية الأوسع أدناه. لن يُنشئ النظام أسماء شركات وهمية لسد النقص.')}
          </p>
        </div>
      )}
    </div>}

    {shortlist.length>0&&<div className="rounded-xl border border-line-accent bg-cream-100/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-content">
          {tx('Research shortlist','قائمة البحث')} ({shortlist.length})
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={()=>void copy()}
            className="rounded-full border border-line-accent px-3 py-1.5 text-[11px] text-sage-700">
            {tx('Copy with evidence','نسخ مع الأدلة')}
          </button>
          <button type="button" onClick={()=>{setShortlist([]);setCopyStatus('')}}
            className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[11px] text-content">
            <Trash2 className="h-3.5 w-3.5"/>{tx('Clear','مسح')}
          </button>
        </div>
      </div>
      {copyStatus&&<p role="status" className="mt-2 text-[11px] text-sage-700">{copyStatus}</p>}
      <p className="mt-2 text-[11px] text-content-soft">
        {tx('Candidates are kept only in this browser until you copy them. Nothing is added to the approved supplier registry or Supabase.',
          'تُحفظ الأسماء في المتصفح فقط حتى تنسخها. لا تُضاف إلى سجل الموردين أو Supabase.')}
      </p>
    </div>}

    <div className="rounded-lg border border-line bg-muted/20 p-4">
      <h3 className="text-[13px] font-medium text-content">
        {tx('Broader official certification searches','البحث الأوسع في سجلات الاعتماد الرسمية')}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-content-soft">
        {tx('This directory remains a curated snapshot. These two services can provide additional product-level evidence; their full datasets are not connected to the NFII API.',
          'تغطية هذا المقتطف محدودة. تقدم السجلات التالية بيانات أوسع عن المنتجات، لكن البحث الكامل فيها لم يُدمج عبر API في NFII بعد.')}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {[
          {url:USDA_ORGANIC_REGISTRY_URL,name:'USDA Organic INTEGRITY',
            en:'Search certified crops/products; worldwide USDA-organic scope only.',
            ar:'ابحث حسب المحاصيل والمنتجات ضمن نطاق اعتماد USDA العضوي.'},
          {url:GLOBALGAP_REGISTRY_URL,name:'GLOBALG.A.P. IT platform',
            en:'Check crop-specific producer certificates and product lists; API requires access.',
            ar:'تحقق من شهادات المنتجين وقوائم المحاصيل؛ يتطلب الربط البرمجي صلاحية وصول.'},
        ].map(item=>(
          <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-line bg-card p-3 hover:border-line-accent">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[12px] text-content">{item.name}</strong>
              <ExternalLink className="h-3.5 w-3.5 text-sage-700"/>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-content-soft">
              {tx(item.en,item.ar)}
            </p>
          </a>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-content-soft">
        {tx('FairTSA excerpt verification date: ','تاريخ التحقق من مقتطف FairTSA: ')}
        {FAIRTSA_EXCERPT_CHECKED}
        {' · '}
        <a href={FAIRTSA_REGISTRY_URL} target="_blank" rel="noopener noreferrer"
          className="text-sage-700 underline">
          {tx('original list','القائمة الأصلية')}
        </a>
      </p>
    </div>
  </section>
}
