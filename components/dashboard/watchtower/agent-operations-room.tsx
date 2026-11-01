'use client'

import Link from 'next/link'
import { Bot, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { CommodityAgentLab } from '@/components/dashboard/commodity-agent-lab'
import { useCommodityCase } from '@/hooks/use-commodity-case'
import { useI18n } from '@/lib/i18n'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'

/**
 * Dedicated entry point from Watchtower, reusing the exact same commodity
 * balance, linked-operations join and read-only multi-agent simulator.
 */
export function WatchtowerAgentOperationsRoom() {
  const {locale}=useI18n()
  const ar=locale==='ar'
  const tx=(en:string,arabic:string)=>ar?arabic:en
  const [commodityId,setCommodityId]=useState('rice')
  const [days,setDays]=useState<7|30|90|180>(30)
  const {
    balance,operations,
    hasVerifiedBalance,organizationId,loading,foodError,refresh,today,
  }=useCommodityCase(commodityId,days)

  const detailHref='/dashboard?'+new URLSearchParams({
    module:'commodities',commodityId,view:'agents',
    ...(organizationId?{organizationId}:{}),
  })

  return <div id="watchtower-agents" className="space-y-4">
    <div className="nfii-panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-cream-100 p-2.5">
            <Bot className="h-5 w-5 text-sage-700" aria-hidden="true"/>
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-sage-700">
              {tx('AI operating model / rehearsal','النموذج التشغيلي للوكلاء / محاكاة')}
            </p>
            <h2 className="mt-1 text-[19px] font-medium text-content">
              {tx('Specialist agent response room','غرفة استجابة الوكلاء المتخصصين')}
            </h2>
            <p className="mt-1 max-w-[72ch] text-[12px] text-content-soft">
              {tx('Select a commodity and explore how NFII specialists would work together from evidence verification through supply chain assessment and human approval.',
                'اختر سلعة واستكشف تعاون وكلاء NFII من التحقق من الأدلة إلى تقييم سلسلة الإمداد والموافقة البشرية.')}
            </p>
          </div>
        </div>
        <Link href={detailHref}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-card px-4 py-2 text-[12px] text-content hover:bg-muted">
          {tx('Open commodity intelligence','فتح معلومات السلعة')}
          <ArrowUpRight className="h-4 w-4"/>
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <label className="flex flex-col gap-1 text-[11px] text-content-soft">
          {tx('Commodity','السلعة')}
          <select className="min-h-9 min-w-[165px] rounded-lg border border-line-strong bg-card px-3 text-[12px] text-content"
            value={commodityId} onChange={event=>setCommodityId(event.target.value)}>
            {COMMODITY_CATALOG.map(item=><option key={item.id} value={item.id}>
              {ar?item.nameAr:item.name}
            </option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-content-soft">
          {tx('Analysis horizon','فترة التحليل')}
          <select className="min-h-9 rounded-lg border border-line-strong bg-card px-3 text-[12px] text-content"
            value={days} onChange={event=>setDays(Number(event.target.value) as 7|30|90|180)}>
            {[7,30,90,180].map(day=><option key={day} value={day}>{day} {tx('days','يوم')}</option>)}
          </select>
        </label>
        <button type="button" onClick={refresh} disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line-strong px-3 text-[12px] text-content disabled:opacity-40">
          <RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/>
          {tx('Refresh','تحديث')}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-content-soft">
        {hasVerifiedBalance?tx(
          'Organization commodity balance loaded. Agent coordination is read-only until a human approves execution.',
          'تم تحميل ميزان السلعة للمؤسسة. تنسيق الوكلاء للقراءة فقط حتى موافقة بشرية على التنفيذ.'
        ):tx(
          'Commodity balance is still loading or incomplete for this horizon.',
          'ميزان السلعة ما زال قيد التحميل أو غير مكتمل لهذه الفترة.'
        )}
        {foodError&&<span className="mt-1 block text-warning-strong">{foodError}</span>}
      </p>
    </div>

    <CommodityAgentLab balance={balance} operations={operations} today={today}/>
  </div>
}
