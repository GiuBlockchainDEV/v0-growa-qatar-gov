'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Database, RefreshCw, ShieldCheck, Wheat } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import type { FoodPosture, FoodPostureCommodity, FoodRiskBand } from '@/lib/watchtower/food-posture'
import { WatchtowerResilienceDesk } from '@/components/dashboard/watchtower/resilience-desk'

const SCREENING_LABEL: Record<FoodRiskBand, { en: string; ar: string; css: string }> = {
  critical: { en: 'Critical', ar: 'حرج', css: 'bg-warning-soft text-warning-strong border-warning-line' },
  high: { en: 'High', ar: 'مرتفع', css: 'bg-warning-soft text-warning-strong border-warning-line' },
  attention: { en: 'Attention', ar: 'يتطلب الانتباه', css: 'bg-muted text-content border-line' },
  stable: { en: 'Assessed', ar: 'تم التقييم', css: 'bg-muted text-sage-700 border-line' },
  unknown: { en: 'Not assessed', ar: 'غير مقيّم', css: 'bg-muted text-content-soft border-line' },
}

const REASON: Record<FoodPostureCommodity['reason'], { en: string; ar: string }> = {
  deficit: { en: 'Projected supply deficit', ar: 'عجز متوقع في الإمدادات' },
  below_7_days: { en: 'Coverage below 7 days', ar: 'التغطية أقل من 7 أيام' },
  below_14_days: { en: 'Coverage below 14 days', ar: 'التغطية أقل من 14 يوماً' },
  below_30_days: { en: 'Coverage below 30 days', ar: 'التغطية أقل من 30 يوماً' },
  assessed: { en: 'No screening alert in this horizon', ar: 'لا يوجد تنبيه في فترة التقييم' },
  missing_evidence: { en: 'Insufficient reviewed source coverage', ar: 'تغطية المصادر المُراجعة غير كافية' },
  no_demand_baseline: { en: 'Consumption baseline unavailable', ar: 'خط أساس الاستهلاك غير متاح' },
}

function format(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function scopeLink(organizationId: string | null, commodityId: string): string {
  const params = new URLSearchParams({ module: 'commodities', commodityId })
  if (organizationId) params.set('organizationId', organizationId)
  return '/dashboard?' + params.toString()
}

export function WatchtowerFoodCommandCenter() {
  const { organization, loading: organizationLoading } = useOrganization()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const tx = (en: string, arabic: string) => ar ? arabic : en
  const orgId = organization?.id ?? null
  const [days, setDays] = useState<7 | 30 | 90 | 180>(30)
  const [filter, setFilter] = useState<'all' | 'risk' | 'gaps'>('all')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(false)
  const [liveData, setLiveData] = useState<FoodPosture | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLiveData(null)
    setError(null)
    if (!orgId) return
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ organizationId: orgId, days: String(days) })
        const res = await fetch('/api/watchtower/food-security?' + params.toString(), {
          signal: controller.signal, cache: 'no-store',
        })
        const payload: FoodPosture & { error?: string } = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Food security posture unavailable')
        if (payload.organizationId !== orgId || payload.scope !== 'organization' ||
            payload.sourceMode !== 'live') {
          throw new Error('Food security response has an unexpected scope')
        }
        if (!controller.signal.aborted) setLiveData(payload)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Food security data unavailable')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [orgId, days, refresh])

  // No national seed fallback: only organization-scoped reviewed API results.
  const data = liveData?.organizationId === orgId &&
    liveData.sourceMode === 'live' ? liveData : null

  const commodities = useMemo(() => {
    const rows = data?.commodities ?? []
    if (filter === 'risk') return rows.filter(row =>
      row.band === 'critical' || row.band === 'high' || row.band === 'attention')
    if (filter === 'gaps') return rows.filter(row => row.band === 'unknown')
    return rows
  }, [data, filter])

  const riskRows = data?.commodities.filter(row =>
    row.band === 'critical' || row.band === 'high' || row.band === 'attention') ?? []
  const gapRows = data?.commodities.filter(row => row.band === 'unknown') ?? []
  const lastReviewed = data?.latestReviewedAt
    ? new Date(data.latestReviewedAt).toLocaleString(ar ? 'ar-QA' : 'en-GB', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qatar',
    }) : null
  const assessed = data?.assessedCount ?? 0
  const statBlocks = data ? [
    {
      en: 'Commodities assessed', ar: 'السلع المُقيّمة',
      value: String(data.assessedCount) + ' / ' + String(data.totalCommodities),
      noteEn: 'Complete reviewed coverage',
      noteAr: 'تغطية مكتملة من مصادر مُراجعة',
    },
    {
      en: 'Projected deficits', ar: 'العجز المتوقع',
      value: assessed ? String(data.deficitCount) : '—',
      noteEn: 'Among assessed commodities', noteAr: 'بين السلع المُقيّمة',
    },
    {
      en: 'Critical / high signals', ar: 'إشارات حرجة / مرتفعة',
      value: assessed ? String(data.criticalCount + data.highCount) : '—',
      noteEn: 'Screening thresholds only', noteAr: 'عتبات استرشادية فقط',
    },
    {
      en: 'Unknown status', ar: 'حالات غير معروفة',
      value: String(data.unknownCount),
      noteEn: 'No source-backed all-clear', noteAr: 'لا يمكن اعتبارها آمنة بدون بيانات',
    },
    {
      en: 'Records awaiting review', ar: 'سجلات تنتظر المراجعة',
      value: data.pendingReviewCount === null ? '—' : String(data.pendingReviewCount),
      noteEn: 'Across this organization', noteAr: 'ضمن هذه المؤسسة',
    },
  ] : []

  return (
    <section
      id="watchtower-food"
      aria-label={tx('Food security command center', 'مركز قيادة الأمن الغذائي')}
      className="rounded-xl border border-line bg-card p-4 md:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-muted p-2.5" aria-hidden="true">
            <Wheat className="h-5 w-5 text-sage-700" strokeWidth={1.5} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-medium text-content">
                {tx('Food security command center', 'مركز قيادة الأمن الغذائي')}
              </h2>
              <span className="rounded border border-line bg-muted px-2 py-1 text-[10px] font-semibold text-content-soft">
                {data ? tx('REVIEWED SOURCES · ORGANIZATION', 'مصادر مُراجعة · مستوى المؤسسة') : tx('NO VERIFIED SOURCE', 'لا يتوفر مصدر موثق')}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-content-soft">
              {tx('Production · Imports · Demand · Inventory coverage · Evidence quality',
                'الإنتاج · الواردات · الطلب · تغطية المخزون · جودة الأدلة')}
            </p>
            <p className="mt-1 text-[11px] font-medium text-warning-strong">
              {tx('Organization-level intelligence, not certified Qatar national statistics.',
                'معلومات على مستوى المؤسسة وليست إحصاءات وطنية معتمدة لدولة قطر.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] text-content-soft">
            {tx('Horizon', 'الفترة')}
            <select
              aria-label={tx('Food security horizon', 'فترة الأمن الغذائي')}
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90 | 180)}
              className="h-9 rounded-md border border-line bg-card px-2 text-[12px] text-content"
            >
              <option value={7}>7 {tx('days', 'أيام')}</option>
              <option value={30}>30 {tx('days', 'يوماً')}</option>
              <option value={90}>90 {tx('days', 'يوماً')}</option>
              <option value={180}>180 {tx('days', 'يوماً')}</option>
            </select>
          </label>
          <button type="button" onClick={() => setRefresh(x => x + 1)} disabled={loading}
            aria-label={tx('Refresh food security', 'تحديث الأمن الغذائي')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-content disabled:opacity-40">
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
        </div>
      </div>

      {organizationLoading ? (
        <p className="p-5 text-[13px] text-content-soft">{tx('Resolving your organization…', 'جارٍ تحديد مؤسستك…')}</p>
      ) : !orgId ? (
        <p role="status" className="p-5 text-[13px] text-content-soft">
          {tx('Select an authorized organization to view reviewed food balances. No sample data are displayed.',
            'اختر مؤسسة مصرحاً لها لعرض الموازين المُراجعة. لا تُعرض بيانات تجريبية.')}
        </p>
      ) : error ? (
        <div role="alert" className="rounded-md border border-warning-line bg-warning-soft p-3 text-[12px] text-warning-strong">
          {error}. {tx('Food KPI values are withheld while the source is unavailable.',
            'لن تُعرض مؤشرات الأمن الغذائي في حالة تعذر الوصول إلى المصدر.')}
        </div>
      ) : loading || !data ? (
        <p className="p-5 text-[13px] text-content-soft" role="status">
          {tx('Calculating reviewed commodity balances…', 'جارٍ احتساب موازين السلع المُراجعة…')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-2 text-[11px] text-content-soft">
            <span>{tx('Scope', 'النطاق')}: <strong className="text-content">{organization?.name ?? orgId}</strong></span>
            <span>{data.fromDate} → {data.toDate}</span>
            <span>{tx('Last source review', 'آخر مراجعة للمصدر') + ': ' + (lastReviewed ?? tx('Not available', 'غير متاح'))}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {statBlocks.map(block => (
              <div className="rounded-md border border-line bg-background px-3 py-3" key={block.en}>
                <p className="text-[11px] text-content-soft">{tx(block.en, block.ar)}</p>
                <p className="mt-1 text-[25px] font-medium tabular-nums text-content">{block.value}</p>
                <p className="mt-0.5 text-[10px] text-content-soft">{tx(block.noteEn, block.noteAr)}</p>
              </div>
            ))}
          </div>

          {assessed === 0 && (
            <div className="rounded-md border border-warning-line bg-warning-soft p-3 text-[12px] text-content">
              {tx('No commodities have a complete reviewed balance for this period. This is a data-readiness gap, not a low-risk assessment.',
                'لا توجد سلع لديها ميزان مكتمل ومُراجع لهذه الفترة. هذه فجوة في جاهزية البيانات وليست مؤشراً على انخفاض المخاطر.')}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_295px]">
            <div className="min-w-0 rounded-lg border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-3">
                <h3 className="text-[13px] font-medium text-content">
                  {tx('Commodity resilience board', 'لوحة مرونة السلع')}
                </h3>
                <label className="flex items-center gap-2 text-[11px] text-content-soft">
                  {tx('Show', 'عرض')}
                  <select value={filter}
                    onChange={(event) => setFilter(event.target.value as 'all' | 'risk' | 'gaps')}
                    className="h-8 rounded-md border border-line bg-card px-2 text-[11px] text-content">
                    <option value="all">{tx('All', 'الكل')}</option>
                    <option value="risk">{tx('Screening signals', 'إشارات التقييم')}</option>
                    <option value="gaps">{tx('Data gaps', 'فجوات البيانات')}</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[690px] text-start">
                  <thead>
                    <tr className="border-b border-line bg-muted/30 text-[10px] uppercase tracking-wide text-content-soft">
                      <th className="px-3 py-2 text-start font-medium">{tx('Commodity', 'السلعة')}</th>
                      <th className="px-3 py-2 text-start font-medium">{tx('Assessment', 'التقييم')}</th>
                      <th className="px-3 py-2 text-end font-medium">{tx('Deficit', 'العجز')}</th>
                      <th className="px-3 py-2 text-end font-medium">{tx('Coverage', 'التغطية')}</th>
                      <th className="px-3 py-2 text-end font-medium">{tx('Import inflow share', 'نسبة الواردات من التدفقات')}</th>
                      <th className="px-3 py-2 text-end font-medium">{tx('Evidence', 'الأدلة')}</th>
                      <th className="px-3 py-2 text-end font-medium">{tx('Investigate', 'تحليل')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {commodities.map(row => {
                      const badge = SCREENING_LABEL[row.band]
                      return (
                        <tr key={row.commodityId} className="text-[12px] text-content hover:bg-muted/20">
                          <td className="px-3 py-3 font-medium">{ar ? row.nameAr : row.name}</td>
                          <td className="px-3 py-3">
                            <span className={'inline-flex rounded border px-2 py-0.5 text-[10px] ' + badge.css}>
                              {ar ? badge.ar : badge.en}
                            </span>
                            <p className="mt-1 text-[10px] text-content-soft">
                              {ar ? REASON[row.reason].ar : REASON[row.reason].en}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-end tabular-nums">
                            {format(row.deficitTonnes)} {row.deficitTonnes !== null ? 't' : ''}
                          </td>
                          <td className="px-3 py-3 text-end tabular-nums">
                            {format(row.coverageDays)} {row.coverageDays !== null ? tx('days', 'يوم') : ''}
                          </td>
                          <td className="px-3 py-3 text-end tabular-nums">
                            {format(row.importShareOfInflowsPercent)}{row.importShareOfInflowsPercent !== null ? '%' : ''}
                          </td>
                          <td className="px-3 py-3 text-end tabular-nums">
                            {row.evidenceSourceRefs.length > 0
                              ? String(row.evidenceSourceRefs.length) : '—'}
                          </td>
                          <td className="px-3 py-3 text-end">
                            <Link href={scopeLink(orgId, row.commodityId)}
                              aria-label={tx('Open commodity intelligence for ', 'فتح تحليل السلعة: ') + (ar ? row.nameAr : row.name)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-sage-700 hover:underline">
                              {tx('Open', 'فتح')} <ArrowUpRight className="h-3 w-3 rtl:-scale-x-100" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {commodities.length === 0 && (
                <p className="px-3 py-5 text-[12px] text-content-soft">
                  {tx('No commodities match this filter.', 'لا توجد سلع مطابقة لهذا الفلتر.')}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-line p-3">
                <h3 className="flex items-center gap-2 text-[13px] font-medium text-content">
                  <AlertTriangle className="h-4 w-4 text-warning-strong" />
                  {tx('Priority investigations', 'التحقيقات ذات الأولوية')}
                </h3>
                <p className="mt-1 text-[11px] text-content-soft">
                  {tx('Derived screening signals, not issued operational alerts.',
                    'إشارات تقييم مشتقة وليست تنبيهات تشغيلية معتمدة.')}
                </p>
                {riskRows.length === 0 ? (
                  <p className="mt-3 text-[12px] text-content-soft">
                    {assessed === 0
                      ? tx('Source coverage is insufficient to assess risk.',
                        'تغطية المصادر غير كافية لتقييم المخاطر.')
                      : tx('No screening signals among assessed commodities.',
                        'لا توجد إشارات تقييم بين السلع المُقيّمة.')}
                  </p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {riskRows.slice(0, 4).map(row => (
                      <li key={row.commodityId} className="border-b border-dotted border-line pb-2 last:border-0">
                        <Link href={scopeLink(orgId, row.commodityId)}
                          className="flex items-center justify-between gap-2 text-[12px] text-content hover:text-sage-700">
                          <span className="font-medium">{ar ? row.nameAr : row.name}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        <p className="mt-1 text-[11px] text-content-soft">
                          {ar ? REASON[row.reason].ar : REASON[row.reason].en}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="rounded-lg border border-line p-3">
                <h3 className="flex items-center gap-2 text-[13px] font-medium text-content">
                  <Database className="h-4 w-4 text-content-soft" />
                  {tx('Source readiness', 'جاهزية المصادر')}
                </h3>
                <p className="mt-2 text-[12px] text-content">
                  {data.totalCommodities - data.assessedCount} {tx('commodities awaiting complete data',
                    'سلع تنتظر بيانات مكتملة')}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar" aria-valuemin={0} aria-valuemax={data.totalCommodities}
                  aria-valuenow={data.assessedCount}
                  aria-label={tx('Complete reviewed commodity balances', 'موازين السلع المكتملة والمُراجعة')}>
                  <div className="h-full rounded-full bg-sage-700"
                    style={{ width: (data.totalCommodities
                      ? (100 * data.assessedCount / data.totalCommodities) : 0) + '%' }} />
                </div>
                {gapRows.length > 0 && (
                  <p className="mt-2 text-[11px] text-content-soft">
                    {tx('Commodities needing source verification', 'سلع تحتاج إلى توثيق المصادر')}: {' '}
                    {gapRows.slice(0, 3).map(x => ar ? x.nameAr : x.name).join(' · ')}
                  </p>
                )}
                {data.pendingReviewCount !== null && data.pendingReviewCount > 0 && (
                  <p className="mt-2 text-[11px] text-warning-strong">
                    {data.pendingReviewCount} {tx('submitted records require independent approval.',
                      'سجلات مُرسلة تحتاج إلى موافقة مستقلة.')}
                  </p>
                )}
                {<Link href={scopeLink(orgId, data.commodities[0]?.commodityId || 'tomato')}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-sage-700 hover:underline">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {tx('Review commodity sources', 'مراجعة مصادر السلع')}
                </Link>}
              </div>
            </div>
          </div>

          <WatchtowerResilienceDesk posture={data} />

          <div className="flex flex-wrap items-start justify-between gap-2 border-t border-dotted border-line pt-3 text-[11px] text-content-soft">
            <p>{tx('Coverage bands: <7d critical, 7–13d high, 14–29d attention. Screening only.',
              'حدود التغطية: أقل من 7 أيام حرج، 7–13 مرتفع، 14–29 يحتاج للانتباه. للاستدلال فقط.')}</p>
            <p>{tx('Import share is a share of planned inflows, not national import dependence.',
              'حصة الواردات من التدفقات المخططة، وليست الاعتماد الوطني على الواردات.')}</p>
          </div>
        </>
      )}
    </section>
  )
}
