'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, FlaskConical, RefreshCw, RotateCcw } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useI18n } from '@/lib/i18n'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import type { FoodBalanceResult } from '@/lib/food-security/balance'
import {
  calculateFoodScenario,
  ZERO_FOOD_SCENARIO,
  type FoodScenarioAdjustments,
} from '@/lib/food-security/scenario'

const SCENARIO_CONTROLS: {
  key: keyof FoodScenarioAdjustments
  en: string
  ar: string
}[] = [
  { key: 'productionReductionPercent', en: 'Domestic production shortfall', ar: 'نقص الإنتاج المحلي' },
  { key: 'importReductionPercent', en: 'Confirmed import disruption', ar: 'تعطل الواردات المؤكدة' },
  { key: 'demandIncreasePercent', en: 'Demand increase', ar: 'زيادة الطلب' },
  { key: 'openingStockLossPercent', en: 'Opening inventory loss', ar: 'فقد المخزون الافتتاحي' },
]

function fmt(value: number | null | undefined, fractionDigits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: fractionDigits }).format(value)
}

interface BalanceResponse {
  balance?: FoodBalanceResult
  dataSource?: string
  error?: string
}

/**
 * Read-only sensitivity analysis on reviewed live balances only.
 * Missing sources remain unavailable; no sample food inventory fallback.
 */
export function WatchtowerScenarioRoom() {
  const { organization, loading: orgLoading } = useOrganization()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const tx = (en: string, arabic: string) => ar ? arabic : en
  const organizationId = organization?.id ?? null
  const [commodityId, setCommodityId] = useState(COMMODITY_CATALOG[0].id)
  const [days, setDays] = useState<7 | 30 | 90 | 180>(30)
  const [adjustments, setAdjustments] = useState<FoodScenarioAdjustments>({
    ...ZERO_FOOD_SCENARIO,
  })
  const [liveBalance, setLiveBalance] = useState<FoodBalanceResult | null>(null)
  const [loadedOrg, setLoadedOrg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLiveBalance(null)
    setLoadedOrg(null)
    setError(null)
    if (!organizationId || orgLoading) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const load = async () => {
      try {
        const search = new URLSearchParams({
          organizationId,
          commodityId,
          days: String(days),
          mode: 'live',
        })
        const response = await fetch('/api/food-security/balance?' + search.toString(), {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload: BalanceResponse = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Verified balance unavailable')
        if (!payload.balance || payload.dataSource !== 'LIVE' ||
            payload.balance.sourceMode !== 'live' ||
            payload.balance.commodityId !== commodityId || payload.balance.days !== days) {
          throw new Error('Unexpected balance source or period')
        }
        if (!controller.signal.aborted) {
          setLiveBalance(payload.balance)
          setLoadedOrg(organizationId)
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Verified balance unavailable')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [organizationId, commodityId, days, orgLoading, refresh])

  const balance = loadedOrg===organizationId &&
    liveBalance?.commodityId===commodityId &&
    liveBalance?.days===days ?liveBalance:null

  const scenario = useMemo(() => balance
    ? calculateFoodScenario(balance, adjustments)
    : null, [balance, adjustments])

  const isReady = Boolean(balance?.status === 'complete' && scenario?.status === 'complete')
  const hasShocks = Object.values(adjustments).some(value => value !== 0)
  const commodityLink = '/dashboard?' + new URLSearchParams({
    module: 'commodities',
    commodityId,
    ...(organizationId ? { organizationId } : {}),
  }).toString()

  const values = [
    {
      en: 'Verified baseline balance',
      ar: 'الرصيد الأساسي المُراجع',
      value: balance?.totals.projectedBalanceTonnes,
      suffix: 't',
    },
    {
      en: 'Simulated balance', ar: 'الرصيد في المحاكاة',
      value: scenario?.totals.scenarioProjectedBalanceTonnes,
      suffix: 't',
    },
    {
      en: 'Simulated food deficit', ar: 'العجز الغذائي في المحاكاة',
      value: scenario?.totals.scenarioDeficitTonnes,
      suffix: 't',
    },
    {
      en: 'Simulated days of coverage', ar: 'أيام التغطية في المحاكاة',
      value: scenario?.totals.scenarioCoverageDays,
      suffix: tx('days', 'يوم'),
    },
  ]

  return (
    <section id="watchtower-scenarios" className="rounded-xl border border-line bg-card p-4 md:p-5 space-y-4"
      aria-label={tx('Disruption scenario simulator', 'محاكاة سيناريوهات الاضطراب')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-muted p-2.5" aria-hidden="true">
            <FlaskConical className="h-5 w-5 text-sage-700" strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="text-[18px] font-medium text-content">
              {tx('Disruption scenario workbench', 'مختبر سيناريوهات اضطراب الإمداد')}
            </h2>
            <p className="mt-1 text-[12px] text-content-soft">
              {tx('Compare verified supply against shocks to production, imports, demand and usable stock.',
                'مقارنة الإمدادات الموثقة مع صدمات الإنتاج والواردات والطلب والمخزون القابل للاستخدام.')}
            </p>
            <span className="mt-2 inline-flex rounded border border-warning-line bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning-strong">
              {tx('WHAT-IF ONLY · NOT AN EXECUTED DECISION', 'للمحاكاة فقط · ليس قراراً منفذاً')}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-content-soft">
            {tx('Commodity', 'السلعة')}
            <select
              aria-label={tx('Scenario commodity', 'سلعة المحاكاة')}
              value={commodityId}
              onChange={event => {
                setCommodityId(event.target.value)
                setLiveBalance(null)
                setAdjustments({ ...ZERO_FOOD_SCENARIO })
              }}
              className="h-9 min-w-[145px] rounded-md border border-line bg-card px-2 text-[12px] text-content"
            >
              {COMMODITY_CATALOG.map(commodity => (
                <option value={commodity.id} key={commodity.id}>
                  {ar ? commodity.nameAr : commodity.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-content-soft">
            {tx('Horizon', 'الفترة')}
            <select
              aria-label={tx('Scenario horizon', 'فترة المحاكاة')}
              value={days}
              onChange={event => {
                setDays(Number(event.target.value) as 7 | 30 | 90 | 180)
                setLiveBalance(null)
              }}
              className="h-9 rounded-md border border-line bg-card px-2 text-[12px] text-content"
            >
              {[7, 30, 90, 180].map(value => (
                <option value={value} key={value}>{value} {tx('days', 'يوماً')}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRefresh(value => value + 1)}
            aria-label={tx('Refresh scenario baseline', 'تحديث أساس المحاكاة')}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-content disabled:opacity-40"
          >
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>
      </div>

      {orgLoading ? (
        <p className="py-4 text-[12px] text-content-soft" role="status">
          {tx('Resolving authorized organization…', 'جارٍ تحديد المؤسسة المصرح بها…')}
        </p>
      ) : !organizationId ? (
        <p role="status" className="py-4 text-[12px] text-content-soft">
          {tx('Choose an authorized organization to run what-if calculations on reviewed data.',
            'اختر مؤسسة مصرحاً لها لتشغيل التحليل على بيانات مُراجعة.')}
        </p>
      ) : error ? (
        <p role="alert" className="rounded-md border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
          {error}
        </p>
      ) : loading || !balance ? (
        <p className="py-4 text-[12px] text-content-soft" role="status">
          {tx('Loading independently reviewed source data…', 'جارٍ تحميل البيانات المصدرية المراجعة…')}
        </p>
      ) : (
        <>
          {isReady ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SCENARIO_CONTROLS.map(item => (
                  <label key={item.key} className="rounded-md border border-line bg-background p-3">
                    <span className="flex justify-between gap-3 text-[12px] text-content">
                      <span>{tx(item.en, item.ar)}</span>
                      <strong className="tabular-nums">{adjustments[item.key]}%</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={adjustments[item.key]}
                      onChange={event => setAdjustments(previous => ({
                        ...previous,
                        [item.key]: Number(event.target.value),
                      }))}
                      aria-label={tx(item.en, item.ar)}
                      className="mt-3 w-full accent-sage-700"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-content-soft">
                  {balance.fromDate} → {balance.toDate} · {balance.evidence.sourceRefs.length} {tx('source references', 'مراجع مصدرية')}
                </p>
                <button
                  type="button"
                  onClick={() => setAdjustments({ ...ZERO_FOOD_SCENARIO })}
                  disabled={!hasShocks}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] text-content disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {tx('Reset scenario', 'إعادة تعيين السيناريو')}
                </button>
              </div>
              <div aria-live="polite" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {values.map(item => (
                  <div key={item.en} className="rounded-md border border-line bg-muted/20 p-3">
                    <p className="text-[11px] text-content-soft">{tx(item.en, item.ar)}</p>
                    <p className="mt-1 text-[20px] font-medium tabular-nums text-content">
                      {fmt(item.value)} <span className="text-[11px] font-normal text-content-soft">{item.suffix}</span>
                    </p>
                  </div>
                ))}
              </div>
              {hasShocks && scenario?.status === 'complete' && (
                <div className="rounded-lg border border-line bg-muted p-3 text-content">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold">
                      {tx('Response assessment playbook', 'خطة تقييم الاستجابة')}
                    </p>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[9px] text-content-soft">
                      {tx('DRAFT · NOT DISPATCHED', 'مسودة · لم تُرسل')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-content-soft">
                    {(scenario.totals.scenarioDeficitTonnes ?? 0) > 0
                      ? tx(
                        'The selected shock creates a simulated deficit. Review the decision sequence before any procurement or reserve-release authorization.',
                        'يؤدي السيناريو المختار إلى عجز افتراضي. راجع تسلسل القرار قبل الموافقة على الشراء أو صرف المخزون.',
                      )
                      : tx(
                        'No simulated period-end deficit under these assumptions. Validate scenario inputs and interim delivery timing before drawing conclusions.',
                        'لا يظهر عجز افتراضي بنهاية الفترة وفق هذه الافتراضات. تحقّق من المدخلات ومواعيد التسليم قبل الاستنتاج.',
                      )}
                  </p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        en: 'Validate source quality and shock assumptions',
                        ar: 'التحقق من جودة المصادر وافتراضات الاضطراب',
                      },
                      {
                        en: 'Compare supplier quotes, lead times and trade corridors once integrated',
                        ar: 'مقارنة عروض الموردين والمهل والممرات التجارية بعد ربطها',
                      },
                      {
                        en: 'Inspect lot-level usable reserves and release constraints once integrated',
                        ar: 'فحص الاحتياطيات حسب الدفعات وقيود الصرف بعد ربطها',
                      },
                      {
                        en: 'Submit the reviewed response to authorized human decision makers',
                        ar: 'رفع الاستجابة المُراجعة إلى متخذي القرار المخولين',
                      },
                    ].map((task, index) => (
                      <li key={task.en} className="flex items-start gap-2 rounded-md border border-line bg-muted p-2 text-[11px] text-content">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[10px] text-content-accent">
                          {index + 1}
                        </span>
                        <span>{tx(task.en, task.ar)}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[10px] text-content-soft">
                    {tx(
                      'This checklist is guidance only. No tender, approval case, purchase, reserve movement or dispatch has been created.',
                      'هذه قائمة إرشادية فقط. لم يُنشأ أي عطاء أو طلب موافقة أو شراء أو حركة مخزون أو أمر إرسال.',
                    )}
                  </p>
                </div>
              )}
              {hasShocks && scenario?.totals.changeInBalanceTonnes !== null && (
                <p className="text-[12px] text-content-soft">
                  {tx('Change in projected balance', 'التغير في الرصيد المتوقع')}: {' '}
                  <strong className="text-content">{fmt(scenario?.totals.changeInBalanceTonnes)} t</strong>
                </p>
              )}
            </>
          ) : (
            <div className="rounded-md border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
              <p className="font-medium">
                {tx('Scenario withheld: incomplete verified food balance.',
                  'المحاكاة غير متاحة: ميزان الغذاء الموثق غير مكتمل.')}
              </p>
              <p className="mt-1 text-content-soft">
                {tx('A prior-day stock snapshot and verified production, import, consumption and loss coverage are required. Missing data are not zero.',
                  'يلزم وجود مخزون افتتاحي لليوم السابق وتغطية موثقة للإنتاج والواردات والاستهلاك والفاقد. البيانات المفقودة لا تعني صفراً.')}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-2 border-t border-dotted border-line pt-3">
            <p className="max-w-[82ch] text-[11px] text-content-soft">
              {tx(
                'Aggregate sensitivity only, not a shipment-level forecast. It does not modify stock, purchase orders, source approvals or real-world actions.',
                'تحليل حساسية إجمالي وليس توقعاً للشحنات؛ لا يغير المخزون أو أوامر الشراء أو الموافقات أو الإجراءات الفعلية.'
              )}
            </p>
            {<Link href={commodityLink}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-sage-700 hover:underline">
              {tx('Investigate sources and balances', 'تحليل المصادر والموازين')}
              <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>}
          </div>
        </>
      )}
    </section>
  )
}
