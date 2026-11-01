'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight, ArrowUpRight, Bot, Database, FileCheck2,
  RefreshCw, ShieldCheck, Ship, ShoppingBasket, Warehouse,
} from 'lucide-react'
import { PageHeader } from '@/components/brand/layout'
import { FoodSourceIntake } from '@/components/dashboard/food-source-intake'
import { CommodityAgentLab } from '@/components/dashboard/commodity-agent-lab'
import { CommodityBalanceCharts } from '@/components/dashboard/commodity-balance-charts'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useCommodityCase } from '@/hooks/use-commodity-case'
import { useI18n } from '@/lib/i18n'
import { COMMODITY_CATALOG, resolveCommodity } from '@/lib/platform/commodity-catalog'
import { linkCommodityOperations } from '@/lib/nfii/commodity-links'
import type { FoodBalanceResult } from '@/lib/food-security/balance'
import { operationalVolume } from '@/lib/nfii/operations-types'

type View='overview'|'agents'|'sources'

function number(n:number|null|undefined,digits=1):string {
  return n===null||n===undefined||!Number.isFinite(n)?'—':
    n.toLocaleString('en-US',{maximumFractionDigits:digits})
}

function riskFor(balance:FoodBalanceResult|null):'critical'|'high'|'attention'|'stable'|'unknown' {
  if(!balance||balance.status!=='complete')return 'unknown'
  if((balance.totals.deficitTonnes??0)>0 ||
      (balance.totals.projectedCoverageDays??Infinity)<7)return 'critical'
  if((balance.totals.projectedCoverageDays??Infinity)<14)return 'high'
  if((balance.totals.projectedCoverageDays??Infinity)<30)return 'attention'
  return 'stable'
}

export function CommodityWorkspace(){
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const query=useSearchParams()
  const {goToModule}=useOperationalContext()
  const commodity=resolveCommodity(query.get('commodityId')||query.get('commodity'))??COMMODITY_CATALOG[0]
  const [days,setDays]=useState<7|30|90|180>(30)
  const [view,setView]=useState<View>(query.get('view')==='agents'?'agents':'overview')
  const {
    balance,operations,
    organization,organizationId,organizationLoading,loading,foodError,operationsError,
    hasVerifiedBalance,hasLiveOperations,refresh,today,
  }=useCommodityCase(commodity.id,days)

  useEffect(()=>{
    if(query.get('view')==='agents')setView('agents')
  },[query])

  const links=useMemo(()=>linkCommodityOperations(commodity.id,operations,today),
    [commodity.id,operations,today])
  const risk=riskFor(balance)
  const riskLabels={
    critical:[tx('Critical screening','مؤشر حرج'),'text-critical bg-warning-soft border-warning-line'],
    high:[tx('High exposure','مخاطر مرتفعة'),'text-warning-strong bg-warning-soft border-warning-line'],
    attention:[tx('Watch closely','تحتاج إلى مراقبة'),'text-content bg-muted border-line'],
    stable:[tx('No period-end alert','لا يوجد تنبيه بنهاية الفترة'),'text-sage-700 bg-cream-100 border-line-accent'],
    unknown:[tx('Not assessed','غير مقيّم'),'text-content-soft bg-muted border-line'],
  } satisfies Record<ReturnType<typeof riskFor>,[string,string]>

  const total=balance?.totals
  const metrics=[
    {en:'End-of-period usable stock',ar:'المخزون المتاح بنهاية الفترة',
      value:total?.projectedClosingStockTonnes,unit:'t',
      noteEn:'Remaining after the modeled flows',noteAr:'المتبقي بعد التدفقات المحسوبة'},
    {en:'Consumption for this period',ar:'الاستهلاك خلال هذه الفترة',
      value:total?.consumptionTonnes,unit:'t',
      noteEn:'Period total, not daily consumption',noteAr:'الإجمالي للفترة وليس يومياً'},
    {en:'Estimated days of coverage',ar:'أيام التغطية المتوقعة',
      value:total?.projectedCoverageDays,unit:tx('days','يوم'),
      noteEn:'Period-end stock / average daily demand',
      noteAr:'مخزون نهاية الفترة / متوسط الطلب اليومي'},
    {en:'Potential supply deficit',ar:'العجز المحتمل في الإمدادات',
      value:total?.deficitTonnes,unit:'t',
      noteEn:'Estimated shortfall, not purchase instruction',
      noteAr:'العجز المتوقع وليس أمراً بالشراء'},
  ]

  const equation=[
    {en:'Opening stock',ar:'المخزون الافتتاحي',value:total?.openingStockTonnes,op:''},
    {en:'Domestic production',ar:'الإنتاج المحلي',value:total?.domesticProductionTonnes,op:'+'},
    {en:'Imported supply',ar:'الواردات',value:total?.confirmedImportsTonnes,op:'+'},
    {en:'Consumption',ar:'الاستهلاك',value:total?.consumptionTonnes,op:'−'},
    {en:'Expected loss',ar:'الفاقد',value:total?.lossesTonnes,op:'−'},
    {en:'Net balance',ar:'الرصيد الصافي',value:total?.projectedBalanceTonnes,op:'='},
  ]

  const tabs:Array<{id:View;en:string;ar:string;icon:typeof Bot}>=[
    {id:'overview',en:'Situation & supply chain',ar:'الوضع وسلسلة الإمداد',icon:ShoppingBasket},
    {id:'agents',en:'Agent operations simulation',ar:'محاكاة عمليات الوكلاء',icon:Bot},
    {id:'sources',en:'Evidence & source records',ar:'المصادر والأدلة',icon:Database},
  ]

  const handleSelect=(id:string)=>{
    setView('overview')
    goToModule('commodities',{commodityId:id})
  }

  return <main className="growa h-full overflow-y-auto bg-background text-content">
    <div className="mx-auto max-w-[1550px] space-y-5 p-4 pb-12 md:p-6">
      <PageHeader
        eyebrow={tx('Food security / Commodity intelligence','الأمن الغذائي / معلومات السلع')}
        title={tx('Commodity intelligence','معلومات السلع')}
        subtitle={tx(
          'Understand supply, demand, exposure and available response options for one commodity at a time.',
          'فهم العرض والطلب والمخاطر وخيارات الاستجابة لسلعة واحدة في كل مرة.'
        )}
        actions={<Link href="/dashboard?module=watchtower"
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[12px] text-content hover:bg-muted">
          {tx('Back to Watchtower','العودة إلى برج المراقبة')}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true"/>
        </Link>}
        className="!mb-1"
      />

      <section aria-label={tx('Commodity selection','اختيار السلعة')}
        className="rounded-xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[.09em] text-content-soft">
              {tx('Selected commodity','السلعة المختارة')}
            </p>
            <h2 className="mt-1 text-[24px] font-light text-content">
              {ar?commodity.nameAr:commodity.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-content-soft">
              {tx('Horizon','الفترة')}
              <select value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90|180)}
                className="ms-2 rounded-lg border border-line-strong bg-card px-3 py-2 text-[12px] text-content"
                aria-label={tx('Analysis horizon','فترة التحليل')}>
                {[7,30,90,180].map(day=><option key={day} value={day}>{day} {tx('days','يوم')}</option>)}
              </select>
            </label>
            <button type="button" aria-label={tx('Refresh sources','تحديث المصادر')}
              onClick={refresh} disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-card text-content disabled:opacity-40">
              <RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {COMMODITY_CATALOG.map(item=>(
            <button type="button" key={item.id} onClick={()=>handleSelect(item.id)}
              aria-pressed={item.id===commodity.id}
              className={'rounded-full border px-3 py-2 text-[12px] font-medium transition-colors '+
                (item.id===commodity.id
                  ?'border-ink bg-ink text-white'
                  :'border-line bg-card text-content hover:border-line-strong')}>
              {ar?item.nameAr:item.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11px] text-content-soft">
          <span className={'inline-flex rounded-full border px-2.5 py-1 font-medium '+
            (hasVerifiedBalance?'border-line-accent bg-cream-100 text-sage-700':
              'border-warning-line bg-warning-soft text-warning-strong')}>
            {hasVerifiedBalance?tx('REVIEWED ORGANIZATION SOURCES','مصادر المؤسسة المراجعة'):
              tx('VERIFIED DATA INCOMPLETE','البيانات الموثقة غير مكتملة')}
          </span>
          <span>{balance?.fromDate??today} → {balance?.toDate??'—'}</span>
          {organization?.name&&<span>· {organization.name}</span>}
        </div>
      </section>

      {loading&&<p role="status" className="text-[12px] text-content-soft">
        {tx('Checking available organization sources…','جارٍ التحقق من مصادر المؤسسة…')}
      </p>}
      {(!balance||balance.status!=='complete')&&(
        <div className="rounded-lg border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
          <strong>{tx('Verified source data are incomplete.','بيانات المصادر الموثقة غير مكتملة.')}</strong>
          <p className="mt-1 text-content-soft">{foodError||
            tx('A complete opening stock and four flow declarations are required. Missing data do not mean zero supply.',
              'يلزم مخزون افتتاحي وتدفقات إنتاج وواردات واستهلاك وفاقد مكتملة. نقص البيانات لا يعني صفراً.')}
          </p>
        </div>
      )}

      <nav className="flex flex-wrap gap-2 rounded-xl border border-line bg-card p-2"
        aria-label={tx('Commodity intelligence sections','أقسام معلومات السلع')}>
        {tabs.map(item=>{
          const Icon=item.icon
          return <button type="button" key={item.id} onClick={()=>setView(item.id)}
            aria-pressed={view===item.id}
            className={'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-medium '+
              (view===item.id?'border-ink bg-ink text-white':
                'border-line bg-card text-content hover:border-line-strong')}>
            <Icon className="h-4 w-4" strokeWidth={1.6}/>
            {tx(item.en,item.ar)}
          </button>
        })}
      </nav>

      {view==='overview'&&(
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            aria-label={tx('Main commodity indicators','المؤشرات الأساسية للسلعة')}>
            {metrics.map(item=>(
              <div key={item.en} className="rounded-xl border border-line bg-card p-4">
                <p className="text-[11px] font-medium text-content-soft">{tx(item.en,item.ar)}</p>
                <p className="mt-3 text-[26px] font-light tabular-nums text-content">
                  {number(item.value)} <span className="text-[11px] text-content-soft">{item.unit}</span>
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-content-soft">{tx(item.noteEn,item.noteAr)}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-line bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[16px] font-medium text-content">
                  {tx('Food balance explained','شرح الميزان الغذائي')}
                </h3>
                <p className="mt-1 text-[12px] text-content-soft">
                  {tx('For the selected period, measured in metric tonnes (t).',
                    'للفترة المحددة بوحدة الطن المتري.')}
                </p>
              </div>
              <span className={'rounded-full border px-3 py-1 text-[11px] font-medium '+riskLabels[risk][1]}>
                {riskLabels[risk][0]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {equation.map(item=>(
                <div key={item.en} className={'rounded-lg border p-3 '+
                  (item.op==='='?'border-line-accent bg-cream-100':'border-line bg-background')}>
                  <div className="flex items-center gap-2 text-[11px] text-content-soft">
                    {item.op&&<strong className="text-[16px] text-sage-700">{item.op}</strong>}
                    {tx(item.en,item.ar)}
                  </div>
                  <p className="mt-2 text-[19px] font-medium tabular-nums text-content">
                    {number(item.value)} <span className="text-[10px] text-content-soft">t</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-content-soft">
              {tx('Net balance can be negative. Usable closing stock never goes below zero; the difference is reported as a shortage. Days of coverage measure stock at period end, not the first day a shortage might occur.',
                'قد يكون الرصيد الصافي سالباً. لا ينخفض المخزون المتاح عن الصفر؛ يُسجل الفرق كعجز. أيام التغطية تقيس مخزون نهاية الفترة ولا تحدد أول يوم قد يحدث فيه نقص.')}
            </p>
          </section>

          <CommodityBalanceCharts balance={balance}/>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(290px,.7fr)]">
            <section className="rounded-xl border border-line bg-card p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-medium text-content">
                  {tx('Connected commodity supply chain','سلسلة الإمداد المرتبطة بالسلعة')}
                </h3>
                <span className="text-[11px] text-content-soft">
                  {tx('Organization records','سجلات المؤسسة')}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-content-soft">
                {tx('Procurement contracts, delivered shipments and reserve lots may describe the same goods. These records are NOT added to the food balance.',
                  'قد تشير العقود والشحنات والدفعات إلى البضائع نفسها؛ لا تُضاف مرة أخرى إلى الميزان الغذائي.')}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {href:'/dashboard/procurement',icon:ShoppingBasket,
                    en:'Procurement',ar:'المشتريات',
                    total:links.approvedOrderTonnes,unit:'t',
                    detail:tx(links.contracts.length+' contracts · '+links.suppliers.length+' suppliers',
                      links.contracts.length+' عقود · '+links.suppliers.length+' موردون')},
                  {href:'/dashboard/logistics',icon:Ship,
                    en:'Logistics',ar:'الخدمات اللوجستية',
                    total:links.deliveredTonnes,unit:'t',
                    detail:tx(links.activeShipments+' active · '+links.delayedShipments+' delayed',
                      links.activeShipments+' نشطة · '+links.delayedShipments+' متأخرة')},
                  {href:'/dashboard/reserves',icon:Warehouse,
                    en:'Strategic reserves',ar:'الاحتياطي الاستراتيجي',
                    total:links.availableReserveTonnes,unit:'t',
                    detail:tx(links.lots.length+' linked lots · '+links.committedReleaseTonnes+' t reserved',
                      links.lots.length+' دفعات · '+number(links.committedReleaseTonnes)+' طن مخصصة')},
                ].map(item=>{
                  const Icon=item.icon
                  return <Link key={item.href} href={item.href}
                    className="group rounded-lg border border-line bg-background p-3 transition-colors hover:border-line-strong">
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-4 w-4 text-sage-700"/>
                      <ArrowUpRight className="h-3.5 w-3.5 text-content-soft group-hover:text-sage-700"/>
                    </div>
                    <p className="mt-3 text-[12px] font-medium text-content">{tx(item.en,item.ar)}</p>
                    <p className="mt-1 text-[22px] tabular-nums text-content">
                      {number(item.total)} <span className="text-[10px] text-content-soft">{item.unit}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-content-soft">{item.detail}</p>
                  </Link>
                })}
              </div>

              <h4 className="mt-5 text-[12px] font-medium text-content">
                {tx('Linked organization records','سجلات المؤسسة المرتبطة')}
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[540px] text-[12px]">
                  <thead><tr className="border-b border-line text-start text-[10px] uppercase tracking-wide text-content-soft">
                    <th className="px-2 py-2 text-start">{tx('Record','السجل')}</th>
                    <th className="px-2 py-2 text-start">{tx('Reference','المرجع')}</th>
                    <th className="px-2 py-2 text-start">{tx('State','الحالة')}</th>
                    <th className="px-2 py-2 text-end">{tx('Quantity (t)','الكمية (طن)')}</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ...links.contracts.slice(0,2).map(row=>({kind:tx('Contract','عقد'),
                        ref:row.contract_ref,status:row.status,quantity:row.contracted_tonnes})),
                      ...links.shipments.slice(0,2).map(row=>({kind:tx('Shipment','شحنة'),
                        ref:row.shipment_ref,status:row.status,quantity:row.shipment_tonnes})),
                      ...links.lots.slice(0,2).map(row=>({kind:tx('Lot','دفعة'),
                        ref:row.lot_ref,status:row.status,quantity:row.received_tonnes})),
                    ].map((row,index)=>(
                      <tr key={index} className="border-b border-line/60">
                        <td className="px-2 py-2.5 text-content">{row.kind}</td>
                        <td className="px-2 py-2.5 font-mono text-[11px] text-content-soft">{row.ref??'—'}</td>
                        <td className="px-2 py-2.5 text-content-soft">{row.status?.replaceAll('_',' ')??'—'}</td>
                        <td className="px-2 py-2.5 text-end tabular-nums">{number(operationalVolume(row.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {links.contracts.length+links.shipments.length+links.lots.length===0&&(
                  <p className="p-3 text-[12px] text-content-soft">
                    {tx('No operational records for this commodity. Do not infer zero physical stock.',
                      'لا توجد سجلات تشغيلية لهذه السلعة؛ لا يُستنتج أن المخزون صفر.')}
                  </p>
                )}
              </div>
            </section>

            <aside className="space-y-3">
              <div className="rounded-xl border border-line bg-card p-4">
                <h3 className="text-[14px] font-medium text-content">
                  {tx('What needs attention?','ما الذي يحتاج إلى اهتمام؟')}
                </h3>
                <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-content-soft">
                  {balance?.status!=='complete'?(
                    <p>{tx('Source evidence is incomplete. Ask the Data Quality Agent to check missing stock or flows.',
                      'الأدلة غير مكتملة؛ يجب مراجعة المخزون والتدفقات مع وكيل جودة البيانات.')}</p>
                  ):(risk==='critical'||risk==='high')?(
                    <p>{tx('Coverage is limited or a shortfall is projected. Stress-test import and demand shocks before considering options.',
                      'التغطية محدودة أو يوجد عجز متوقع؛ اختبر صدمات الاستيراد والطلب قبل دراسة البدائل.')}</p>
                  ):(
                    <p>{tx('No period-end shortage under these assumptions. Check the evidence and keep monitoring lead times.',
                      'لا يظهر عجز بنهاية الفترة وفق هذه الافتراضات؛ تحقق من الأدلة وراقب أوقات التوريد.')}
                    </p>
                  )}
                  {links.delayedShipments>0&&<p>
                    {links.delayedShipments} {tx('shipment(s) flagged delayed. Confirm status with logistics.',
                      'شحنات متأخرة؛ تحقق من حالتها مع الخدمات اللوجستية.')}
                  </p>}
                  {links.pendingApprovals>0&&<p>
                    {links.pendingApprovals} {tx('related entries awaiting independent review.',
                      'سجلات مرتبطة تنتظر مراجعة مستقلة.')}
                  </p>}
                  {operationsError&&<p className="text-warning-strong">
                    {tx('Operational data unavailable: ','البيانات التشغيلية غير متاحة: ')}{operationsError}
                  </p>}
                </div>
                <button type="button" onClick={()=>setView('agents')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[12px] font-medium text-white">
                  <Bot className="h-4 w-4"/>
                  {tx('Run agent response simulation','تشغيل محاكاة استجابة الوكلاء')}
                  <ArrowRight className="h-3.5 w-3.5"/>
                </button>
              </div>
              <div className="rounded-xl border border-line bg-card p-4">
                <h3 className="flex items-center gap-2 text-[14px] font-medium text-content">
                  <FileCheck2 className="h-4 w-4 text-sage-700"/>
                  {tx('Data confidence','موثوقية البيانات')}
                </h3>
                <p className="mt-2 text-[12px] text-content-soft">
                  {balance?.status==='complete'
                    ?tx('Reviewed balance inputs, not national certification',
                      'مدخلات ميزان مُراجعة وليست اعتماداً وطنياً')
                    :tx('Incomplete verified evidence','أدلة موثقة غير مكتملة')}
                </p>
                <p className="mt-2 text-[11px] text-content-soft">
                  {tx('Balance source references','مراجع مصادر الميزان')}: {balance?.evidence.sourceRefs.length??0}
                </p>
                <button type="button" onClick={()=>setView('sources')}
                  className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-sage-700 hover:underline">
                  {tx('Inspect sources','فحص المصادر')}
                  <ArrowUpRight className="h-3.5 w-3.5"/>
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {view==='agents'&&(
        <CommodityAgentLab balance={balance} operations={operations} today={today}/>
      )}

      {view==='sources'&&(
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-card p-4 md:p-5">
            <h2 className="flex items-center gap-2 text-[16px] font-medium text-content">
              <ShieldCheck className="h-4 w-4 text-sage-700"/>
              {tx('Source transparency','شفافية المصادر')}
            </h2>
            <p className="mt-2 text-[12px] text-content-soft">
              {tx('Only reviewed organization records enter the food balance. Missing sources stay unavailable, never replaced with synthetic values.',
                'تدخل سجلات المؤسسة المُراجعة فقط في الميزان الغذائي. لا تُستبدل البيانات المفقودة بأرقام مصطنعة.')}
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-3">
                <dt className="text-[11px] text-content-soft">{tx('Food source mode','نوع مصدر الغذاء')}</dt>
                <dd className="mt-1 text-[13px] font-medium text-content">
                  {hasVerifiedBalance?tx('Supabase, reviewed','Supabase، بيانات مراجعة'):tx('Incomplete or unavailable','غير مكتمل أو غير متاح')}
                </dd>
              </div>
              <div className="rounded-lg border border-line p-3">
                <dt className="text-[11px] text-content-soft">{tx('Operational registry','السجل التشغيلي')}</dt>
                <dd className="mt-1 text-[13px] font-medium text-content">
                  {hasLiveOperations?tx('Supabase organization records','سجلات المؤسسة من Supabase'):
                      tx('Not connected','غير متصل')}
                </dd>
              </div>
            </dl>
            {balance?.evidence.sourceRefs.length?(
              <details className="mt-4 rounded-lg border border-line bg-muted/30 p-3">
                <summary className="cursor-pointer text-[12px] font-medium text-content">
                  {tx('View food balance source references','عرض مراجع بيانات الميزان')}
                </summary>
                <ul className="mt-2 list-disc space-y-1 ps-4 text-[11px] text-content-soft">
                  {balance.evidence.sourceRefs.slice(0,15).map(ref=><li key={ref} className="break-all">{ref}</li>)}
                </ul>
              </details>
            ):<p className="mt-3 text-[12px] text-content-soft">
              {tx('No food balance records in this source.', 'لا توجد مصادر بيانات للميزان.')}
            </p>}
            {balance?.evidence.missingCoverage.length?(
              <p className="mt-2 text-[12px] text-warning-strong">
                {tx('Missing flow coverage: ','تغطية التدفقات الناقصة: ')}
                {balance.evidence.missingCoverage.join(', ')}
              </p>
            ):null}
          </section>
          {organizationLoading||loading ? (
            <p className="text-[12px] text-content-soft">{tx('Loading organization source access…','جارٍ تحميل صلاحيات المصادر…')}</p>
          ):organizationId?(
            <FoodSourceIntake organizationId={organizationId} commodityId={commodity.id}
              onRecordsChanged={refresh}/>
          ):(
            <div className="rounded-xl border border-line bg-card p-4 text-[12px] text-content-soft">
              {tx('Source intake and approval require an authorized organization. Source gaps must be resolved with verified records.',
                'يلزم وجود مؤسسة مصرح لها وإدخال سجلات موثقة لاستكمال المصادر.')}
            </div>
          )}
        </div>
      )}
    </div>
  </main>
}
