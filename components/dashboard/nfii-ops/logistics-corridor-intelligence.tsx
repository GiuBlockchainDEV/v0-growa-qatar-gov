'use client'

import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import dynamic from 'next/dynamic'
import {BarChart3,ExternalLink,Globe2,Loader2,
  Route as RouteIcon,ShieldAlert} from 'lucide-react'
import {COMMODITY_CATALOG} from '@/lib/platform/commodity-catalog'
import {CARGO_SPECS,getExportHub} from '@/lib/nfii/logistics-lanes'
import type {ScreenedRoute} from '@/lib/nfii/logistics-screening'
import type {RouteMapOverlay} from '@/lib/nfii/logistics-route-map'
import type {SecurityIntelligence} from '@/lib/nfii/logistics-security'
import {previewRouteMapOverlays} from '@/lib/nfii/logistics-route-map'
import type {OperationsSnapshot} from '@/lib/nfii/operations-types'
import type {SupplierOriginReport,SupplierOriginScope,SupplierOrigin} from '@/lib/nfii/logistics-supplier-origins'
import {useI18n} from '@/lib/i18n'

const LogisticsRouteMap=dynamic(
  ()=>import('./logistics-route-map').then(module=>module.LogisticsRouteMap),
  {ssr:false,loading:()=> <div className="h-[360px] animate-pulse rounded-lg bg-muted/30 md:h-[440px]"/>},
)

type ModelResponse={
  context:{commodity:string;country:string;countryName:string;tonnes:number;
    deliveryDeadlineDays:number;product:string;productClass:string;coldChain:boolean;
    handling:string;importDestination:string}
  routes:ScreenedRoute[]
  mapRoutes:RouteMapOverlay[]
  securityIntelligence:SecurityIntelligence
  sourceStatus:{searoutes:string;worldBank:string;marineWeather:string;googleRoad:string}
  sources:{searoutes:string|null;worldBank:string|null;marineWeather:string|null;googleRoad:string|null}
  dataWarnings:string[]
  riskContext:{originLpi:number|null;lpiYear:number|null;
    waveHeightMaxMeters:number|null;worldBankStatus:string;weatherStatus:string}
  regionalHazards:{state:'available'|'unavailable';alerts:Array<{id:string;label:string;severity:string;near:string;distanceKm:number;sourceUrl:string}>;observedAt:string;sourceUrl:string}
  freightBenchmark:{status:string;message:string;quoteStatus:string;
    estimate:{amountMinQar:number;amountMaxQar:number;
      perKgMinQar:number;perKgMaxQar:number;daysMin:number|null;
      daysMax:number|null;checkedAt:string;sourceUrl:string}|null}
  pricesDisclaimer:string;scheduleDisclaimer:string;riskDisclaimer:string
  generatedAt:string;bookingAvailable:false
}
const format=(n:number|null,dp=1)=>n===null?'N/A':
  n.toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp})
type ShipmentChoice={id:string;title:string;country:string;commodity:string;tonnes:number}

export function LogisticsCorridorIntelligence({
  organizationId,operations,isPreview,
}:{
  organizationId:string|null
  operations:OperationsSnapshot
  isPreview:boolean
}){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [crop,setCrop]=useState('rice')
  const [country,setCountry]=useState('')
  const [scope,setScope]=useState<SupplierOriginScope>('documented')
  const [originReport,setOriginReport]=useState<SupplierOriginReport|null>(null)
  const [originsLoading,setOriginsLoading]=useState(false)
  const [originError,setOriginError]=useState('')
  const [tonnes,setTonnes]=useState('20')
  const [deadline,setDeadline]=useState('60')
  const [seaRate,setSeaRate]=useState('')
  const [airRate,setAirRate]=useState('')
  const [roadRate,setRoadRate]=useState('')
  const [data,setData]=useState<ModelResponse|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [selected,setSelected]=useState<string|null>(null)
  const [previewSelected,setPreviewSelected]=useState<string|null>('sea_direct')
  const current=useRef<AbortController|null>(null)
  const [orderId,setOrderId]=useState('')
  const orders:ShipmentChoice[]=(isPreview?[]:operations.purchaseOrders)
    .filter(order=>order.status==='approved').flatMap(order=>{
      const contract=operations.contracts.find(c=>c.id===order.contract_id)
      const supplier=operations.suppliers.find(s=>s.id===contract?.supplier_id)
      if(!contract||!supplier||!contract.commodity_code||
        !CARGO_SPECS[contract.commodity_code]||
        !getExportHub(supplier.country_code??''))return []
      return [{id:order.id,title:order.order_ref??order.id.slice(0,8),
        country:supplier.country_code!,commodity:contract.commodity_code,
        tonnes:Number(order.ordered_tonnes??0)}]
    })
    .filter(o=>o.tonnes>0&&o.tonnes<=200)

  const eligible:SupplierOrigin[]=(originReport?.countries??[]).filter(row=>
    row.logisticHubAvailable&&row.countryCode!=='QA'&&
    (scope==='approved'?row.approvedCount>0:row.documentedCount>0))
  const unsupported=(originReport?.countries??[]).filter(row=>
    row.countryCode!=='QA'&&!row.logisticHubAvailable&&
    (scope==='approved'?row.approvedCount>0:row.documentedCount>0))
  useEffect(()=>{
    const controller=new AbortController()
    setOriginReport(null)
    setOriginsLoading(true)
    setOriginError('')
    const params=new URLSearchParams({commodity:crop,
      ...(organizationId?{organizationId}:{})})
    void fetch('/api/nfii/logistics/supplier-origins?'+params,{
      signal:controller.signal,cache:'no-store',
    }).then(async response=>{
      const body=await response.json() as SupplierOriginReport&{error?:string}
      if(!response.ok)throw Error(body.error??'Supplier-country source unavailable')
      if(controller.signal.aborted)return
      setOriginReport(body)
      const available=body.countries.filter(row=>row.logisticHubAvailable&&
        row.countryCode!=='QA'&&
        (scope==='approved'?row.approvedCount>0:row.documentedCount>0))
      setCountry(previous=>available.some(x=>x.countryCode===previous)?
        previous:available[0]?.countryCode??'')
    }).catch(e=>{
      if(controller.signal.aborted)return
      setCountry('')
      setOriginError(e instanceof Error?e.message:'Supplier source unavailable')
    }).finally(()=>{if(!controller.signal.aborted)setOriginsLoading(false)})
    return ()=>controller.abort()
  },[crop,organizationId,scope])

  useEffect(()=>()=>current.current?.abort(),[])
  const clear=()=>{
    current.current?.abort()
    current.current=null
    setBusy(false);setData(null);setError('');setSelected(null)
  }
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault()
    if(originsLoading||!eligible.some(row=>row.countryCode===country)){
      setError('No eligible crop-specific supplier in the chosen country.')
      return
    }
    clear()
    const controller=new AbortController()
    current.current=controller
    setBusy(true)
    const params=new URLSearchParams({
      commodity:crop,country,tonnes,limitDays:deadline,supplierScope:scope,
      ...(organizationId?{organizationId}:{}),
      ...(seaRate?{seaRate}:{}),...(airRate?{airRate}:{}),
      ...(roadRate?{roadRate}:{}),
    })
    try{
      const response=await fetch('/api/nfii/logistics/corridors?'+params,{
        cache:'no-store',signal:controller.signal,
      })
      const body=await response.json() as ModelResponse&{error?:string}
      if(!response.ok)throw Error(body.error??'Route assessment unavailable')
      if(!controller.signal.aborted){
        setData(body);setSelected(body.routes[0]?.id??null)
      }
    }catch(reason){
      if(!controller.signal.aborted)setError(reason instanceof Error?
        reason.message:'Unknown provider error')
    }finally{if(!controller.signal.aborted)setBusy(false)}
  }
  const displayedMapRoutes=useMemo(()=>data?.mapRoutes??previewRouteMapOverlays(country),[data,country])
  const chosen=data?.routes.find(r=>r.id===selected)
  const maxTime=Math.max(...(data?.routes.map(r=>r.estimatedDays??0)??[]),1)
  const quoted=data?.routes.filter(r=>r.freightTotalQar!==null)??[]
  const maxCost=Math.max(...quoted.map(r=>r.freightQarKg??0),.001)

  return <section aria-label={tx('Food import corridor intelligence','تحليل مسارات استيراد الأغذية')}
    className="nfii-panel space-y-4 p-4 md:p-5">
    <header className="space-y-1">
      <div className="flex items-center gap-2 text-sage-700">
        <RouteIcon className="h-5 w-5"/>
        <h2 className="text-[19px] font-semibold text-content">
          {tx('Global food transport corridor screening','فحص مسارات نقل الغذاء العالمية')}
        </h2>
      </div>
      <p className="text-[12px] leading-relaxed text-content-soft">
        {tx('Compare possible sea, air and regional road corridors into Qatar. Transport quotes, schedules, border access and real shipments are NOT automatically confirmed.',
          'مقارنة طرق بحرية وجوية وبرية محتملة إلى قطر. الأسعار والجداول والتصاريح تحتاج إلى تأكيد مستقل.')}
      </p>
    </header>
    <form onSubmit={e=>void submit(e)} className="space-y-3 rounded-lg border border-line bg-background p-4">
      {orders.length>0&&<label className="block space-y-1">
        <span className="nfii-label">{tx('Optional: link research inputs to approved purchase order','اختياري: ربط بيانات البحث بأمر شراء معتمد')}</span>
        <select className="nfii-input" value={orderId} onChange={e=>{
          const value=e.target.value,set=orders.find(x=>x.id===value)
          setOrderId(value)
          if(set){setScope('approved');setCrop(set.commodity);setCountry(set.country);setTonnes(String(set.tonnes));
            setDeadline(String(CARGO_SPECS[set.commodity]?.maxTransitDays??15))}
          clear()
        }}>
          <option value="">{tx('Independent scenario (no shipment created)','دراسة مستقلة، دون إنشاء شحنة')}</option>
          {orders.map(order=><option key={order.id} value={order.id}>
            {order.title} · {order.commodity} · {order.country} · {format(order.tonnes)} t
          </option>)}
        </select>
      </label>}
      <div className="rounded-lg border border-line-accent bg-cream-100/20 p-3 space-y-2">
        <label className="flex flex-wrap items-center gap-2 text-[12px] text-content">
          <strong>{tx('Supplier source','مصدر الموردين')}</strong>
          <select className="nfii-input min-h-9" value={scope}
            onChange={e=>{
              setScope(e.target.value as SupplierOriginScope)
              setCountry('');setOrderId('');clear()
            }}>
            <option value="documented">{tx('Find Suppliers · crop-specific published candidates','مرشحون منشورون للمحصول')}</option>
            <option value="approved" disabled={!organizationId||isPreview}>
              {tx('Approved suppliers · approved current crop contracts','موردون معتمدون بعقود سارية')}
            </option>
          </select>
        </label>
        <p className="text-[11px] text-content-soft">
          {tx('Only countries with crop-specific supplier records are available. Historic Qatar imports or a port are not proof of an available supplier.',
            'تظهر فقط الدول التي تحتوي على موردين مرتبطين بالمحصول.')}
        </p>
        {originsLoading&&<p role="status" className="text-[11px] text-content-soft">
          {tx('Loading supplier countries…','تحميل دول الموردين…')}
        </p>}
        {originError&&<p role="alert" className="text-[11px] text-critical">{originError}</p>}
        {!originsLoading&&!originError&&scope==='approved'&&
          originReport?.sources.approvedLedger==='unavailable'&&
          <p role="alert" className="text-[11px] text-critical">
            {tx('Approved register is unavailable or incomplete; supplier count is unknown.',
              'سجل الموردين المعتمدين غير متاح أو غير مكتمل.')}
          </p>}
        {!originsLoading&&!originError&&!eligible.length&&<p role="status"
          className="text-[11px] text-warning-strong">
          {tx('No supported countries have matching suppliers for this crop. Find suppliers or approve a matching crop contract in Procurement.',
            'لا توجد دول بها موردون مطابقون. ابحث عن موردين أو اعتمد عقداً مطابقاً.')}
        </p>}
        {unsupported.length>0&&<p className="text-[11px] text-content-soft">
          {tx('Supplier origins without configured logistics gateways: ','دول بها موردون دون بوابة شحن: ')}
          {unsupported.map(x=>x.countryName).join(', ')}
        </p>}
        {originReport?.localQatar&&<p className="text-[11px] text-content-soft">
          {tx('Qatar-based suppliers require domestic delivery planning, not international import routes.',
            'موردو قطر يحتاجون إلى تخطيط تسليم محلي وليس مسار استيراد دولي.')}
        </p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1"><span className="nfii-label">{tx('Food product','المنتج الغذائي')}</span>
          <select className="nfii-input" value={crop} onChange={e=>{
            setCrop(e.target.value);setCountry('');setDeadline(String(CARGO_SPECS[e.target.value]?.maxTransitDays??15));
            setOrderId('');clear()}}>
            {COMMODITY_CATALOG.filter(item=>Boolean(CARGO_SPECS[item.id])).map(item=>
              <option key={item.id} value={item.id}>{ar?item.nameAr:item.name}</option>)}
          </select></label>
        <label className="space-y-1"><span className="nfii-label">
          {tx('Countries with matching crop suppliers','دول بها موردون للمحصول')}
        </span>
          <select className="nfii-input" value={country}
            disabled={originsLoading||eligible.length===0}
            onChange={e=>{setCountry(e.target.value);setOrderId('');clear()}}>
            {!eligible.length&&<option value="">{tx('No supplier-supported origins','لا توجد دول مدعومة بموردين')}</option>}
            {eligible.map(row=><option key={row.countryCode} value={row.countryCode}>
              {row.countryName} · {scope==='approved'?row.approvedCount:row.documentedCount}
              {' '}{tx('suppliers','موردون')}
            </option>)}
          </select></label>
        <label className="space-y-1"><span className="nfii-label">{tx('Shipment tonnes','طن الشحنة')}</span>
          <input className="nfii-input" type="number" min=".1" max="200" step=".1"
            required value={tonnes} onChange={e=>{setTonnes(e.target.value);clear()}}/>
        </label>
        <label className="space-y-1"><span className="nfii-label">{tx('Target days to Qatar','المدة المستهدفة إلى قطر')}</span>
          <input className="nfii-input" type="number" min="1" max="120" step="1"
            required value={deadline} onChange={e=>{setDeadline(e.target.value);clear()}}/>
        </label>
      </div>
      <div>
        <h3 className="text-[12px] font-semibold text-content">
          {tx('Optional carrier / forwarder rates · QAR per tonne','أسعار الشحن الاختيارية بالريال للطن')}
        </h3>
        <p className="text-[10px] text-content-soft">
          {tx('Leave blank until you have quotes; no fictional freight prices will be shown.',
            'اتركها فارغة إذا لم تتوفر عروض نقل حقيقية.')}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([
            ['Sea',seaRate,setSeaRate],['Air',airRate,setAirRate],
            ['Road',roadRate,setRoadRate],
          ] as const).map(([label,value,set])=>
            <label className="space-y-1" key={label}>
              <span className="nfii-label">{label}</span>
              <input className="nfii-input" type="number" min=".01" max="99999"
                step=".01" placeholder={tx('Quote','Preventivo')} value={value}
                onChange={e=>{set(e.target.value);clear()}}/>
            </label>)}
        </div>
      </div>
      <button type="submit" disabled={busy||originsLoading||Boolean(originError)||!country||!eligible.length}
        className="nfii-button inline-flex min-h-10 items-center gap-2">
        {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<BarChart3 className="h-4 w-4"/>}
        {busy?tx('Evaluating corridors…','جارٍ تقييم المسارات…'):
          tx('Compare transport options','مقارنة خيارات النقل')}
      </button>
    </form>
    {error&&<p role="alert" className="rounded-md border border-warning-line bg-warning-soft p-3 text-[12px] text-critical">{error}</p>}
    {!data&&!busy&&!error&&<p className="rounded-md bg-muted/20 p-3 text-[12px] text-content-soft">
      {tx('Choose a product, country and quantity, then compare transport options. No costs or routes are prefilled as real.',
        'حدد المنتج والبلد والكمية، ثم قارن وسائل النقل.')}
    </p>}
    <div className="rounded-lg border border-line bg-card p-3 md:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-content">
                  {tx('Interactive import route map · origin to Qatar','خريطة تفاعلية لمسارات الاستيراد إلى قطر')}
                </h3>
                <p className="text-[11px] text-content-soft">
                  {tx('Sea routes follow SeaRoutes or the modeled ocean network. Dashed air routes show only the geographic great-circle reference, not an airline flight path or schedule.',
                    'المسارات البحرية من مزود أو شبكة محيطية محسوبة؛ والمسار الجوي المتقطع مرجع جغرافي فقط، وليس رحلة أو جدولاً مؤكداً.')}
                </p>
              </div>
              <span className="rounded-full border border-line px-2.5 py-1 text-[10px] text-content-soft">
                {displayedMapRoutes.filter(r=>r.mode==='sea'&&r.paths.length>0).length} {tx('sea paths','مسارات بحرية')}
                {' · '}
                {displayedMapRoutes.filter(r=>r.mode==='air'&&r.paths.length>0).length} {tx('air references','مراجع جوية')}
              </span>
            </div>
            <LogisticsRouteMap routes={displayedMapRoutes} selectedId={data?selected:previewSelected}
              onSelect={id=>data?setSelected(id):setPreviewSelected(id)} locale={ar?'ar':'en'}/>
          </div>
    {data&&<div className="space-y-4">
      {data.mapRoutes.filter(route=>route.mode==='sea').every(route=>route.paths.length===0)&&
        <p role="status" className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
          {tx('No maritime geometry was calculated for this port pair. This is a routing-data limitation, not proof that sea transport is impossible.',
            'لم يتم حساب مسار بحري لهذه الموانئ؛ هذا لا يعني أن الشحن غير ممكن.')}
          {data.dataWarnings.filter(v=>/ocean|SeaRoutes/i.test(v)).length>0&&
            <span className="mt-1 block text-[11px] text-content-soft">
              {data.dataWarnings.filter(v=>/ocean|SeaRoutes/i.test(v)).join(' · ')}
            </span>}
        </p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line p-3">
          <p className="text-[10px] text-content-soft">World Bank Logistics Performance Index</p>
          <strong className="text-[16px] text-content">
            {data.riskContext.originLpi===null?'N/A':
              format(data.riskContext.originLpi,2)+' / 5'}
          </strong>
          <p className="text-[10px] text-content-soft">
            {data.riskContext.lpiYear??
              tx('No country benchmark','لا يوجد مؤشر وطني')}
            {' · '}{tx('National, historical; not route-specific','وطني وتاريخي')}
          </p>
        </div>
        <div className="rounded-md border border-line p-3">
          <p className="text-[10px] text-content-soft">
            {tx('Origin-port maximum forecast wave','أعلى موج متوقع في ميناء المصدر')}
          </p>
          <strong className="text-[16px] text-content">
            {data.riskContext.waveHeightMaxMeters===null?'N/A':
              format(data.riskContext.waveHeightMaxMeters,1)+' m'}
          </strong>
          <p className="text-[10px] text-content-soft">
            {tx('Port grid only, not the full voyage','في نقطة الميناء فقط')}
          </p>
        </div>
        <div className="rounded-md border border-line p-3">
          <p className="text-[10px] text-content-soft">
            {tx('Requested delivery window','المدة المستهدفة')}
          </p>
          <strong className="text-[16px] text-content">
            {data.context.deliveryDeadlineDays} {tx('days','أيام')}
          </strong>
          <p className="text-[10px] text-content-soft">
            {data.routes.find(r=>r.mode==='sea')?.estimatedDays===null?
              tx('Sailing feasibility unknown','المدة البحرية غير معروفة'):
              tx('Compare sailing estimate with port and customs delays','أضف وقت الميناء والجمارك')}
          </p>
        </div>
      </div>
      {data.freightBenchmark.estimate&&<div className="rounded-lg border border-line-accent bg-cream-100/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-content">
            {tx('Freightos marketplace freight benchmark · dry 40-foot container',
              'مرجع تكلفة الشحن البحري لحاوية جافة ٤٠ قدماً')}
          </h3>
          <a href={data.freightBenchmark.estimate.sourceUrl} target="_blank"
            rel="noopener noreferrer" className="text-[11px] text-sage-700 underline">
            {tx('Freightos source','المصدر: Freightos')} <ExternalLink className="inline h-3 w-3"/>
          </a>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><p className="text-[10px] text-content-soft">QAR/kg</p>
            <strong className="text-[17px] tabular-nums text-content">
              {format(data.freightBenchmark.estimate.perKgMinQar,3)} –
              {' '}{format(data.freightBenchmark.estimate.perKgMaxQar,3)}
            </strong></div>
          <div><p className="text-[10px] text-content-soft">{tx('Full shipment freight QAR','تكلفة الشحن بالريال')}</p>
            <strong className="text-[17px] tabular-nums text-content">
              {format(data.freightBenchmark.estimate.amountMinQar,0)} –
              {' '}{format(data.freightBenchmark.estimate.amountMaxQar,0)}
            </strong></div>
          <div><p className="text-[10px] text-content-soft">{tx('Marketplace transit range','مدة النقل المرجعية')}</p>
            <strong className="text-[17px] tabular-nums text-content">
              {data.freightBenchmark.estimate.daysMin===null?'N/A':
                data.freightBenchmark.estimate.daysMin+'–'+data.freightBenchmark.estimate.daysMax+
                ' '+tx('days','أيام')}
            </strong></div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-content-soft">
            {tx('Marketplace cost interval · QAR/kg','نطاق الأسعار المرجعي')}
          </span>
          <div className="h-3 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sage-600" style={{width:'100%'}}/>
          </div>
          <span className="text-[11px] tabular-nums text-content">
            {format(data.freightBenchmark.estimate.perKgMinQar,3)}–{format(data.freightBenchmark.estimate.perKgMaxQar,3)}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-content-soft">
          {tx('Non-binding marketplace estimate, not a confirmed carrier quote. Applies only to the dry-container scenario. Excludes reefer, inland drayage, customs, insurance and local handling.',
            'تقدير سوقي غير ملزم لحاوية جافة فقط ولا يشمل التخليص والرسوم والتأمين والتبريد.')}
        </p>
      </div>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          {label:tx('Corridor scenarios','سيناريوهات الطرق'),value:String(data.routes.length)},
          {label:tx('Food requirement','متطلبات الغذاء'),value:data.context.coldChain?
            tx('Temperature controlled','تبريد'):tx('Dry / ambient','جاف')},
          {label:tx('Sea routes provider','مزود الطريق البحري'),
            value:data.sourceStatus.searoutes==='available'?'SeaRoutes':
              data.sourceStatus.searoutes==='estimated'?'Ocean network · estimate':'Unavailable'},
          {label:tx('Carrier freight rates','أسعار نقل من الشركات'),
            value:quoted.length?String(new Set(quoted.map(r=>r.mode)).size)+' supplied':tx('None supplied','غير متوفرة')},
        ].map(item=><div key={item.label} className="rounded-md border border-line bg-background p-3">
          <p className="text-[10px] text-content-soft">{item.label}</p>
          <strong className="mt-1 block text-[13px] text-content">{item.value}</strong>
        </div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-line p-3">
          <h3 className="text-[12px] font-semibold text-content">
            {tx('Observed GDACS regional hazards','مخاطر GDACS الإقليمية')}
          </h3>
          <p className="mt-1 text-[10px] text-content-soft">
            {tx('Recent GDACS red/orange alerts within 400 km of the origin gateway or Qatar. Not a route-wide disruption forecast.',
              'تنبيهات GDACS القريبة ولا تمثل توقعات المخاطر على المسار كاملاً.')}
          </p>
          {data.regionalHazards.state==='unavailable'?
            <p className="mt-3 text-[12px] text-warning-strong">{tx('Source unavailable · risk unknown','المصدر غير متاح')}</p>:
            data.regionalHazards.alerts.length?
            <div className="mt-3 space-y-2">
              {data.regionalHazards.alerts.map(alert=><div key={alert.id}
                className="rounded-md border border-warning-line bg-warning-soft p-2 text-[11px]">
                <strong>{alert.severity.toUpperCase()}</strong> · {alert.label}
                <a className="ms-2 text-sage-700 underline" href={alert.sourceUrl}
                  rel="noopener noreferrer" target="_blank">GDACS</a>
              </div>)}
            </div>:
            <p className="mt-3 text-[12px] text-content">
              {tx('No nearby orange/red point alerts detected in this query. This does NOT establish a safe route.',
                'لم توجد تنبيهات قريبة؛ هذا لا يثبت أن المسار آمن.')}
            </p>}
          <p className="mt-3 text-[10px] text-content-soft">
            {tx('Pending verification: operator schedule, cargo insurance, transshipments, border access and cold chain.',
              'تحتاج المواعيد والتأمين والعبور والتبريد إلى التحقق.')}
          </p>
        </div>
        <div className="rounded-md border border-line p-3">
          <h3 className="text-[12px] font-semibold text-content">
            {tx('Estimated transit days · sea and air','مدة النقل التقديرية · بحري وجوي')}
          </h3>
          <p className="mt-1 text-[10px] text-content-soft">
            {tx('Sea: SeaRoutes or ocean grid at 14 knots, excludes port handling. Air: geodesic / 750 km/h + 24h handling + 6h buffer. NOT verified carrier ETAs.',
              'بحري: تقدير SeaRoutes أو شبكة بحرية. جوي: المسافة / 750 كم في الساعة + 24 ساعة مناولة + 6 ساعات احتياطية، وليست مواعيد مؤكدة.')}
          </p>
          <div className="mt-3 space-y-2">
            {data.routes.map(route=><div key={route.id}
              className="grid grid-cols-[105px_1fr_46px] items-center gap-2">
              <span className="truncate text-[11px]">{route.mode} {route.via?'via '+route.via.split(' ')[0]:''}</span>
              <div className="h-3 rounded-full bg-muted">
                {route.estimatedDays!==null&&<div className="h-full rounded-full bg-sage-600"
                  style={{width:route.estimatedDays/maxTime*100+'%'}}/>}
              </div>
              <span className="text-right text-[11px] tabular-nums">
                {route.estimatedDays===null?'N/A':format(route.estimatedDays)}
              </span>
            </div>)}
          </div>
        </div>
      </div>
      <div className="rounded-md border border-line p-3">
        <h3 className="text-[12px] font-semibold text-content">
          {tx('Security exposure index · 0–100 (NOT a probability)','مؤشر التعرض الأمني من 100 وليس احتمالاً')}
        </h3>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('Relative weighted exposure based on active EASA CZIB, Hormuz AIS crossings, UKMTO incidents and GDACS. It is NOT a percentage chance of disruption.',
            'مؤشر نسبي مبني على EASA وبيانات عبور هرمز وUKMTO وGDACS، وليس احتمال وقوع حادث.')}
        </p>
        <div className="mt-3 space-y-3">
          {data.routes.map(route=><div key={route.id} className="space-y-1">
            <div className="flex flex-wrap justify-between gap-2 text-[12px]">
              <span>{route.mode.toUpperCase()} · {route.from} → Qatar</span>
              <strong className="tabular-nums">
                {route.exposure.index===null?'N/A':route.exposure.index+'/100'}
                {' · '}{route.exposure.label.replaceAll('_',' ')}
              </strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              {route.exposure.index!==null&&<div className="h-full bg-warning-strong"
                style={{width:route.exposure.index+'%'}}/>}
            </div>
            <p className="text-[10px] text-content-soft">
              {route.mode==='sea'?(route.exposure.hormuzExposure?
                tx('Hormuz crossing required by geographic scenario','عبور مضيق هرمز مطلوب'):
                tx('No compulsory Hormuz crossing for this reference port','لا يتطلب ميناء المصدر عبور هرمز')):
                route.mode==='air'?tx('Actual airspace closure NOT verified; EASA CZIB is an advisory','إغلاق المجال الجوي غير مؤكد'):
                tx('Border access unverified','عبور الحدود غير مؤكد')}
            </p>
            {route.exposure.evidence.slice(0,3).map((reason,i)=>
              <p key={route.id+'-'+i} className="text-[10px] text-content-soft">
                {reason}
              </p>)}
            <div className="flex flex-wrap gap-2">
              {route.exposure.sources.map(source=><a key={source} href={source} target="_blank"
                rel="noopener noreferrer" className="text-[10px] text-sage-700 underline">
                {new URL(source).hostname}
              </a>)}
            </div>
          </div>)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line p-2">
            <strong className="text-[11px]">Hormuz AIS · {data.securityIntelligence.maritime.state}</strong>
            <p className="text-[11px]">
              {data.securityIntelligence.maritime.crossings24h??'N/A'} {'crossings / 24h'}
              {' · '}
              {data.securityIntelligence.maritime.trafficDropPct===null?'N/A':
                data.securityIntelligence.maritime.trafficDropPct+'% decline against 30d daily average'}
            </p>
            <p className="text-[10px] text-content-soft">
              {'UKMTO 30d incidents: '}{data.securityIntelligence.maritime.incidentCount30d??'N/A'}
              {' · attacks: '}{data.securityIntelligence.maritime.attackCount30d??'N/A'}
              {' · observed incident/crossing ratio: '}
              {data.securityIntelligence.maritime.incidentPerCrossingPct===null?'N/A':
                data.securityIntelligence.maritime.incidentPerCrossingPct+'% (NOT an incident probability)'}
            </p>
            <a href={data.securityIntelligence.maritime.sourceUrl} target="_blank"
              rel="noopener noreferrer" className="text-[10px] text-sage-700 underline">AIS source</a>
            {' · '}<a href={data.securityIntelligence.maritime.incidentSourceUrl} target="_blank"
              rel="noopener noreferrer" className="text-[10px] text-sage-700 underline">UKMTO</a>
          </div>
          <div className="rounded-md border border-line p-2">
            <strong className="text-[11px]">EASA CZIB · {data.securityIntelligence.aviation.state}</strong>
            <p className="text-[11px]">
              {data.securityIntelligence.aviation.notices.filter(n=>n.countries.includes('QA')).length}
              {' active advisories covering Qatar; actual closure NOT verified'}
            </p>
            <a href={data.securityIntelligence.aviation.sourceUrl} target="_blank"
              rel="noopener noreferrer" className="text-[10px] text-sage-700 underline">EASA source</a>
          </div>
        </div>
      </div>
      <div className="rounded-md border border-line p-3">
        <h3 className="text-[12px] font-semibold text-content">
          {tx('Quoted freight costs · QAR/kg','تكاليف الشحن المقدمة · ريال/كغ')}
        </h3>
        {quoted.length?<div className="mt-3 space-y-2">
          {quoted.map(route=><div key={route.id}
            className="grid grid-cols-[115px_1fr_70px] items-center gap-2">
            <span className="truncate text-[11px]">{route.mode} {route.via?'via '+route.via.split(' ')[0]:''}</span>
            <div className="h-3 rounded-full bg-muted"><div
              className="h-full rounded-full bg-sage-600"
              style={{width:(route.freightQarKg??0)/maxCost*100+'%'}}/></div>
            <span className="text-right text-[11px] tabular-nums">{format(route.freightQarKg,3)}</span>
          </div>)}
        </div>:<p className="mt-2 text-[11px] text-content-soft">
          {tx('No actual freight quote entered. QAR/kg remains N/A rather than an invented price.',
            'لا يوجد عرض سعر شحن مدخل. لا يتم إنشاء أسعار غير حقيقية.')}
        </p>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[740px] text-left text-[11px]">
          <thead className="bg-muted/30"><tr>
            <th className="p-2">{tx('Corridor','المسار')}</th>
            <th className="p-2">{tx('Method','الوسيلة')}</th>
            <th className="p-2 text-right">{tx('Distance km','المسافة كم')}</th>
            <th className="p-2 text-right">{tx('Days','الأيام')}</th>
            <th className="p-2 text-right">{tx('QAR/kg','ريال/كغ')}</th>
            <th className="p-2 text-right">{tx('Risk','المخاطر')}</th>
            <th className="p-2">{tx('Evidence','الدليل')}</th>
            <th className="p-2">{tx('Inspect','تفاصيل')}</th>
          </tr></thead>
          <tbody>{data.routes.map(route=><tr key={route.id} className="border-t border-line">
            <td className="p-2 text-content">{route.from} → Qatar</td>
            <td className="p-2 capitalize">{route.mode}{route.via?' via hub':''}</td>
            <td className="p-2 text-right tabular-nums">{route.distanceType==='straight_line_lower_bound'?(route.mode==='sea'?'N/A':'≥'+format(route.distanceKm,0)):format(route.distanceKm,0)}</td>
            <td className="p-2 text-right tabular-nums">{format(route.estimatedDays)}</td>
            <td className="p-2 text-right tabular-nums">{format(route.freightQarKg,3)}</td>
            <td className="p-2 text-right">{route.exposure.index===null?'N/A':route.exposure.index+'/100'} · {route.exposure.label.replaceAll('_',' ')}</td>
            <td className="p-2">{route.quality==='route_api'?
              route.sourceUrl?.includes('arcnautical')?'Ocean network estimate':'Routing API evidence':'Unverified itinerary'}</td>
            <td className="p-2"><button type="button"
              onClick={()=>setSelected(route.id)}
              className="font-medium text-sage-700 underline">{tx('Details','تفاصيل')}</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {chosen&&<div className="rounded-lg border border-line-accent bg-cream-100/20 p-4">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-content">
          <Globe2 className="h-4 w-4 text-sage-700"/>
          {chosen.from} → {chosen.to}
          {chosen.via?' · '+chosen.via:''}
        </h3>
        <p className="mt-1 text-[11px] text-content-soft">
          {chosen.timeBasis} · {chosen.distanceType.replaceAll('_',' ')}
          {chosen.quality==='model_only'&&<span className="ms-2 font-semibold text-warning-strong">
            {tx('Unverified transport itinerary','مسار نقل غير مؤكد')}
          </span>}
        </p>
        <p className="mt-2 text-[12px] text-content">
          {tx('If quoted, freight for this shipment:','تكلفة النقل إن وجد عرض سعر:')}
          {' '}{chosen.freightTotalQar===null?'N/A':
            format(chosen.freightTotalQar,2)+' QAR'}
        </p>
        <p className="mt-1 text-[11px] text-content-soft">
          {tx('Includes only the entered carrier rate. Excludes duties, inland drayage, cold storage, demurrage, insurance and spoilage.',
            'يشمل سعر الناقل المدخل فقط، لا الرسوم أو التأمين أو التخزين أو التلف.')}
        </p>
        <ul className="mt-3 space-y-1">
          {chosen.riskDrivers.map(message=><li key={message}
            className="flex gap-2 text-[11px] text-content-soft">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-strong"/>
            {message}
          </li>)}
        </ul>
        <p className="mt-2 text-[11px] font-medium text-content">
          {chosen.reeferRequired?tx('Cold-chain controls required','يتطلب تبريداً'):
            tx('Ambient transport possible subject to SKU','يمكن النقل الجاف حسب المنتج')}
          {' · '}{chosen.storageNote}
        </p>
        {chosen.sourceUrl&&<a href={chosen.sourceUrl} rel="noopener noreferrer"
          target="_blank" className="mt-2 inline-flex items-center gap-1 text-[11px] text-sage-700 underline">
          {tx('Routing data provider','مصدر بيانات المسار')}<ExternalLink className="h-3 w-3"/>
        </a>}
      </div>}
      <div className="rounded-md border border-warning-line bg-warning-soft p-3 text-[11px] text-content">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4 text-warning-strong"/>
          {tx('Planning analysis, not a freight booking','تحليل تخطيطي وليس حجز شحن')}
        </p>
        <p className="mt-1">{data.pricesDisclaimer} {data.scheduleDisclaimer}</p>
        <p className="mt-1">{data.freightBenchmark.message}</p>
        <p className="mt-1">{data.riskDisclaimer}</p>
        <p className="mt-2 text-content-soft">
          {tx('Source availability: ','توفر المصادر: ')}
          SeaRoutes {data.sourceStatus.searoutes} · World Bank LPI {data.sourceStatus.worldBank} ·
          Marine forecast {data.sourceStatus.marineWeather} ·
          Google Routes {data.sourceStatus.googleRoad} ·
          EASA {data.securityIntelligence.aviation.state} · Hormuz AIS {data.securityIntelligence.maritime.state} ·
          Freightos {data.freightBenchmark.status}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.values(data.sources).filter((v):v is string=>Boolean(v)).map(url=>
            <a href={url} target="_blank" rel="noopener noreferrer" key={url}
              className="inline-flex items-center gap-1 text-sage-700 underline">
              {new URL(url).hostname}<ExternalLink className="h-3 w-3"/>
            </a>)}
        </div>
      </div>
    </div>}
  </section>
}
