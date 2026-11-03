'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarDays, ClipboardCheck,
  Clock3, Database, RefreshCw, ShieldCheck, Wheat,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import type { FoodPosture, FoodPostureCommodity, FoodRiskBand } from '@/lib/watchtower/food-posture'
import { WatchtowerResilienceDesk } from '@/components/dashboard/watchtower/resilience-desk'
import styles from './food-command-center.module.css'

const SCREENING_LABEL: Record<FoodRiskBand, { en: string; ar: string }> = {
  critical: { en: 'Critical', ar: 'حرج' },
  high: { en: 'High', ar: 'مرتفع' },
  attention: { en: 'Attention', ar: 'يستدعي الانتباه' },
  stable: { en: 'Assessed', ar: 'تم التقييم' },
  unknown: { en: 'Not assessed', ar: 'غير مقيّم' },
}

const REASON: Record<FoodPostureCommodity['reason'], { en: string; ar: string }> = {
  deficit: { en: 'Projected supply deficit', ar: 'عجز متوقع في الإمدادات' },
  below_7_days: { en: 'Coverage below 7 days', ar: 'التغطية أقل من 7 أيام' },
  below_14_days: { en: 'Coverage below 14 days', ar: 'التغطية أقل من 14 يوماً' },
  below_30_days: { en: 'Coverage below 30 days', ar: 'التغطية أقل من 30 يوماً' },
  assessed: { en: 'No screening threshold triggered', ar: 'لم تُفعّل أي عتبة فحص' },
  missing_evidence: { en: 'Insufficient reviewed source coverage', ar: 'نقص في تغطية المصادر المُراجعة' },
  no_demand_baseline: { en: 'Consumption baseline unavailable', ar: 'خط أساس الاستهلاك غير متاح' },
}

function format(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function scopeLink(organizationId: string, commodityId: string) {
  return '/dashboard?' + new URLSearchParams({
    module: 'commodities', commodityId, organizationId,
  }).toString()
}

/** Visualization only. Coverage beyond 30 days is deliberately capped for the bar;
 * the actual measured number remains visible alongside it. */
function coverageWidth(days: number | null) {
  return days === null || !Number.isFinite(days)
    ? 0 : Math.max(0, Math.min(100, days / 30 * 100))
}

type BoardFilter = 'all' | 'risk' | 'gaps'

export function WatchtowerFoodCommandCenter() {
  const { organization, loading: organizationLoading } = useOrganization()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const tx = (en: string, arabic: string) => ar ? arabic : en
  const orgId = organization?.id ?? null

  const [days, setDays] = useState<7 | 30 | 90 | 180>(30)
  const [filter, setFilter] = useState<BoardFilter>('all')
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
        const response = await fetch('/api/watchtower/food-security?' + params.toString(), {
          signal: controller.signal, cache: 'no-store',
        })
        const payload: FoodPosture & { error?: string } = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Food security posture unavailable')
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

  const data = liveData?.organizationId === orgId && liveData.sourceMode === 'live'
    ? liveData : null

  const commodities = useMemo(() => {
    const rows = data?.commodities ?? []
    if (filter === 'risk') {
      return rows.filter(row => row.band === 'critical' ||
        row.band === 'high' || row.band === 'attention')
    }
    if (filter === 'gaps') return rows.filter(row => row.band === 'unknown')
    return rows
  }, [data, filter])

  const riskRows = data?.commodities.filter(row =>
    row.band === 'critical' || row.band === 'high' || row.band === 'attention') ?? []
  const gapRows = data?.commodities.filter(row => row.band === 'unknown') ?? []
  const assessed = data?.assessedCount ?? 0
  const readiness = data?.totalCommodities
    ? Math.max(0, Math.min(100, 100 * data.assessedCount / data.totalCommodities)) : 0
  const lastReviewed = data?.latestReviewedAt
    ? new Date(data.latestReviewedAt).toLocaleString(ar ? 'ar-QA' : 'en-GB', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qatar',
    }) : null

  const distribution = data ? [
    { band: 'critical' as const, count: data.criticalCount, en: 'Critical', ar: 'حرج' },
    { band: 'high' as const, count: data.highCount, en: 'High', ar: 'مرتفع' },
    { band: 'attention' as const, count: data.attentionCount, en: 'Attention', ar: 'تنبيه' },
    { band: 'stable' as const, count: data.commodities.filter(row => row.band === 'stable').length,
      en: 'Assessed · no trigger', ar: 'مقيّم · بلا مؤشر' },
    { band: 'unknown' as const, count: data.unknownCount, en: 'Not assessed', ar: 'غير مقيّم' },
  ] : []

  const metrics = data ? [
    { id: 'reviewed', en: 'Reviewed balances', ar: 'الموازين المُراجعة',
      value: format(data.assessedCount, 0) + ' / ' + format(data.totalCommodities, 0),
      note: tx('Source-backed commodity coverage', 'تغطية السلع من مصادر مُراجعة') },
    { id: 'deficit', en: 'Projected deficits', ar: 'العجز المتوقع',
      value: assessed ? format(data.deficitCount, 0) : '—',
      note: tx('Among reviewed balances', 'ضمن الموازين المُراجعة') },
    { id: 'critical', en: 'Critical / high signals', ar: 'إشارات حرجة / مرتفعة',
      value: assessed ? format(data.criticalCount + data.highCount, 0) : '—',
      note: tx('Provisional screening thresholds', 'عتبات فحص أولية') },
    { id: 'unknown', en: 'Unassessed commodities', ar: 'سلع غير مقيّمة',
      value: format(data.unknownCount, 0),
      note: tx('Unknown does not mean safe', 'غير معروف لا يعني آمناً') },
    { id: 'pending', en: 'Records awaiting review', ar: 'سجلات تنتظر المراجعة',
      value: format(data.pendingReviewCount, 0),
      note: tx('Requires independent approval', 'تتطلب مراجعة مستقلة') },
  ] : []

  return (
    <section id="watchtower-food"
      aria-label={tx('Food security command center', 'مركز قيادة الأمن الغذائي')}
      className={styles.shell} dir={ar ? 'rtl' : 'ltr'}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroIntro}>
            <div className={styles.eyebrow}>
              <span className={styles.heroSymbol}><Wheat size={14} /></span>
              {tx('GROWA / FOOD RESILIENCE INTELLIGENCE',
                'جروا / استخبارات مرونة الأمن الغذائي')}
            </div>
            <h2>{tx('Food security command center', 'مركز قيادة الأمن الغذائي')}</h2>
            <p>{tx(
              'One command view for reviewed supply balances, exposure and evidence quality.',
              'عرض موحد لموازين الإمداد المُراجعة والمخاطر وجودة الأدلة.'
            )}</p>
          </div>
          <div className={styles.controls}>
            <div className={styles.controlCaption}>
              <CalendarDays size={13} />
              {tx('ASSESSMENT HORIZON', 'أفق التقييم')}
            </div>
            <div className={styles.horizonPicker} role="group"
              aria-label={tx('Food security horizon', 'فترة الأمن الغذائي')}>
              {([7, 30, 90, 180] as const).map(period => (
                <button key={period} type="button" aria-pressed={days === period}
                  disabled={loading} onClick={() => setDays(period)}>
                  {period}{tx('D', 'ي')}
                </button>
              ))}
              <button type="button" className={styles.refresh}
                onClick={() => setRefresh(value => value + 1)} disabled={loading}
                aria-label={tx('Refresh food security', 'تحديث الأمن الغذائي')}>
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>
        </div>
        <div className={styles.scopeStrip}>
          <span><Database size={13}/>
            {tx('ORGANIZATION SCOPE', 'نطاق المؤسسة')}: <strong>
              {organization?.name ?? (orgId ? tx('Selected organization', 'المؤسسة المحددة') :
                tx('Not selected', 'لم يتم التحديد'))}</strong></span>
          <span><CalendarDays size={13}/>
            {data ? data.fromDate + ' → ' + data.toDate : tx('Period pending', 'الفترة قيد التحميل')}</span>
          <span><Clock3 size={13}/>
            {tx('Source review', 'مراجعة المصدر')}: {lastReviewed ??
              tx('Not available', 'غير متاح')}</span>
        </div>
        {data && <div className={styles.metrics}>
          {metrics.map(item => (
            <div key={item.id} className={styles.metric} data-kind={item.id}>
              <span>{tx(item.en, item.ar)}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </div>
          ))}
        </div>}
        <div className={styles.heroFooter}>
          <Activity size={13}/>
          {tx('Organization records only · Reviewed evidence · Screening, not an official national risk classification',
            'سجلات المؤسسة فقط · أدلة مُراجعة · فحص أولي وليس تصنيفاً وطنياً رسمياً')}
        </div>
      </header>

      {organizationLoading ? (
        <div className={styles.statePanel} role="status">
          {tx('Resolving your organization…', 'جارٍ تحديد مؤسستك…')}
        </div>
      ) : !orgId ? (
        <div className={styles.statePanel} role="status">
          {tx('Select an organization to view its food security ledger. No organization metrics are inferred.',
            'اختر مؤسسة لعرض سجل الأمن الغذائي. لا يتم استنتاج أي مؤشرات بدون مصدر.')}
        </div>
      ) : error ? (
        <div className={styles.errorPanel} role="alert">
          <AlertTriangle size={17}/>
          <span>{error}. {tx('Metrics are withheld while the source is unavailable.',
            'لن تُعرض المؤشرات عند تعذر الوصول إلى المصدر.')}</span>
        </div>
      ) : loading || !data ? (
        <div className={styles.statePanel} role="status">
          <RefreshCw size={16} className="animate-spin"/>
          {tx('Loading reviewed supply balances…', 'جارٍ تحميل الموازين المُراجعة…')}
        </div>
      ) : (
        <>
          <div className={styles.insightsGrid}>
            <section className={styles.distributionCard} aria-label={tx(
              'Commodity risk distribution', 'توزيع مؤشرات مخاطر السلع')}>
              <div className={styles.cardHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>{tx('EXPOSURE OVERVIEW', 'نظرة عامة على المخاطر')}</span>
                  <h3>{tx('Commodity screening distribution', 'توزيع مؤشرات تقييم السلع')}</h3>
                  <p>{tx('Count of reviewed signals and unassessed commodities',
                    'عدد إشارات التقييم المُراجعة والسلع غير المُقيّمة')}</p>
                </div>
                <AlertTriangle size={19}/>
              </div>
              <div className={styles.distributionSummary}>
                <strong>{assessed ? riskRows.length : '—'}</strong>
                <span>{tx('Commodities triggering provisional screening thresholds',
                  'سلع فعّلت عتبات التقييم الأولية')}</span>
                <small>{assessed ?
                  tx('Of ' + assessed + ' reviewed balances', 'من ' + assessed + ' ميزان مُراجع') :
                  tx('Not assessable without reviewed data', 'لا يمكن التقييم بدون بيانات مُراجعة')}</small>
              </div>
              <div className={styles.distributionTrack}
                role="img" aria-label={tx('Screening categories across ' + data.totalCommodities + ' commodities',
                  'فئات التقييم عبر ' + data.totalCommodities + ' سلعة')}>
                {distribution.filter(item => item.count > 0).map(item => (
                  <span key={item.band} data-band={item.band} style={{
                    width: (data.totalCommodities
                      ? item.count / data.totalCommodities * 100 : 0) + '%',
                  }} title={tx(item.en, item.ar) + ': ' + item.count} />
                ))}
              </div>
              <div className={styles.legend}>
                {distribution.map(item => (
                  <div className={styles.legendItem} key={item.band}>
                    <i data-band={item.band}/>
                    <span>{tx(item.en, item.ar)}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.cardNote}>
                <AlertTriangle size={13}/>
                {tx('Unknown is not safe. Deficits and coverage thresholds are preliminary screening indicators.',
                  'غير معروف لا يعني آمناً. العجز وعتبات التغطية مؤشرات فحص أولية.')}
              </div>
            </section>

            <section className={styles.readinessCard} aria-label={tx(
              'Reviewed evidence readiness', 'جاهزية الأدلة المُراجعة')}>
              <div className={styles.cardHeading}>
                <div>
                  <span className={styles.sectionEyebrow}>{tx('DATA CONFIDENCE', 'موثوقية البيانات')}</span>
                  <h3>{tx('Evidence readiness', 'جاهزية الأدلة')}</h3>
                  <p>{tx('Coverage of complete reviewed balances', 'نسبة الموازين المكتملة المُراجعة')}</p>
                </div>
                <ShieldCheck size={19}/>
              </div>
              <div className={styles.readinessBody}>
                <div className={styles.donut}>
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="45" className={styles.donutTrack}/>
                    <circle cx="60" cy="60" r="45" className={styles.donutFill}
                      strokeDasharray={String(2 * Math.PI * 45)}
                      strokeDashoffset={String(2 * Math.PI * 45 * (1 - readiness / 100))}/>
                  </svg>
                  <div><strong>{format(readiness, 0)}%</strong>
                    <span>{tx('reviewed', 'مُراجع')}</span></div>
                </div>
                <div className={styles.readinessText}>
                  <strong>{data.assessedCount} / {data.totalCommodities}</strong>
                  <span>{tx('Complete reviewed commodity balances', 'موازين سلع مكتملة ومُراجعة')}</span>
                  <p>{data.unknownCount} {tx('still require source verification', 'ما زالت تحتاج للتحقق من المصادر')}</p>
                  {data.pendingReviewCount !== null &&
                    <p>{data.pendingReviewCount} {tx('records awaiting independent approval',
                      'سجلات تنتظر الموافقة المستقلة')}</p>}
                </div>
              </div>
              <div className={styles.readinessNote}>
                <Database size={13}/>
                {tx('Readiness is source completeness, not supply security.',
                  'الجاهزية تعني اكتمال الأدلة، وليس أمان الإمدادات.')}
              </div>
            </section>
          </div>

          {assessed === 0 && (
            <div className={styles.noAssessment} role="status">
              <AlertTriangle size={16}/>
              {tx('No complete reviewed balances for this period. Risk cannot be classified without evidence.',
                'لا توجد موازين مكتملة ومُراجعة لهذه الفترة، ولا يمكن تصنيف المخاطر دون أدلة.')}
            </div>
          )}

          <div className={styles.mainGrid}>
            <section className={styles.board}>
              <div className={styles.boardHead}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    {tx('COMMODITY RESILIENCE MONITOR', 'مراقبة مرونة السلع')}</span>
                  <h3>{tx('Supply & coverage intelligence', 'استخبارات الإمداد والتغطية')}</h3>
                  <p>{tx('Period-end projections with source-verified inputs',
                    'توقعات نهاية الفترة بناء على مدخلات موثقة')}</p>
                </div>
                <span className={styles.boardCount}>{commodities.length} {tx('commodities', 'سلع')}</span>
              </div>
              <div className={styles.boardFilters} role="group"
                aria-label={tx('Filter commodities', 'تصفية السلع')}>
                {([
                  { id: 'all' as const, en: 'All commodities', ar: 'جميع السلع', count: data.totalCommodities },
                  { id: 'risk' as const, en: 'Screening signals', ar: 'إشارات التقييم', count: riskRows.length },
                  { id: 'gaps' as const, en: 'Missing evidence', ar: 'أدلة ناقصة', count: gapRows.length },
                ]).map(item => (
                  <button key={item.id} type="button" aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}>
                    {tx(item.en, item.ar)} <span>{item.count}</span>
                  </button>
                ))}
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr>
                    <th>{tx('Commodity', 'السلعة')}</th>
                    <th>{tx('Screening status', 'حالة التقييم')}</th>
                    <th>{tx('Projected deficit', 'العجز المتوقع')}</th>
                    <th>{tx('Coverage · period-end', 'التغطية · نهاية الفترة')}</th>
                    <th>{tx('Import share of inflows', 'حصة الواردات من التدفقات')}</th>
                    <th>{tx('Evidence', 'الأدلة')}</th>
                    <th>{tx('Action', 'الإجراء')}</th>
                  </tr></thead>
                  <tbody>{commodities.map(row => {
                    const badge = SCREENING_LABEL[row.band]
                    return (
                      <tr key={row.commodityId} data-band={row.band}>
                        <td><strong>{ar ? row.nameAr : row.name}</strong>
                          <small>{row.commodityId}</small></td>
                        <td>
                          <span className={styles.band} data-band={row.band}>
                            <i/>{tx(badge.en, badge.ar)}</span>
                          <p>{tx(REASON[row.reason].en, REASON[row.reason].ar)}</p>
                        </td>
                        <td className={styles.numeric}>
                          <strong>{format(row.deficitTonnes)}{row.deficitTonnes !== null ? ' t' : ''}</strong>
                        </td>
                        <td className={styles.numeric}>
                          <strong>{format(row.coverageDays)}{row.coverageDays !== null ?
                            ' ' + tx('days', 'يوم') : ''}</strong>
                          {row.coverageDays !== null && (
                            <div className={styles.coverageTrack} role="meter"
                              aria-label={tx('Period-end coverage days', 'أيام تغطية نهاية الفترة')}
                              aria-valuemin={0} aria-valuemax={30}
                              aria-valuenow={Math.min(30, Math.max(0, row.coverageDays))}>
                              <span data-band={row.band}
                                style={{ width: coverageWidth(row.coverageDays) + '%' }}/>
                            </div>
                          )}
                        </td>
                        <td className={styles.numeric}>
                          <strong>{format(row.importShareOfInflowsPercent)}
                            {row.importShareOfInflowsPercent !== null ? '%' : ''}</strong>
                        </td>
                        <td className={styles.numeric}>
                          <span className={styles.evidenceCount}>
                            <Database size={12}/>
                            {row.evidenceSourceRefs.length > 0 ? row.evidenceSourceRefs.length : '—'}
                          </span>
                        </td>
                        <td><Link href={scopeLink(orgId, row.commodityId)} className={styles.rowLink}
                          aria-label={tx('Open commodity intelligence for ',
                            'فتح تحليل السلعة: ') + (ar ? row.nameAr : row.name)}>
                          {tx('Investigate', 'تحليل')} <ArrowUpRight size={14}/>
                        </Link></td>
                      </tr>
                    )
                  })}</tbody>
                </table>
                {!commodities.length && <div className={styles.emptyRows}>
                  {tx('No commodities match this filter.', 'لا توجد سلع تطابق هذا الفلتر.')}
                </div>}
              </div>
              <div className={styles.boardFoot}>
                <span>{tx('Coverage meter caps at 30 days; exact values appear above.',
                  'شريط التغطية يتوقف عند 30 يوماً؛ القيم الفعلية ظاهرة فوقه.')}</span>
                <span>{tx('No inferred values for missing source records.',
                  'لا يتم تقدير قيم لسجلات المصادر المفقودة.')}</span>
              </div>
            </section>

            <aside className={styles.sideColumn}>
              <section className={styles.priorityCard}>
                <div className={styles.cardHeading}>
                  <div><span className={styles.sectionEyebrow}>
                    {tx('PRIORITY REVIEW', 'مراجعة الأولويات')}</span>
                    <h3>{tx('Investigations to review', 'التحقيقات المطلوب مراجعتها')}</h3></div>
                  <AlertTriangle size={18}/>
                </div>
                <p className={styles.sideHint}>{tx('Screening triggers only. No procurement decision is issued automatically.',
                  'مؤشرات فحص فقط. لا تُتخذ قرارات الشراء تلقائياً.')}</p>
                {riskRows.length === 0 ? (
                  <p className={styles.emptySide}>{assessed === 0
                    ? tx('No reviewed evidence is available to classify risk.',
                      'لا توجد أدلة مُراجعة لتصنيف المخاطر.')
                    : tx('No triggers among assessed commodities. Check unassessed records separately.',
                      'لا توجد مؤشرات ضمن السلع المُقيّمة، ويجب مراجعة السلع غير المُقيّمة منفصلة.')}</p>
                ) : (
                  <ol className={styles.priorityList}>
                    {riskRows.slice(0, 5).map((row, i) => (
                      <li key={row.commodityId}>
                        <span className={styles.priorityNumber}>{String(i + 1).padStart(2, '0')}</span>
                        <div>
                          <span className={styles.band} data-band={row.band}>
                            <i/>{tx(SCREENING_LABEL[row.band].en, SCREENING_LABEL[row.band].ar)}
                          </span>
                          <Link href={scopeLink(orgId, row.commodityId)}>
                            {ar ? row.nameAr : row.name}<ArrowUpRight size={13}/>
                          </Link>
                          <small>{tx(REASON[row.reason].en, REASON[row.reason].ar)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className={styles.evidenceCard}>
                <div className={styles.cardHeading}>
                  <div><span className={styles.sectionEyebrow}>
                    {tx('SOURCE READINESS', 'جاهزية المصادر')}</span>
                    <h3>{tx('Evidence review queue', 'قائمة مراجعة الأدلة')}</h3></div>
                  <ClipboardCheck size={18}/>
                </div>
                <div className={styles.evidenceLine}>
                  <strong>{data.totalCommodities - data.assessedCount}</strong>
                  <span>{tx('commodities need complete source coverage',
                    'سلع تحتاج إلى تغطية مكتملة للمصادر')}</span>
                </div>
                <div className={styles.evidenceProgress} role="progressbar"
                  aria-label={tx('Complete reviewed balances', 'موازين مكتملة ومُراجعة')}
                  aria-valuemin={0} aria-valuemax={data.totalCommodities}
                  aria-valuenow={data.assessedCount}>
                  <span style={{ width: readiness + '%' }}/>
                </div>
                {gapRows.length > 0 && <p className={styles.evidenceGap}>
                  {tx('Verification required for', 'يلزم التحقق من')}:
                  {' '}{gapRows.slice(0, 3).map(row => ar ? row.nameAr : row.name).join(' · ')}
                </p>}
                {data.pendingReviewCount !== null && data.pendingReviewCount > 0 &&
                  <div className={styles.pending}>
                    <AlertTriangle size={13}/>
                    {data.pendingReviewCount} {tx('submitted records await independent approval',
                      'سجلات مُرسلة تنتظر الموافقة المستقلة')}
                  </div>}
                {data.commodities.length > 0 && <Link
                  href={scopeLink(orgId, data.commodities[0].commodityId)}
                  className={styles.sourceLink}>
                  <ShieldCheck size={14}/>
                  {tx('Review source records', 'مراجعة سجلات المصادر')}
                  <ArrowUpRight size={14}/>
                </Link>}
              </section>
            </aside>
          </div>

          <div className={styles.decisionDesk}>
            <WatchtowerResilienceDesk posture={data}/>
          </div>

          <footer className={styles.footer}>
            <span>{tx('Coverage thresholds: below 7d critical · 7–13d high · 14–29d attention. Screening only.',
              'عتبات التغطية: أقل من 7 أيام حرج · 7–13 مرتفع · 14–29 انتباه. للتقييم فقط.')}</span>
            <span>{tx('Import share is planned inflow composition, not national import dependence.',
              'حصة الواردات من التدفقات المخططة وليست الاعتماد الوطني على الاستيراد.')}</span>
          </footer>
        </>
      )}
    </section>
  )
}
