'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  DatabaseZap,
  ShieldAlert,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { FoodPosture } from '@/lib/watchtower/food-posture'
import {
  buildResilienceDecisionQueue,
  type ResilienceAction,
  type ResilienceActionPriority,
} from '@/lib/watchtower/resilience-queue'

const PRIORITY_STYLES: Record<ResilienceActionPriority, string> = {
  P0: 'border-warning-line bg-warning-soft text-critical',
  P1: 'border-warning-line bg-warning-soft text-warning-strong',
  P2: 'border-line-accent bg-cream-100 text-sage-700',
  EVIDENCE: 'border-line bg-muted text-content-soft',
}

function commodityHref(id: string, organizationId: string): string {
  return '/dashboard?' + new URLSearchParams({
    module: 'commodities', commodityId: id, organizationId,
  }).toString()
}

function formatTonnes(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function actionText(
  action: ResilienceAction,
  ar: boolean,
): { name: string; detail: string; recommendation: string } {
  const name = ar ? action.nameAr : action.name
  if (action.kind === 'investigate_deficit') {
    return {
      name,
      detail: ar ? 'عجز مُراجع متوقع في الفترة المحددة' : 'Reviewed period-end supply deficit',
      recommendation: ar
        ? 'التحقق من فجوة الإمداد ثم تقييم خيارات الشراء أو التحويل'
        : 'Validate gap and assess procurement or substitution options',
    }
  }
  if (action.kind === 'assess_short_coverage') {
    return {
      name,
      detail: ar ? 'تغطية مخزون منخفضة وفق عتبات فحص أولية' : 'Low coverage under provisional screening bands',
      recommendation: ar
        ? 'مراجعة استمرارية التوريد والمخزون الاحتياطي'
        : 'Review replenishment timing and available buffer',
    }
  }
  if (action.kind === 'review_buffer') {
    return {
      name,
      detail: ar ? 'تغطية تقترب من نطاق المراقبة' : 'Coverage approaching screening threshold',
      recommendation: ar
        ? 'مراجعة مخاطر التوريد والطلب'
        : 'Review supply-demand resilience and monitoring',
    }
  }
  return {
    name,
    detail: ar ? 'تغطية الأدلة المطلوبة غير مكتملة' : 'Source coverage is incomplete or cannot be assessed',
    recommendation: ar
      ? 'الحصول على بيانات المصدر والتحقق منها قبل اتخاذ قرار شراء'
      : 'Collect and independently verify source records before procurement decisions',
  }
}

export function WatchtowerResilienceDesk({ posture }: { posture: FoodPosture }) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const tx = (en: string, arabic: string) => ar ? arabic : en
  const queue = buildResilienceDecisionQueue(posture)

  return (
    <section id="watchtower-response" aria-label={tx('Resilience decision desk', 'مكتب قرارات المرونة')}
      className="rounded-xl border border-line bg-card px-4 py-4 text-content md:px-5 md:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-accent">
            {tx('Food security · Supply chain intelligence', 'الأمن الغذائي · معلومات سلسلة الإمداد')}
          </p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-tight">
            {tx('Resilience & procurement decision desk', 'مكتب قرارات المرونة والمشتريات')}
          </h3>
          <p className="mt-1 max-w-[90ch] text-[11px] text-content-soft">
            {tx(
              'Evidence-based procurement investigations, reserve readiness and supply-network connectivity. Recommendations require human validation and authorization.',
              'تقييم المشتريات والاستعداد للمخزون والربط بشبكة الإمداد بناءً على الأدلة، مع اشتراط المراجعة والاعتماد البشري.',
            )}
          </p>
        </div>
        <span className="rounded-full border border-line bg-muted px-2 py-1 text-[10px] font-medium tracking-wide text-content">
          {tx('DECISION SUPPORT · NO AUTO-PURCHASE', 'دعم القرار · دون شراء تلقائي')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 py-4 md:grid-cols-4">
        {[
          { name: tx('P0 · Verified gaps', 'P0 · عجز مُراجع'), value: queue.summary.p0, color: 'text-critical' },
          { name: tx('P1 · Short coverage', 'P1 · تغطية منخفضة'), value: queue.summary.p1, color: 'text-warning-strong' },
          { name: tx('P2 · Buffer review', 'P2 · مراجعة المخزون'), value: queue.summary.p2, color: 'text-content-accent' },
          { name: tx('Evidence required', 'أدلة مطلوبة'), value: queue.summary.evidence, color: 'text-content' },
        ].map(item => (
          <div key={item.name} className="rounded-md border border-line bg-muted p-3">
            <p className="text-[10px] text-content-soft">{item.name}</p>
            <p className={'mt-1 text-[26px] font-medium tabular-nums ' + item.color}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(310px,1fr)]">
        <div className="min-w-0 rounded-lg border border-line bg-muted">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
            <h4 className="flex items-center gap-2 text-[12px] font-semibold">
              <ShieldAlert className="h-4 w-4 text-warning-strong" />
              {tx('Decision review queue', 'قائمة مراجعة القرارات')}
            </h4>
            <span className="text-[10px] text-content-soft">
              {queue.procurementReview.length} {tx('supply signals', 'إشارات إمداد')}
            </span>
          </div>
          {queue.procurementReview.length === 0 ? (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-content-soft">
              {queue.summary.assessed === 0
                ? tx(
                  'No sufficiently reviewed balances. Supply risks cannot yet be classified. Review the evidence queue instead.',
                  'لا توجد موازين مكتملة المراجعة. لا يمكن تصنيف مخاطر الإمداد حالياً؛ راجع قائمة الأدلة.',
                )
                : tx(
                  'No provisional procurement investigation triggers among the assessed commodities. Unassessed commodities are listed separately.',
                  'لا توجد مؤشرات حالية تستدعي تحقيقاً شرائياً بين السلع المُقيّمة. السلع غير المُقيّمة تظهر بشكل منفصل.',
                )}
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {queue.procurementReview.map(action => {
                const copy = actionText(action, ar)
                return (
                  <li key={action.commodityId} className="px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={'rounded-full border px-1.5 py-0.5 text-[10px] font-bold ' + PRIORITY_STYLES[action.priority]}>
                            {action.priority}
                          </span>
                          <strong className="text-[12px] text-content">{copy.name}</strong>
                        </div>
                        <p className="mt-1 text-[11px] text-content-soft">{copy.detail}</p>
                        <p className="mt-1 text-[11px] text-content-soft">{copy.recommendation}</p>
                      </div>
                      <Link href={commodityHref(action.commodityId, posture.organizationId)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-content-accent hover:underline">
                        {tx('Investigate', 'تحليل')} <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-content-soft">
                      {action.gapTonnes !== null && action.gapTonnes > 0 && (
                        <span>{tx('Projected gap', 'الفجوة المتوقعة')}: {formatTonnes(action.gapTonnes)} t</span>
                      )}
                      {action.coverageDays !== null && (
                        <span>{tx('Coverage', 'التغطية')}: {formatTonnes(action.coverageDays)} {tx('days', 'يوم')}</span>
                      )}
                      <span>{tx('Evidence', 'الأدلة')}: {action.evidenceCount}</span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-line bg-muted">
          <div className="flex items-center justify-between border-b border-line px-3 py-3">
            <h4 className="flex items-center gap-2 text-[12px] font-semibold">
              <DatabaseZap className="h-4 w-4 text-content-accent" />
              {tx('Evidence & review backlog', 'الأدلة والسجلات قيد المراجعة')}
            </h4>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-content">
              {queue.summary.evidence} {tx('not assessed', 'غير مُقيّمة')}
            </span>
          </div>
          <div className="p-3">
            <p className="text-[11px] text-content-soft">
              {tx('Insufficient documentation is a separate risk of uncertainty, not proof of a shortage.',
                'نقص التوثيق هو حالة عدم يقين مستقلة، وليس دليلاً على وجود عجز.')}
            </p>
            <div className="mt-3 space-y-1.5">
              {queue.evidenceReview.slice(0, 6).map(action => {
                const copy = actionText(action, ar)
                return (
                  <Link key={action.commodityId} href={commodityHref(action.commodityId, posture.organizationId)}
                    className="flex items-center justify-between gap-2 rounded-md border border-line bg-muted px-2.5 py-2 text-[11px] text-content hover:border-line-accent">
                    <span className="min-w-0 truncate">{copy.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-content-accent" />
                  </Link>
                )
              })}
              {queue.evidenceReview.length > 6 && (
                <p className="text-[10px] text-content-soft">
                  +{queue.evidenceReview.length - 6} {tx('additional commodities', 'سلع إضافية')}
                </p>
              )}
              {queue.evidenceReview.length === 0 && (
                <p className="text-[11px] text-content-soft">
                  {tx('No commodity evidence gaps in the selected horizon.',
                    'لا توجد فجوات أدلة للسلع في الفترة المحددة.')}
                </p>
              )}
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[11px] text-content-soft">
              <ClipboardCheck className="me-1.5 inline h-3.5 w-3.5 text-content-accent" />
              {tx('Records waiting for an independent reviewer', 'سجلات تنتظر مراجعة مستقلة')}: {' '}
              <strong className="tabular-nums text-content">
                {posture.pendingReviewCount === null ? '—' : posture.pendingReviewCount}
              </strong>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-content-soft">
        <span>
          <AlertTriangle className="me-1 inline h-3.5 w-3.5 text-warning-strong" />
          {tx('P0/P1/P2 are provisional screening labels, NOT official procurement instructions.',
            'تصنيفات P0/P1/P2 استرشادية وليست تعليمات شراء رسمية.')}
        </span>
        <Link href="/dashboard?module=data-health" className="inline-flex items-center gap-1 text-content-accent hover:underline">
          {tx('Data governance & source health', 'حوكمة البيانات وصحة المصادر')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
