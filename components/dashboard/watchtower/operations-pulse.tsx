'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Boxes, ClipboardCheck, RefreshCw, Ship, ShoppingBag } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useI18n } from '@/lib/i18n'
import {
  reservePosition, operationalVolume, type OperationsResponse,
  type OperationsSnapshot,
} from '@/lib/nfii/operations-types'

function todayQatar(): string {
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Qatar',day:'2-digit',month:'2-digit',year:'numeric',
  }).formatToParts(new Date())
  const part=(t:string)=>parts.find(p=>p.type===t)?.value??''
  return part('year')+'-'+part('month')+'-'+part('day')
}
function pretty(n:number):string {
  return n.toLocaleString('en-US',{maximumFractionDigits:1})
}

/** Read only authorized tenant-scoped records, never synthetic demo fallbacks. */
export function WatchtowerOperationsPulse(){
  const {organization,loading:orgLoading}=useOrganization()
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const orgId=organization?.id??null
  const [snapshot,setSnapshot]=useState<OperationsSnapshot|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [refresh,setRefresh]=useState(0)
  const [truncated,setTruncated]=useState(false)

  useEffect(()=>{
    setSnapshot(null);setError('');setTruncated(false)
    if(!orgId||orgLoading){setLoading(false);return}
    const controller=new AbortController()
    const run=async()=>{
      setLoading(true)
      try {
        const response=await fetch('/api/nfii/operations?'+new URLSearchParams({organizationId:orgId}),{
          cache:'no-store',signal:controller.signal,
        })
        const body:(Partial<OperationsResponse>&{error?:string})=await response.json()
        if(!response.ok)throw Error(body.error??'Operational source unavailable')
        if(body.organizationId!==orgId||body.scope!=='organization'||!body.snapshot)
          throw Error('Unexpected operational data scope')
        if(!controller.signal.aborted){
          setSnapshot(body.snapshot)
          setTruncated((body.limits?.truncated.length??0)>0)
        }
      }catch(err){
        if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Unavailable')
      }finally{if(!controller.signal.aborted)setLoading(false)}
    }
    void run()
    return ()=>controller.abort()
  },[orgId,orgLoading,refresh])

  const activeSnapshot=snapshot

  const metrics=useMemo(()=>{
    if(!activeSnapshot)return null
    const reserve=reservePosition(activeSnapshot,todayQatar())
    return {
      approvedSuppliers:activeSnapshot.suppliers.filter(r=>r.status==='approved').length,
      approvedOrders:activeSnapshot.purchaseOrders.filter(r=>r.status==='approved').length,
      inTransit:activeSnapshot.shipments.filter(r=>r.status==='in_transit'||r.status==='delayed').length,
      pendingApprovals:activeSnapshot.approvals.filter(r=>r.status==='pending').length,
      physicalReserveTonnes:reserve.availablePhysicalTonnes,
      uncommittedTonnes:reserve.uncommittedTonnes,
      orderedTonnes:activeSnapshot.purchaseOrders.filter(r=>r.status==='approved')
        .reduce((sum,r)=>sum+operationalVolume(r.ordered_tonnes),0),
    }
  },[activeSnapshot])

  const modules=[
    {
      href:'/dashboard/procurement',en:'Procurement',ar:'المشتريات',
      detailEn:'Supplier → contract → approved purchase order',
      detailAr:'المورد ← العقد ← أمر الشراء المعتمد',icon:ShoppingBag,
      value:metrics?String(metrics.approvedOrders):null,
      unitEn:'approved orders',unitAr:'أوامر معتمدة',
    },
    {
      href:'/dashboard/logistics',en:'Logistics',ar:'الخدمات اللوجستية',
      detailEn:'Approved order → shipment → delivery event',
      detailAr:'أمر معتمد ← الشحنة ← إثبات التسليم',icon:Ship,
      value:metrics?String(metrics.inTransit):null,
      unitEn:'active / delayed',unitAr:'نشطة / متأخرة',
    },
    {
      href:'/dashboard/reserves',en:'Strategic reserves',ar:'الاحتياطيات الاستراتيجية',
      detailEn:'Delivered shipment → approved lot → release',
      detailAr:'شحنة مستلمة ← دفعة معتمدة ← صرف',icon:Boxes,
      value:metrics?pretty(metrics.uncommittedTonnes):null,
      unitEn:'t uncommitted',unitAr:'طن غير مخصص',
    },
  ] as const

  return (
    <section id="watchtower-operations" aria-label={tx('Supply chain operations', 'عمليات سلسلة الإمداد')}
      className="nfii-panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="nfii-label !text-content-accent">{snapshot?tx('OPERATIONS / SOURCE-BACKED','العمليات / مصادر موثقة'):tx('OPERATIONS / SOURCE UNAVAILABLE','العمليات / المصدر غير متاح')}</p>
          <h2 className="mt-1 text-[18px] font-semibold text-content">
            {tx('Operational supply network', 'شبكة الإمداد التشغيلية')}
          </h2>
          <p className="mt-1 text-[11px] text-content-soft">
            {tx(
              'Connected records across purchasing, shipment tracking, warehouses and approved reserve movements.',
              'سجلات مترابطة للمشتريات وتتبع الشحنات والمستودعات وحركات المخزون المعتمدة.'
            )}
          </p>
        </div>
        <button type="button" className="nfii-button nfii-button-secondary"
          onClick={()=>setRefresh(n=>n+1)} disabled={loading||!orgId}>
          <RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/>
          {tx('Refresh records','تحديث السجلات')}
        </button>
      </div>

      {truncated&&<p role="status" className="mt-3 text-[11px] text-warning-strong">
        {tx('Records exceed the per-table display limit; summary totals may be incomplete.',
          'تجاوزت السجلات حد العرض؛ قد تكون الإجماليات غير مكتملة.')}
      </p>}
      {orgLoading||loading?(
        <p role="status" className="mt-4 text-[12px] text-content-soft">
          {tx('Loading operational data…','جارٍ تحميل البيانات التشغيلية…')}
        </p>
      ):(
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-accent bg-muted px-2.5 py-1.5 text-[10px] text-content-accent">
            <ClipboardCheck className="h-3.5 w-3.5"/>
            {metrics?.pendingApprovals??'—'} {tx('pending independent approvals','موافقات مستقلة معلقة')}
          </span>
          <span className="inline-flex items-center rounded-full border border-line bg-muted px-2.5 py-1.5 text-[10px] text-content">
            {tx('Physical reserve balance: ','رصيد المخزون الفعلي: ')}
            {metrics?pretty(metrics.physicalReserveTonnes):'—'} t
          </span>
        </div>
      )}

      {!orgId&&!orgLoading&&<p role="status" className="mt-3 rounded-md border border-line p-3 text-[11px] text-content-soft">
        {tx('Choose an authorized organization. No sample orders, shipments or reserve numbers are displayed.',
          'اختر مؤسسة مصرحاً لها؛ لن تُعرض أوامر أو شحنات أو احتياطيات تجريبية.')}
      </p>}
      {error&&<p role="alert" className="mt-3 rounded-md border border-warning-line p-3 text-[11px] text-warning-strong">
        {error}
      </p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {modules.map(item=>{
          const Icon=item.icon
          return <Link key={item.href} href={item.href}
            className="nfii-subpanel group flex min-h-[125px] flex-col justify-between p-3.5 hover:border-line-accent">
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-5 w-5 text-content-accent" strokeWidth={1.5}/>
              <ArrowUpRight className="h-4 w-4 text-content-soft group-hover:text-content-accent"/>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-[13px] font-semibold text-content">{tx(item.en,item.ar)}</p>
                <span className="font-mono text-[15px] text-content-accent">
                  {item.value??'—'}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-content-soft">{tx(item.unitEn,item.unitAr)}</p>
              <p className="mt-2 text-[11px] text-content-soft">{tx(item.detailEn,item.detailAr)}</p>
            </div>
          </Link>
        })}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-content-soft">
        {tx(
          'Figures come only from authorized organization records. No customs API or live port telemetry is connected. Missing values remain unknown.',
          'تأتي الأرقام من سجلات المؤسسة المصرح بها فقط. لا يوجد ربط جمركي أو مباشر بالميناء؛ تبقى القيم المفقودة غير معروفة.'
        )}
      </p>
    </section>
  )
}
