'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useOrganization } from '@/hooks/use-organization'
import { useI18n } from '@/lib/i18n'
import type { FoodBalanceResult } from '@/lib/food-security/balance'
import { calculateFoodScenario, ZERO_FOOD_SCENARIO, type FoodScenarioAdjustments } from '@/lib/food-security/scenario'
import { FoodSourceIntake } from '@/components/dashboard/food-source-intake'

interface BalanceResponse {
  balance: FoodBalanceResult
  dataSource: 'LIVE' | 'DEMO'
  notice: string
}

function fmt(amount: number | null): string {
  return amount === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount)
}

export function FoodBalancePanel({ commodityId }: { commodityId: string }) {
  const { organization, loading: organizationLoading } = useOrganization()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const label = (en: string, arabic: string) => ar ? arabic : en
  const [days, setDays] = useState(30)
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [refresh, setRefresh] = useState(0)
  const [scenarioSettings, setScenarioSettings] = useState<FoodScenarioAdjustments>({ ...ZERO_FOOD_SCENARIO })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BalanceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const organizationId = organization?.id ?? null

  useEffect(() => {
    setResult(null)
    setError(null)
    if (!organizationId) return
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          organizationId, commodityId, days: String(days), mode,
        })
        const response = await fetch(`/api/food-security/balance?${params}`, {
          cache: 'no-store', signal: controller.signal,
        })
        const data: BalanceResponse & { error?: string } = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Food balance unavailable')
        if (!controller.signal.aborted) setResult(data)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load food balance')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [organizationId, commodityId, days, mode, refresh])

  const balance = result?.balance
  const scenarioImpact = useMemo(
    () => balance ? calculateFoodScenario(balance, scenarioSettings) : null,
    [balance, scenarioSettings],
  )
  const scenarioControls: { key: keyof FoodScenarioAdjustments; en: string; ar: string }[] = [
    { key: 'productionReductionPercent', en: 'Domestic production reduction', ar: 'انخفاض الإنتاج المحلي' },
    { key: 'importReductionPercent', en: 'Confirmed import reduction', ar: 'انخفاض الواردات المؤكدة' },
    { key: 'demandIncreasePercent', en: 'Demand increase', ar: 'زيادة الطلب' },
    { key: 'openingStockLossPercent', en: 'Opening inventory loss', ar: 'فقد المخزون الافتتاحي' },
  ]
  const metrics = [
    [label('Opening usable inventory', 'المخزون المتاح في البداية'), balance?.totals.openingStockTonnes],
    [label('Domestic production', 'الإنتاج المحلي'), balance?.totals.domesticProductionTonnes],
    [label('Confirmed imports', 'الواردات المؤكدة'), balance?.totals.confirmedImportsTonnes],
    [label('Period consumption / demand', 'الاستهلاك والطلب للفترة'), balance?.totals.consumptionTonnes],
    [label('Expected losses', 'الفاقد المتوقع'), balance?.totals.lossesTonnes],
    [label('Projected food gap', 'الفجوة الغذائية المتوقعة'), balance?.totals.deficitTonnes],
  ] as const

  return (
    <section className="rounded-xl border border-line bg-card p-4 space-y-3" aria-label="Food supply and demand balance">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium text-content">{label('Supply & demand balance', 'ميزان العرض والطلب')}</h2>
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${mode === 'demo' ? 'bg-warning-soft text-warning-strong' : 'bg-muted text-content-soft'}`}>
              {mode === 'demo' ? 'DEMO / SIMULATED' : 'ORGANIZATION / SOURCE DATA'}
            </span>
          </div>
          <p className="text-[12px] text-content-soft">
            {label('Organization level only. Not verified Qatar national totals.', 'بيانات على مستوى المؤسسة فقط، وليست إحصاءات وطنية معتمدة.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={label('Forecast horizon', 'فترة التوقع')}
            className="h-9 rounded-lg border border-line bg-card px-2 text-[12px] text-content"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 {label('days', 'أيام')}</option>
            <option value={30}>30 {label('days', 'يوماً')}</option>
            <option value={90}>90 {label('days', 'يوماً')}</option>
            <option value={180}>180 {label('days', 'يوماً')}</option>
          </select>
          <button
            type="button"
            onClick={() => setMode((previous) => previous === 'live' ? 'demo' : 'live')}
            className="h-9 rounded-lg border border-line-strong bg-card px-3 text-[12px] text-content hover:bg-muted"
          >
            {mode === 'demo' ? label('View live', 'عرض البيانات الفعلية') : label('Try demo', 'عرض توضيحي')}
          </button>
          <button
            type="button"
            aria-label={label('Refresh balance', 'تحديث الميزان')}
            onClick={() => setRefresh((value) => value + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-content hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {organizationLoading || loading ? (
        <p className="text-[13px] text-content-soft">{label('Loading balance...', 'جارٍ تحميل الميزان...')}</p>
      ) : !organizationId ? (
        <p className="text-[13px] text-content-soft">{label('Select an organization first.', 'يرجى اختيار مؤسسة أولاً.')}</p>
      ) : error ? (
        <p role="alert" className="text-[13px] text-critical">{error}</p>
      ) : balance ? (
        <>
          {balance.status === 'insufficient_data' && (
            <p className="rounded-lg border border-warning-line bg-warning-soft p-2 text-[12px] text-content">
              {label('Insufficient verified data for a complete balance. Missing components show as unavailable.', 'البيانات المعتمدة غير كافية لحساب الميزان الكامل.')}
            </p>
          )}
          {mode === 'demo' && (
            <p className="rounded-lg border border-warning-line bg-warning-soft p-2 text-[12px] font-semibold text-warning-strong">
              DEMO / SIMULATED: {label('Illustrative synthetic figures, not national statistics.', 'أرقام افتراضية توضيحية وليست إحصاءات وطنية.')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {metrics.map(([name, number]) => (
              <div className="rounded-lg border border-line p-2.5" key={name}>
                <p className="text-[11px] text-content-soft">{name}</p>
                <p className="mt-1 text-[19px] font-medium tabular-nums text-content">{fmt(number ?? null)}</p>
                <p className="text-[10px] text-content-soft">t</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-content-soft">
            <span>{label('Forecast closing stock', 'المخزون المتوقع')}: <strong className="text-content">{fmt(balance.totals.projectedClosingStockTonnes)} t</strong></span>
            <span>{label('Projected coverage', 'التغطية المتوقعة')}: <strong className="text-content">{fmt(balance.totals.projectedCoverageDays)} {label('days', 'أيام')}</strong></span>
            <span>{balance.fromDate} → {balance.toDate}</span>
          </div>
          {balance.evidence.warnings.length > 0 && (
            <ul className="list-disc ps-5 text-[11px] text-content-soft space-y-1">
              {balance.evidence.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          <p className="text-[11px] text-content-soft">
            {label('Record coverage', 'تغطية السجلات')}: {balance.evidence.missingCoverage.length === 0 ? label('all declared complete', 'مكتملة حسب الإقرار') : balance.evidence.missingCoverage.join(', ')}
          </p>
          <p className="text-[11px] text-content-soft">
            {label('Sources', 'المصادر')}: {balance.evidence.sourceRefs.length > 0
              ? balance.evidence.sourceRefs.slice(0, 4).join(' · ')
              : label('No validated source records', 'لا توجد مصادر معتمدة')}
          </p>
          <details className="rounded-lg border border-line bg-muted/30 p-3">
            <summary className="cursor-pointer text-[13px] font-medium text-content">
              {label('Scenario simulator (what-if preview)', 'محاكاة السيناريوهات الافتراضية')}
              <span className="ms-2 text-[10px] font-semibold text-warning-strong">SIMULATED</span>
            </summary>
            <p className="mt-2 text-[12px] text-content-soft">
              {label(
                'Change aggregate assumptions to compare a scenario against the current balance. Results are not forecasts and do not change live inventory or procurement.',
                'عدّل الافتراضات الإجمالية لمقارنة سيناريو بالرصيد الحالي. النتائج ليست توقعات ولا تغيّر المخزون أو المشتريات الفعلية.',
              )}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {scenarioControls.map(({ key, en, ar: arName }) => (
                <label key={key} className="block rounded-md border border-line bg-card px-3 py-2">
                  <span className="flex items-center justify-between gap-3 text-[12px] text-content">
                    <span>{label(en, arName)}</span>
                    <strong className="tabular-nums">{scenarioSettings[key]}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={scenarioSettings[key]}
                    onChange={(event) => setScenarioSettings((previous) => ({
                      ...previous,
                      [key]: Number(event.target.value),
                    }))}
                    className="mt-2 w-full accent-sage-700"
                    aria-label={label(en, arName)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => setScenarioSettings({ ...ZERO_FOOD_SCENARIO })}
                className="rounded-md border border-line-strong bg-card px-3 py-1.5 text-[12px] text-content hover:bg-muted">
                {label('Reset shocks', 'إعادة تعيين الصدمات')}
              </button>
            </div>
            {scenarioImpact?.status === 'complete' ? (
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-live="polite">
                <div className="rounded-md border border-line bg-card p-2">
                  <p className="text-[11px] text-content-soft">{label('Baseline net balance', 'الرصيد الأساسي')}</p>
                  <p className="text-[18px] font-medium tabular-nums">{fmt(scenarioImpact.totals.baselineProjectedBalanceTonnes)} t</p>
                </div>
                <div className="rounded-md border border-line bg-card p-2">
                  <p className="text-[11px] text-content-soft">{label('Scenario net balance', 'الرصيد في السيناريو')}</p>
                  <p className="text-[18px] font-medium tabular-nums">{fmt(scenarioImpact.totals.scenarioProjectedBalanceTonnes)} t</p>
                </div>
                <div className="rounded-md border border-line bg-card p-2">
                  <p className="text-[11px] text-content-soft">{label('Scenario deficit', 'العجز في السيناريو')}</p>
                  <p className="text-[18px] font-medium tabular-nums">{fmt(scenarioImpact.totals.scenarioDeficitTonnes)} t</p>
                </div>
                <div className="rounded-md border border-line bg-card p-2">
                  <p className="text-[11px] text-content-soft">{label('Scenario coverage', 'التغطية في السيناريو')}</p>
                  <p className="text-[18px] font-medium tabular-nums">{fmt(scenarioImpact.totals.scenarioCoverageDays)} {label('days', 'أيام')}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-warning-strong">
                {label('A complete food balance is required before simulating a scenario.', 'يلزم وجود رصيد غذائي مكتمل قبل محاكاة السيناريو.')}
              </p>
            )}
            <p className="mt-2 text-[11px] text-content-soft">
              {label('Preview only. Not saved, not a daily stockout model, and never used to authorize operational decisions.',
                'للمعاينة فقط. لا تُحفظ النتائج ولا تمثل نموذجاً يومياً لنفاد المخزون ولا تُستخدم لاعتماد القرارات التشغيلية.')}
            </p>
          </details>
          {mode === 'live' && organizationId && (
            <FoodSourceIntake
              organizationId={organizationId}
              commodityId={commodityId}
              onRecordsChanged={() => setRefresh(value => value + 1)}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
