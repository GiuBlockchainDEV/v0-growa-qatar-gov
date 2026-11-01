'use client'

import {useRef,useState,type FormEvent} from 'react'
import {
  ArrowUpRight,Building2,Check,ClipboardList,ExternalLink,Globe2,
  Loader2,Search,ShieldAlert,Ship,ShoppingBasket,Trash2,
} from 'lucide-react'
import {useI18n} from '@/lib/i18n'
import {COMMODITY_CATALOG} from '@/lib/platform/commodity-catalog'
import {
  COUNTRY_NAME,HS_CODES,type ProcurementProvider,type SupplierCandidate,
  type TradeResearch,
} from '@/lib/nfii/procurement-global'

type CandidateResponse={
  provider:'gleif'|'places'
  source:string
  query:string
  country:string
  retrievedAt:string
  results:SupplierCandidate[]
  qualification:'unassessed'
  note:string
  sourceUrl:string
}
type TradeResponse={
  provider:'comtrade'
  source:string
  retrievedAt:string
  trade:TradeResearch
}
type Response=CandidateResponse|TradeResponse
const fmt=(value:number|null,digits=0)=>value===null?'—':
  value.toLocaleString('en-US',{maximumFractionDigits:digits})

const SOURCES:[
  {key:'gleif';en:string;ar:string;helpEn:string;helpAr:string},
  {key:'places';en:string;ar:string;helpEn:string;helpAr:string},
  {key:'comtrade';en:string;ar:string;helpEn:string;helpAr:string},
]=[
  {key:'gleif',en:'Company registry',ar:'سجل الشركات',
    helpEn:'Find legal entities through the free global LEI index. Product supply is not confirmed.',
    helpAr:'ابحث عن كيانات قانونية في سجل LEI العالمي المجاني. لا يؤكد توفر المنتجات.'},
  {key:'places',en:'Business discovery',ar:'البحث عن أنشطة تجارية',
    helpEn:'Find food businesses using optional Google Places. A key, billing and organization access are required.',
    helpAr:'البحث في Google Places. يتطلب مفتاح API وفوترة وصلاحية مؤسسة.'},
  {key:'comtrade',en:'Qatar import origins',ar:'مناشئ واردات قطر',
    helpEn:'Historical country-level Qatar imports from UN Comtrade. Not individual suppliers.',
    helpAr:'واردات قطر التاريخية حسب الدولة من الأمم المتحدة. ليست قائمة بالموردين.'},
]

function candidateKey(row:SupplierCandidate):string {
  return row.source+':'+row.sourceId
}
function registrationBadge(row:SupplierCandidate):{en:string;ar:string;style:string}{
  if(row.source!=='GLEIF')return {en:'Business listing',ar:'قائمة نشاط تجاري',
    style:'border-line bg-muted text-content-soft'}
  if(row.legalEntityStatus==='ACTIVE'&&row.registrationStatus==='ISSUED')
    return {en:'Active LEI record',ar:'سجل LEI فعال',
      style:'border-line-accent bg-cream-100 text-sage-700'}
  return {en:'Check legal/LEI status',ar:'تحقق من حالة الكيان',
    style:'border-warning-line bg-warning-soft text-warning-strong'}
}

export function GlobalSupplierResearch({
  organizationId,canCreateSupplier,onPrepareSupplier,existingSupplierCodes,
}:{
  organizationId:string|null
  canCreateSupplier:boolean
  onPrepareSupplier:(candidate:SupplierCandidate)=>void
  existingSupplierCodes:readonly string[]
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [provider,setProvider]=useState<ProcurementProvider>('gleif')
  const [query,setQuery]=useState('grain')
  const [country,setCountry]=useState('')
  const [commodity,setCommodity]=useState('wheat')
  const [year,setYear]=useState('2024')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [data,setData]=useState<Response|null>(null)
  const [shortlist,setShortlist]=useState<SupplierCandidate[]>([])
  const [copyNote,setCopyNote]=useState('')
  const controller=useRef<AbortController|null>(null)

  const clearResults=()=>{
    controller.current?.abort()
    controller.current=null
    setLoading(false)
    setError('')
    setCopyNote('')
    setData(null)
  }
  const currentData=data?.provider===provider?data:null
  const canSearch=provider==='comtrade' || query.trim().length>=3
  const selectedKeys=new Set(shortlist.map(candidateKey))

  const search=async(event?:FormEvent<HTMLFormElement>)=>{
    event?.preventDefault()
    if(!canSearch||loading)return
    clearResults()
    const abort=new AbortController()
    controller.current=abort
    setLoading(true)
    const params=new URLSearchParams({
      provider,
      commodity,country:country.trim().toUpperCase(),
      q:query.trim(),year,
      ...(organizationId?{organizationId}:{}),
    })
    try{
      const response=await fetch('/api/nfii/procurement/discovery?'+params.toString(),{
        signal:abort.signal,cache:'no-store',
      })
      const json=await response.json() as Response&{error?:string}
      if(!response.ok)throw Error(json.error??'Global data source unavailable')
      if(json.provider!==provider)throw Error('Unexpected provider response')
      if(abort.signal.aborted)return
      setData(json)
    }catch(cause){
      if(!abort.signal.aborted)
        setError(cause instanceof Error?cause.message:'Unable to search')
    }finally{
      if(!abort.signal.aborted){setLoading(false);controller.current=null}
    }
  }

  const toggleShortlist=(candidate:SupplierCandidate)=>{
    const id=candidateKey(candidate)
    setShortlist(list=>list.some(row=>candidateKey(row)===id)
      ?list.filter(row=>candidateKey(row)!==id)
      :list.length>=25?list:[...list,candidate])
    setCopyNote('')
  }
  const copyShortlist=async()=>{
    if(!shortlist.length)return
    const text=shortlist.map(row=>[
      row.name,row.countryCode??'',row.lei??'',row.website??'',
      row.source,row.sourceUrl,
    ].join('\t')).join('\n')
    try{
      await navigator.clipboard.writeText(
        ['Company','Country','LEI','Website','Source','Source URL'].join('\t')+
        '\n'+text)
      setCopyNote(tx('Shortlist copied as TSV','تم نسخ قائمة المرشحين'))
    }catch{
      setCopyNote(tx('Clipboard permission denied. Select names and source links manually.',
        'لم يُسمح بالنسخ. انسخ الأسماء والروابط يدوياً.'))
    }
  }

  const currentSource=SOURCES.find(row=>row.key===provider)!
  const chooseOrigin=(code:string)=>{
    clearResults()
    setProvider('gleif')
    setCountry(code)
    setQuery(COMMODITY_CATALOG.find(c=>c.id===commodity)?.name??commodity)
  }
  const showCandidate=(row:SupplierCandidate)=>{
    const badge=registrationBadge(row)
    const already=existingSupplierCodes.includes(
      row.lei?'LEI-'+row.lei:'' )
    return <article key={candidateKey(row)}
      className="rounded-lg border border-line bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-content">{row.name}</h4>
          <p className="mt-1 text-[11px] text-content-soft">
            {row.address??row.countryCode??tx('Address not supplied','العنوان غير متاح')}
          </p>
        </div>
        <span className={'rounded-full border px-2.5 py-1 text-[10px] '+badge.style}>
          {tx(badge.en,badge.ar)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-content-soft">
        <span>{row.source}</span>
        {row.countryCode&&<span>{COUNTRY_NAME[row.countryCode]??row.countryCode}</span>}
        {row.lei&&<span className="font-mono text-[10px]">LEI {row.lei}</span>}
        {row.phone&&<span dir="ltr">{row.phone}</span>}
        {row.legalEntityStatus&&<span>{tx('Entity status','حالة الكيان')}: {row.legalEntityStatus}</span>}
        {row.registrationStatus&&<span>{tx('LEI status','حالة LEI')}: {row.registrationStatus}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sage-700 hover:underline">
          {tx('Verify original listing','التحقق من المصدر')}
          <ArrowUpRight className="h-3 w-3"/>
        </a>
        {row.website&&<a href={row.website} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-sage-700 hover:underline">
          {tx('Website','الموقع')} <ExternalLink className="h-3 w-3"/>
        </a>}
        <button type="button" onClick={()=>toggleShortlist(row)}
          className="rounded-full border border-line px-3 py-1.5 text-[11px] text-content hover:border-line-accent">
          {selectedKeys.has(candidateKey(row))?tx('Remove from shortlist','إزالة من القائمة'):
            tx('Shortlist','إضافة للمرشحين')}
        </button>
        <button type="button" disabled={!canCreateSupplier||!row.countryCode||already||row.source!=='GLEIF'||row.name.length>200}
          onClick={()=>onPrepareSupplier(row)}
          className="ms-auto rounded-full border border-line-accent bg-cream-100 px-3 py-1.5 text-[11px] font-medium text-sage-700 disabled:cursor-not-allowed disabled:opacity-40">
          {already?tx('Already in register','مسجل مسبقاً'):
            row.source!=='GLEIF'?tx('Verify legal entity first','تحقق من الكيان القانوني أولاً'):
            tx('Prepare supplier draft','إعداد مسودة مورد')}
        </button>
      </div>
      <p className="mt-2 text-[10px] text-content-soft">
        {row.source==='GLEIF'?
          tx('Legal entity evidence only. Food products, export capability, permits and pricing are NOT verified.',
            'دليل على كيان قانوني فقط. المنتجات والتصدير والتصاريح والأسعار غير موثقة.'):
          tx('Business listing only. Verify legal identity and product range independently before manual onboarding; Google business data are not imported into the supplier register.',
            'قائمة أعمال فقط. تحقق من الهوية القانونية والمنتجات بشكل مستقل قبل التسجيل يدوياً؛ لا تُنقل بيانات Google مباشرة إلى سجل الموردين.')}
        {!row.countryCode&&tx(' Country must be verified before preparing a draft.',
          ' يجب التحقق من الدولة قبل إعداد المسودة.')}
        {!canCreateSupplier&&tx(' Saving requires a live authorized organization and supply.edit.',
          ' يتطلب الحفظ مؤسسة حقيقية مخولة وصلاحية تعديل التوريد.')}
      </p>
    </article>
  }

  return <section id="procurement-global-research"
    className="nfii-panel space-y-4 p-4 md:p-5"
    aria-label={tx('Global supplier research','البحث العالمي عن الموردين')}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-cream-100 p-2.5">
          <Globe2 className="h-5 w-5 text-sage-700"/>
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-sage-700">
            {tx('LIVE GLOBAL DATA SOURCES','مصادر البيانات العالمية المباشرة')}
          </p>
          <h2 className="mt-1 text-[19px] font-medium text-content">
            {tx('Supplier discovery & sourcing intelligence',
              'اكتشاف الموردين وتحليل الأسواق')}
          </h2>
          <p className="mt-1 max-w-[85ch] text-[12px] leading-relaxed text-content-soft">
            {tx('Research legal entities, discover potential food businesses and investigate historical import origins. Results come from external APIs, never from the NFII illustrative supplier ledger.',
              'ابحث عن الكيانات القانونية والأنشطة التجارية المحتملة ومناشئ الواردات التاريخية. النتائج من واجهات خارجية وليست من بيانات NFII التوضيحية.')}
          </p>
        </div>
      </div>
      <span className="rounded-full border border-line bg-muted px-3 py-1.5 text-[11px] text-content-soft">
        {tx('Discovery ≠ qualification','الاكتشاف لا يعني الاعتماد')}
      </span>
    </div>

    <div className="flex flex-wrap gap-2" role="group"
      aria-label={tx('Select research provider','اختيار مصدر البحث')}>
      {SOURCES.map(source=>(
        <button key={source.key} type="button"
          onClick={()=>{
            clearResults()
            setProvider(source.key)
            if(source.key==='places'&&query==='grain')setQuery('grain wholesaler exporter')
          }}
          aria-pressed={provider===source.key}
          className={'rounded-full border px-4 py-2 text-[12px] font-medium '+
            (provider===source.key?'border-ink bg-ink text-white':
              'border-line bg-card text-content hover:border-line-strong')}>
          {tx(source.en,source.ar)}
        </button>
      ))}
    </div>
    <p className="text-[11px] text-content-soft">
      {tx(currentSource.helpEn,currentSource.helpAr)}
    </p>

    <form onSubmit={event=>void search(event)}
      className="grid gap-3 rounded-lg border border-line bg-background p-3 sm:grid-cols-2 lg:grid-cols-12">
      {provider!=='comtrade'&&<label className="space-y-1 lg:col-span-4">
        <span className="nfii-label">{tx('Company or sector search','اسم الشركة أو القطاع')}</span>
        <input type="search" className="nfii-input" minLength={3} maxLength={85}
          value={query} onChange={event=>{clearResults();setQuery(event.target.value)}}
          placeholder={provider==='gleif'?'grain / dairy / company name':'rice exporter / wheat wholesaler'}
          required/>
      </label>}
      {provider!=='comtrade'&&<label className="space-y-1 lg:col-span-2">
        <span className="nfii-label">
          {tx(provider==='places'?'Country bias (ISO 2)':'Legal address country (ISO 2)',
            provider==='places'?'تفضيل الدولة':'دولة التسجيل')}
        </span>
        <input className="nfii-input uppercase" type="text" maxLength={2}
          placeholder="IN / QA / BR" value={country}
          onChange={event=>{clearResults();setCountry(event.target.value.toUpperCase())}}/>
      </label>}
      <label className={'space-y-1 '+(provider==='comtrade'?'lg:col-span-6':'lg:col-span-3')}>
        <span className="nfii-label">
          {tx(provider==='comtrade'?'Commodity (UN HS heading)':'Commodity context (not a company filter)',
            provider==='comtrade'?'السلعة الجمركية':'السلعة للسياق فقط')}
        </span>
        <select className="nfii-input" value={commodity}
          onChange={event=>{clearResults();setCommodity(event.target.value)}}>
          {COMMODITY_CATALOG.map(item=>(
            <option key={item.id} value={item.id}>
              {ar?item.nameAr:item.name}
            </option>
          ))}
        </select>
      </label>
      {provider==='comtrade'&&<label className="space-y-1 lg:col-span-3">
        <span className="nfii-label">{tx('Trade reporting year','سنة الإحصاءات')}</span>
        <select className="nfii-input" value={year}
          onChange={event=>{clearResults();setYear(event.target.value)}}>
          {['2025','2024','2023','2022'].map(item=><option key={item} value={item}>{item}</option>)}
        </select>
      </label>}
      <div className={'flex items-end '+(provider==='comtrade'?'lg:col-span-3':'lg:col-span-3')}>
        <button type="submit" disabled={loading||!canSearch}
          className="nfii-button w-full min-h-10 disabled:opacity-40">
          {loading?<Loader2 className="h-4 w-4 animate-spin"/>:
            <Search className="h-4 w-4"/>}
          {loading?tx('Searching…','جارٍ البحث…'):tx('Search global sources','البحث في المصادر')}
        </button>
      </div>
    </form>

    {provider==='comtrade'&&<p className="text-[11px] leading-relaxed text-content-soft">
      {tx('HS: ', 'رمز HS: ')}<strong>{HS_CODES[commodity]?.code}</strong>
      {' · '}{HS_CODES[commodity]?.label}.{' '}
      {tx('The preview can be limited or unavailable for selected years; do not interpret missing rows as no trade.',
        'قد تكون بيانات المعاينة محدودة أو غير متاحة لبعض السنوات؛ لا يعني غياب الصفوف انعدام التجارة.')}
    </p>}

    {error&&<div className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-warning-strong"
      role="alert">
      <strong>{tx('Live source unavailable: ','المصدر المباشر غير متاح: ')}</strong>
      {error}
      <p className="mt-1 text-[11px]">
        {tx('No company or country data has been replaced with fabricated values.',
          'لم تُستبدل بيانات الشركة أو الدولة بأي قيم افتراضية.')}
      </p>
    </div>}
    {!currentData&&!loading&&!error&&<div className="rounded-lg border border-line bg-muted/40 p-4 text-[12px] text-content-soft">
      {tx('Choose a source, enter search terms and press Search. External results are loaded only on demand.',
        'اختر مصدراً وأدخل كلمات البحث ثم اضغط بحث. تُجلب النتائج الخارجية عند الطلب فقط.')}
    </div>}

    {currentData&&currentData.provider!=='comtrade'&&(
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-medium text-content">
            <Building2 className="h-4 w-4 text-sage-700"/>
            {tx('Matching companies / business listings','الشركات والأنشطة المطابقة')}
          </h3>
          <span className="text-[11px] text-content-soft">
            {currentData.results.length} {tx('results','نتائج')}
            {' · '}{currentData.source}
          </span>
        </div>
        <p className="text-[11px] text-content-soft">{currentData.note}</p>
        {currentData.provider==='places'&&(
          <p className="text-[10px] text-content-soft">
            {tx('Business data © Google Maps. Results, contact information and reuse are subject to Google Maps Platform Terms.',
              'بيانات الأنشطة © Google Maps، والاستخدام وفق شروط Google Maps Platform.')}
          </p>
        )}
        {currentData.results.length?(
          <div className="grid gap-3 xl:grid-cols-2">
            {currentData.results.map(showCandidate)}
          </div>
        ):<p className="rounded-lg bg-muted p-3 text-[12px] text-content-soft">
          {tx('No matches from the selected provider. Broaden the query or remove the country filter. This does not prove suppliers do not exist.',
            'لا توجد نتائج للمصدر الحالي. وسّع البحث أو أزل فلتر الدولة؛ لا يعني ذلك عدم وجود موردين.')}
        </p>}
      </div>
    )}
    {currentData?.provider==='comtrade'&&(
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
              <Ship className="h-4 w-4 text-sage-700"/>
              {tx('Historical import origins for Qatar','مناشئ واردات قطر التاريخية')}
            </h3>
            <p className="mt-1 text-[11px] text-content-soft">
              {currentData.trade.year} · HS {currentData.trade.hsCode} · USD
              {' · '}{tx('National country statistics, not supplier-level transactions',
                'إحصاءات دولية حسب الدولة وليست معاملات موردين')}
            </p>
          </div>
          <a href={currentData.trade.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-sage-700 hover:underline">
            {tx('UN Comtrade source','مصدر UN Comtrade')}<ArrowUpRight className="h-3 w-3"/>
          </a>
        </div>
        {currentData.trade.limitedPreview&&<p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[11px] text-warning-strong">
          {tx('Limited public preview (up to 500 rows): the ranking may be incomplete. Do not treat displayed sums as national totals.',
            'المعاينة العامة محدودة حتى 500 صف؛ قد يكون الترتيب غير مكتمل ولا يمثل إجمالياً وطنياً.')}
        </p>}
        <div className="rounded-lg border border-line bg-background p-3">
          <p className="text-[11px] text-content-soft">
            {tx('Reported world import value, if published in this preview',
              'قيمة الواردات الإجمالية المنشورة إن توفرت')}
          </p>
          <p className="mt-1 text-[21px] font-medium tabular-nums text-content">
            {fmt(currentData.trade.worldTradeValueUsd)} <span className="text-[11px]">USD</span>
          </p>
        </div>
        {currentData.trade.partners.length?(
          <div className="space-y-2">
            {currentData.trade.partners.map((partner,index)=>{
              const max=currentData.trade.partners[0]?.tradeValueUsd??1
              const pct=max>0?Math.max(0,Math.min(100,(partner.tradeValueUsd??0)/max*100)):0
              return <div key={partner.partnerCode}
                className="grid gap-2 rounded-lg border border-line bg-background p-3 sm:grid-cols-[minmax(140px,.8fr)_minmax(120px,1fr)_minmax(125px,.75fr)] sm:items-center">
                <div>
                  <p className="text-[12px] font-medium text-content">
                    <span className="me-2 text-[10px] text-content-soft">{index+1}</span>
                    {partner.countryName}
                  </p>
                  <p className="text-[10px] text-content-soft">{partner.countryCode??'ISO unavailable'}</p>
                </div>
                <div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted" role="img"
                    aria-label={partner.countryName+': '+fmt(partner.tradeValueUsd)+' USD'}>
                    <div className="h-full rounded-full bg-sage-700"
                      style={{width:pct+'%'}}/>
                  </div>
                  <p className="mt-1 text-[10px] text-content-soft">
                    {tx('Bar scaled to largest displayed partner','الشريط نسبي لأعلى دولة ظاهرة')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-[12px] font-medium tabular-nums text-content">
                    {fmt(partner.tradeValueUsd)} USD
                  </span>
                  {partner.countryCode&&<button type="button"
                    className="rounded-full border border-line-accent px-2.5 py-1 text-[10px] text-sage-700"
                    onClick={()=>chooseOrigin(partner.countryCode!)}>
                    {tx('Search country entities','بحث كيانات الدولة')}
                  </button>}
                </div>
              </div>
            })}
          </div>
        ):<p className="rounded-lg bg-muted p-3 text-[12px] text-content-soft">
          {tx('No usable country breakdown returned for this year and HS code. Try a different year. No zero-trade conclusion is implied.',
            'لا توجد بيانات متاحة حسب الدولة لهذه السنة والسلعة. جرّب سنة أخرى ولا تفترض انعدام التجارة.')}
        </p>}
        <p className="text-[11px] leading-relaxed text-content-soft">
          {currentData.trade.note} {' '}
          {tx('Values are reported USD trade statistics, NOT supplier quotes or QAR/t prices.',
            'القيم بالدولار حسب الإحصاءات وليست عروض أسعار من الموردين أو أسعار ريال/طن.')}
        </p>
      </div>
    )}

    {shortlist.length>0&&<div className="rounded-lg border border-line-accent bg-cream-100/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-medium text-content">
          <ClipboardList className="h-4 w-4 text-sage-700"/>
          {tx('Research shortlist','قائمة مرشحي البحث')}
          <span className="text-[11px] text-content-soft">({shortlist.length}/25)</span>
        </h3>
        <div className="flex gap-2">
          <button type="button" onClick={()=>void copyShortlist()}
            className="rounded-full border border-line-accent px-3 py-1.5 text-[11px] font-medium text-sage-700">
            {tx('Copy shortlist','نسخ القائمة')}
          </button>
          <button type="button" onClick={()=>{setShortlist([]);setCopyNote('')}}
            className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[11px] text-content">
            <Trash2 className="h-3 w-3"/>{tx('Clear','مسح')}
          </button>
        </div>
      </div>
      {copyNote&&<p role="status" className="mt-2 text-[11px] text-sage-700">{copyNote}</p>}
      <ul className="mt-2 flex flex-wrap gap-2">
        {shortlist.map(row=><li key={candidateKey(row)}
          className="rounded-full border border-line bg-card px-3 py-1 text-[11px] text-content">
          {row.name}
        </li>)}
      </ul>
      <p className="mt-2 text-[10px] text-content-soft">
        {tx('Research notes in this browser only. Copy them before leaving; no vendor records are created.',
          'المرشحون موجودون في المتصفح فقط. انسخهم قبل المغادرة؛ لم تُنشأ سجلات موردين.')}
      </p>
    </div>}

    <div className="flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-content-soft">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sage-700"/>
      <p>{tx('Supplier onboarding remains a controlled workflow: verify legal identity, food-safety certificates, export capability, Qatar compliance, beneficial ownership, sanctions, bank details, offers and delivery terms independently. Preparing a draft does not approve a supplier or create a contract.',
        'تأهيل المورد عملية خاضعة للرقابة: تحقق من الهوية والتراخيص والشهادات الغذائية والتصدير والامتثال في قطر والملكية والعقوبات والحسابات والعروض وشروط التسليم بشكل مستقل. لا تعتمد المسودة مورداً ولا تُنشئ عقداً.')}
        {' '}<ShoppingBasket className="inline h-3.5 w-3.5 text-sage-700"/>
        {' '}<Check className="inline h-3.5 w-3.5 text-sage-700"/>
      </p>
    </div>
  </section>
}
