'use client'

import { useState } from 'react'
import type { FoodSourceKind } from '@/lib/food-security/ingestion'
import { FOOD_CSV_COLUMNS, FOOD_CSV_MAX_BYTES } from '@/lib/food-security/csv-import'
import { useI18n } from '@/lib/i18n'

interface CsvPreview {
  count: number
  kind: FoodSourceKind
  commodityId: string
  sample: Array<{ sourceRef: string; dataMode: string; detail: string }>
}

export function FoodCsvImporter({
  organizationId, commodityId, onImported,
}: {
  organizationId: string
  commodityId: string
  onImported: () => void
}) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const label = (en: string, arabic: string) => ar ? arabic : en
  const [kind, setKind] = useState<FoodSourceKind>('flow')
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function chooseFile(file: File | undefined) {
    setContent('')
    setPreview(null)
    setError('')
    setNotice('')
    setFileName(file?.name ?? '')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > FOOD_CSV_MAX_BYTES) {
      setError(label('Choose a CSV file under 256 KiB.', 'اختر ملف CSV أصغر من 256 كيلوبايت.'))
      return
    }
    try {
      const csv = await file.text()
      setContent(csv)
    } catch {
      setError(label('Could not read the selected file.', 'تعذرت قراءة الملف المحدد.'))
    }
  }

  function template() {
    const blob = new Blob([FOOD_CSV_COLUMNS[kind].join(',') + '\n'], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'nfii-' + kind + '-source-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function submit(mode: 'preview' | 'commit') {
    if (!content || busy || (mode === 'commit' && !preview)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/food-security/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, organizationId, commodityId, kind, csv: content }),
      })
      const data: {
        error?: string
        preview?: CsvPreview
        imported?: number
        notice?: string
        conflicts?: number
      } = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to process CSV')
      if (mode === 'preview') {
        if (!data.preview) throw new Error('Preview response missing')
        setPreview(data.preview)
        setNotice(label('Preview verified. No records have been written.', 'تم فحص المعاينة ولم تُكتب أي سجلات.'))
      } else {
        setPreview(null)
        setContent('')
        setFileName('')
        setNotice((data.imported ?? 0) + ' ' +
          label('records submitted for independent review.', 'سجلات أرسلت للمراجعة المستقلة.'))
        onImported()
      }
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'h-9 rounded-md border border-line bg-card px-2 text-[12px] text-content'

  return (
    <section className="mt-3 space-y-3 rounded-lg border border-line bg-card p-3"
      aria-label="CSV source import">
      <div>
        <h3 className="text-[13px] font-medium text-content">
          {label('Import source data from CSV', 'استيراد البيانات المصدرية من CSV')}
        </h3>
        <p className="mt-1 text-[12px] text-content-soft">
          {label(
            'One commodity and record type per CSV, up to 200 records. Preview first. Every imported record requires an independent review.',
            'سلعة ونوع سجل واحد لكل ملف، بحد أقصى 200 سجل. عاين أولاً، وجميع السجلات المستوردة تتطلب مراجعة مستقلة.',
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-content-soft">
          {label('Record type', 'نوع السجل')}
          <select value={kind} className={inputClass} onChange={(event) => {
            setKind(event.target.value as FoodSourceKind)
            setPreview(null)
            setContent('')
            setFileName('')
          }}>
            <option value="stock">{label('Stock snapshots', 'أرصدة المخزون')}</option>
            <option value="flow">{label('Production / import / demand / loss', 'إنتاج / واردات / طلب / فاقد')}</option>
            <option value="coverage">{label('Period completeness', 'اكتمال الفترة')}</option>
          </select>
        </label>
        <button type="button" onClick={template}
          className="rounded-md border border-line px-3 py-2 text-[12px] text-content">
          {label('Download CSV template', 'تنزيل قالب CSV')}
        </button>
        <label className="flex flex-col gap-1 text-[12px] text-content-soft">
          {label('Select CSV file', 'اختر ملف CSV')}
          <input key={kind} type="file" accept=".csv,text/csv"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
            className="max-w-[230px] text-[11px] text-content" />
        </label>
        <button type="button" onClick={() => void submit('preview')}
          disabled={!content || busy}
          className="rounded-md border border-line-strong px-3 py-2 text-[12px] text-content disabled:opacity-40">
          {busy ? '…' : label('Validate & preview', 'تحقق وعاين')}
        </button>
      </div>

      {fileName && <p className="text-[11px] text-content-soft">{fileName}</p>}
      {error && <p role="alert" className="text-[12px] text-critical">{error}</p>}
      {notice && <p role="status" className="text-[12px] text-sage-700">{notice}</p>}

      {preview && (
        <div className="space-y-2 rounded-md border border-line bg-muted/30 p-3">
          <p className="text-[12px] font-semibold text-content">
            {preview.count} {label('validated rows. NOT imported yet.', 'صفوف تم التحقق منها ولم تُستورد بعد.')}
          </p>
          <ul className="space-y-1 text-[11px] text-content-soft">
            {preview.sample.map((row, index) => (
              <li key={index}>
                {row.sourceRef}: {row.detail} ({row.dataMode})
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-content-soft">
            {label(
              'Committed rows will be pending_review and will NOT enter the verified balance until approved by a different authorized user.',
              'ستكون السجلات المستوردة قيد المراجعة ولن تُحتسب في الميزان المعتمد حتى يوافق عليها مستخدم مخول آخر.',
            )}
          </p>
          <button type="button" disabled={busy} onClick={() => void submit('commit')}
            className="rounded-md bg-ink px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
            {busy ? '…' : label('Import all as pending review', 'استيراد الكل بانتظار المراجعة')}
          </button>
        </div>
      )}
    </section>
  )
}
