'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { useI18n } from '@/lib/i18n'
import type { FoodFlowType } from '@/lib/food-security/balance'
import type { FoodSourceKind } from '@/lib/food-security/ingestion'
import { FoodCsvImporter } from '@/components/dashboard/food-csv-importer'

interface FoodSourceRow {
  id: string
  kind: FoodSourceKind
  sourceRef: string
  sourceKind: string
  dataMode: string
  verificationStatus: 'pending_review' | 'verified' | 'rejected'
  submittedBy: string | null
  createdAt: string
  dateLabel: string
  detail: string
}

const FLOW_TYPES: { value: FoodFlowType; en: string; ar: string }[] = [
  { value: 'domestic_production', en: 'Domestic production', ar: 'الإنتاج المحلي' },
  { value: 'confirmed_import', en: 'Confirmed import', ar: 'الواردات المؤكدة' },
  { value: 'consumption', en: 'Consumption / demand', ar: 'الاستهلاك / الطلب' },
  { value: 'loss', en: 'Losses', ar: 'الفاقد' },
]

function qatarToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function previousDate(): string {
  const d = new Date(`${qatarToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Manual source assertions are staged for independent review.
 * This component never talks directly to privileged Supabase tables.
 */
export function FoodSourceIntake({
  organizationId, commodityId, onRecordsChanged,
}: {
  organizationId: string
  commodityId: string
  onRecordsChanged: () => void
}) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const label = (en: string, arabic: string) => ar ? arabic : en
  const active = useActiveOrganizationOptional()
  const canEdit = active?.hasPermission('supply.edit') ?? false
  const canReview = active?.hasPermission('decisions.approve') ?? false
  // No personal user ID is taken from the browser for authorization.
  // Self-review is checked by the protected API and by its SQL trigger.

  const [kind, setKind] = useState<FoodSourceKind>('stock')
  const [sourceRef, setSourceRef] = useState('')
  const [dataMode, setDataMode] = useState<'observed' | 'estimated' | 'forecast'>('estimated')
  const [asOfDate, setAsOfDate] = useState(previousDate)
  const [effectiveDate, setEffectiveDate] = useState(qatarToday)
  const [quantity, setQuantity] = useState('')
  const [flowType, setFlowType] = useState<FoodFlowType>('domestic_production')
  const [externalKey, setExternalKey] = useState('')
  const [startDate, setStartDate] = useState(qatarToday)
  const [endDate, setEndDate] = useState(qatarToday)
  const [coverageStatus, setCoverageStatus] = useState<'partial' | 'complete'>('partial')
  const [reviewReason, setReviewReason] = useState('')
  const [records, setRecords] = useState<FoodSourceRow[]>([])
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setRecords([])
    setLoading(true)
    const load = async () => {
      try {
        const params = new URLSearchParams({ organizationId, commodityId })
        const response = await fetch(`/api/food-security/records?${params}`, {
          cache: 'no-store', signal: controller.signal,
        })
        const result: { records?: FoodSourceRow[]; error?: string } = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Unable to fetch source records')
        if (!controller.signal.aborted) {
          setRecords(result.records ?? [])
          setError('')
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Source data unavailable')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [organizationId, commodityId, reload])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const common = { kind, organizationId, commodityId, sourceRef, dataMode }
    const payload = kind === 'stock'
      ? { ...common, asOfDate, usableTonnes: quantity }
      : kind === 'flow'
        ? { ...common, externalKey, flowType, effectiveDate, quantityTonnes: quantity }
        : { ...common, flowType, startDate, endDate, status: coverageStatus }

    try {
      const response = await fetch('/api/food-security/records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result: { error?: string; notice?: string } = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Source submission failed')
      setNotice(result.notice ?? label('Submitted for independent review.', 'تم الإرسال للمراجعة المستقلة.'))
      setQuantity('')
      setExternalKey('')
      setReload(value => value + 1)
      onRecordsChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  const review = async (record: FoodSourceRow, decision: 'verify' | 'reject') => {
    if (!canReview || busy || reviewReason.trim().length < 8) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/food-security/records/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId, kind: record.kind, recordId: record.id,
          decision, reason: reviewReason.trim(),
        }),
      })
      const result: { error?: string; notice?: string } = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Review failed')
      setNotice(result.notice ?? '')
      setReviewReason('')
      setReload(value => value + 1)
      onRecordsChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review failed')
    } finally {
      setBusy(false)
    }
  }

  const pendingCount = records.filter(row => row.verificationStatus === 'pending_review').length
  const fieldClass = 'h-9 w-full rounded-md border border-line bg-card px-2 text-[12px] text-content'
  const fieldLabel = 'block space-y-1 text-[12px] text-content-soft'

  return (
    <details className="rounded-lg border border-line bg-card p-3" aria-label="Food source data intake">
      <summary className="cursor-pointer text-[13px] font-medium text-content">
        {label('Source data & independent review', 'البيانات المصدرية والمراجعة المستقلة')}
        <span className="ms-2 text-[11px] text-content-soft">
          {pendingCount} {label('pending', 'قيد المراجعة')}
        </span>
      </summary>
      <p className="mt-2 text-[12px] text-content-soft">
        {label(
          'Organization-scoped operator submissions. Only independently reviewed records enter the balance. Approval is not a certification of Qatar-wide statistics.',
          'إدخالات خاصة بالمؤسسة. لا تدخل البيانات في الميزان إلا بعد مراجعة مستقلة، ولا يعني ذلك اعتمادها كإحصاءات وطنية.',
        )}
      </p>

      {error && <p role="alert" className="mt-3 text-[12px] text-critical">{error}</p>}
      {notice && <p role="status" className="mt-3 text-[12px] text-sage-700">{notice}</p>}

      {canEdit && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border border-line p-3">
          <h3 className="text-[13px] font-medium text-content">{label('Submit a source record', 'إرسال سجل مصدري')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={fieldLabel}>
              {label('Record type', 'نوع السجل')}
              <select className={fieldClass} value={kind} onChange={event => {
                const next = event.target.value as FoodSourceKind
                setKind(next)
                if (next === 'stock' && dataMode === 'forecast') setDataMode('estimated')
              }}>
                <option value="stock">{label('Usable inventory snapshot', 'رصيد المخزون القابل للاستخدام')}</option>
                <option value="flow">{label('Production / import / demand / loss', 'إنتاج / واردات / طلب / فاقد')}</option>
                <option value="coverage">{label('Period completeness declaration', 'إقرار اكتمال الفترة')}</option>
              </select>
            </label>
            <label className={fieldLabel}>
              {label('Data classification', 'تصنيف البيانات')}
              <select className={fieldClass} value={dataMode} onChange={event => setDataMode(event.target.value as typeof dataMode)}>
                <option value="observed">{label('Observed', 'مرصودة')}</option>
                <option value="estimated">{label('Estimated', 'مقدرة')}</option>
                {kind !== 'stock' && <option value="forecast">{label('Forecast', 'متوقعة')}</option>}
              </select>
            </label>
            <label className={fieldLabel}>
              {label('Source reference / document ID', 'مرجع المصدر / رقم المستند')}
              <input className={fieldClass} value={sourceRef} onChange={event => setSourceRef(event.target.value)}
                required minLength={3} maxLength={180} placeholder="warehouse-report:2026-11-01"/>
            </label>

            {kind !== 'stock' && (
              <label className={fieldLabel}>
                {label('Flow category', 'فئة التدفق')}
                <select className={fieldClass} value={flowType} onChange={event => setFlowType(event.target.value as FoodFlowType)}>
                  {FLOW_TYPES.map(item => <option key={item.value} value={item.value}>{ar ? item.ar : item.en}</option>)}
                </select>
              </label>
            )}
            {kind === 'stock' && (
              <label className={fieldLabel}>
                {label('End-of-day stock date', 'تاريخ المخزون بنهاية اليوم')}
                <input className={fieldClass} type="date" value={asOfDate} onChange={event => setAsOfDate(event.target.value)} required/>
              </label>
            )}
            {kind === 'flow' && (
              <>
                <label className={fieldLabel}>
                  {label('Effective date', 'تاريخ السريان')}
                  <input className={fieldClass} type="date" value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} required/>
                </label>
                <label className={fieldLabel}>
                  {label('Unique movement reference', 'معرف الحركة الفريد')}
                  <input className={fieldClass} value={externalKey} onChange={event => setExternalKey(event.target.value)}
                    required minLength={3} maxLength={160} placeholder="shipment:2026-11:001"/>
                </label>
              </>
            )}
            {kind === 'coverage' && (
              <>
                <label className={fieldLabel}>
                  {label('Coverage start', 'بداية التغطية')}
                  <input className={fieldClass} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required/>
                </label>
                <label className={fieldLabel}>
                  {label('Coverage end', 'نهاية التغطية')}
                  <input className={fieldClass} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} required/>
                </label>
                <label className={fieldLabel}>
                  {label('Completeness', 'الاكتمال')}
                  <select className={fieldClass} value={coverageStatus} onChange={event => setCoverageStatus(event.target.value as typeof coverageStatus)}>
                    <option value="partial">{label('Partial / unconfirmed', 'جزئي / غير مؤكد')}</option>
                    <option value="complete">{label('Full period confirmed by source', 'فترة كاملة يؤكدها المصدر')}</option>
                  </select>
                </label>
              </>
            )}
            {kind !== 'coverage' && (
              <label className={fieldLabel}>
                {label('Quantity (metric tonnes)', 'الكمية (طن متري)')}
                <input className={fieldClass} type="number" min="0" step="0.001" required value={quantity}
                  onChange={event => setQuantity(event.target.value)} placeholder="0.000"/>
              </label>
            )}
          </div>
          <button type="submit" disabled={busy} className="rounded-md bg-ink px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50">
            {label('Submit for independent review', 'إرسال للمراجعة المستقلة')}
          </button>
        </form>
      )}

      {canEdit && (
        <FoodCsvImporter
          organizationId={organizationId}
          commodityId={commodityId}
          onImported={() => {
            setReload(value => value + 1)
            onRecordsChanged()
          }}
        />
      )}
      <div className="mt-4 space-y-2">
        <h3 className="text-[13px] font-medium text-content">
          {label('Latest source records', 'أحدث السجلات المصدرية')}
          <span className="ms-2 text-[11px] font-normal text-content-soft">({records.length})</span>
        </h3>
        {canReview && records.some(row => row.verificationStatus === 'pending_review') && (
          <label className={fieldLabel}>
            {label('Reason for review (required; at least 8 characters)', 'سبب قرار المراجعة (إلزامي)')}
            <input className={fieldClass} minLength={8} maxLength={2000}
              value={reviewReason} onChange={event => setReviewReason(event.target.value)}
              placeholder={label('Checked source document and period', 'تمت مراجعة المستند والفترة')}/>
          </label>
        )}
        {loading ? (
          <p className="text-[12px] text-content-soft">{label('Loading source records…', 'جارٍ تحميل السجلات…')}</p>
        ) : records.length === 0 ? (
          <p className="text-[12px] text-content-soft">{label('No source records in this organization for this commodity.', 'لا توجد سجلات لهذه السلعة في المؤسسة.')}</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {records.slice(0, 60).map(row => (
              <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
                <div className="min-w-0 text-[12px] text-content">
                  <div className="flex flex-wrap gap-2 items-center">
                    <strong>{row.detail}</strong>
                    <span className="text-content-soft">{row.dateLabel}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{row.verificationStatus.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-content-soft">
                    {row.sourceRef} · {row.dataMode} · {row.sourceKind}
                  </p>
                </div>
                {canReview && row.verificationStatus === 'pending_review' && (
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy || reviewReason.trim().length < 8}
                      onClick={() => void review(row, 'verify')}
                      className="rounded border border-line px-2.5 py-1.5 text-[11px] text-content disabled:opacity-40">
                      {label('Verify', 'تحقق')}
                    </button>
                    <button type="button" disabled={busy || reviewReason.trim().length < 8}
                      onClick={() => void review(row, 'reject')}
                      className="rounded border border-warning-line px-2.5 py-1.5 text-[11px] text-warning-strong disabled:opacity-40">
                      {label('Reject', 'رفض')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
