'use client'

/*
 * Edit forms for map points and polygons.
 *
 * They replace chains of `window.prompt()`: up to twelve grey system boxes in
 * a row for one polygon, English only, no validation, crop and variety typed
 * blind from a comma list inside the prompt text, and a Cancel halfway that
 * silently kept some answers and dropped others. One brand modal per object,
 * every field visible at once, crop and variety suggested from the catalogue,
 * dates as date inputs, numbers checked before saving.
 */

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Button, Field, Modal, Select, Textarea } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

const DIALOG_Z = 2600 // above the map panes (≤1000), header (1200) and rail (2100)

type Locale = string

/* ------------------------------------------------------------------ *
 * Point
 * ------------------------------------------------------------------ */

export interface PointEditValues {
  label: string
  pointType: string
  externalUrl: string
}

export function PointEditDialog({
  open,
  initial,
  typeOptions,
  onCancel,
  onSave,
}: {
  open: boolean
  locale: Locale
  initial: PointEditValues | null
  typeOptions: Array<{ value: string; label: string }>
  onCancel: () => void
  onSave: (values: PointEditValues) => void
}) {
  const { tr } = useI18n()
  const formId = useId()
  const [values, setValues] = useState<PointEditValues>({ label: '', pointType: 'custom', externalUrl: '' })

  useEffect(() => {
    if (open && initial) setValues(initial)
  }, [open, initial])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave({ ...values, label: values.label.trim() || initial?.label || '' })
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={tr('Edit point')}
      zIndex={DIALOG_Z}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {tr('Cancel')}
          </Button>
          <Button type="submit" form={formId}>
            {tr('Save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field
          label={tr('Name')}
          value={values.label}
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
          autoFocus
          required
        />
        <Select
          label={tr('Type')}
          value={values.pointType}
          onChange={(e) => setValues((v) => ({ ...v, pointType: e.target.value }))}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Field
          label={tr('External page')}
          hint={tr('Optional. A link to the farm or site page.')}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={values.externalUrl}
          onChange={(e) => setValues((v) => ({ ...v, externalUrl: e.target.value }))}
        />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ *
 * Polygon
 * ------------------------------------------------------------------ */

export interface PolygonEditValues {
  name: string
  score: number
  cropName: string
  variety: string
  sowingDate: string
  expectedHarvestDate: string
  notes: string
  estimatedProductionTons: string
  energyConsumptionKwh: string
  waterConsumptionM3: string
}

function isNonNegativeNumber(raw: string) {
  if (raw.trim() === '') return true
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n >= 0
}

export function PolygonEditDialog({
  open,
  locale,
  initial,
  cropOptions,
  onCancel,
  onSave,
}: {
  open: boolean
  locale: Locale
  initial: PolygonEditValues | null
  cropOptions: Array<{ nameEn: string; nameAr: string; varieties: string[] }>
  onCancel: () => void
  onSave: (values: PolygonEditValues) => void
}) {
  const { tr } = useI18n()
  const formId = useId()
  const cropListId = useId()
  const varietyListId = useId()
  const [values, setValues] = useState<PolygonEditValues | null>(null)

  useEffect(() => {
    if (open && initial) setValues(initial)
  }, [open, initial])

  const varieties = useMemo(() => {
    const crop = values?.cropName.trim().toLowerCase()
    if (!crop) return []
    return cropOptions.find((option) => option.nameEn.trim().toLowerCase() === crop)?.varieties ?? []
  }, [cropOptions, values?.cropName])

  if (!values) return null

  const set = <K extends keyof PolygonEditValues>(key: K, value: PolygonEditValues[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current))

  const numberError = (raw: string) =>
    isNonNegativeNumber(raw) ? undefined : tr('Enter a number, 0 or more.')
  const dateOrderError =
    values.sowingDate && values.expectedHarvestDate && values.expectedHarvestDate < values.sowingDate
      ? tr('Harvest must come after sowing.')
      : undefined
  const invalid =
    Boolean(dateOrderError) ||
    !isNonNegativeNumber(values.estimatedProductionTons) ||
    !isNonNegativeNumber(values.energyConsumptionKwh) ||
    !isNonNegativeNumber(values.waterConsumptionM3)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid) return
    onSave({ ...values, name: values.name.trim() || initial?.name || '' })
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      title={tr('Edit polygon')}
      zIndex={DIALOG_Z}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {tr('Cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={invalid}>
            {tr('Save changes')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label={tr('Name')} value={values.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
          <div>
            <label className="block text-[13px] text-content mb-2" htmlFor={`${formId}-score`} style={{ fontWeight: 500 }}>
              {tr('Health score')}{' '}
              <span className="text-content-soft tabular-nums">{values.score}/100</span>
            </label>
            <input
              id={`${formId}-score`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={values.score}
              onChange={(e) => set('score', Number(e.target.value))}
              className="g-range w-full"
            />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="growa-eyebrow mb-3">{tr('Crop')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tr('Crop')}
              list={cropListId}
              value={values.cropName}
              onChange={(e) => set('cropName', e.target.value)}
            />
            <Field
              label={tr('Variety')}
              list={varietyListId}
              value={values.variety}
              onChange={(e) => set('variety', e.target.value)}
              hint={varieties.length ? tr('{count} known varieties', { count: varieties.length }) : undefined}
            />
            <Field
              label={tr('Sowing date')}
              type="date"
              value={values.sowingDate}
              onChange={(e) => set('sowingDate', e.target.value)}
            />
            <Field
              label={tr('Expected harvest')}
              type="date"
              min={values.sowingDate || undefined}
              value={values.expectedHarvestDate}
              onChange={(e) => set('expectedHarvestDate', e.target.value)}
              error={dateOrderError}
            />
          </div>
          <datalist id={cropListId}>
            {cropOptions.map((option) => (
              <option key={option.nameEn} value={option.nameEn}>
                {locale === 'ar' ? option.nameAr : undefined}
              </option>
            ))}
          </datalist>
          <datalist id={varietyListId}>
            {varieties.map((variety) => (
              <option key={variety} value={variety} />
            ))}
          </datalist>
          <Textarea label={tr('Notes')} rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} />
        </fieldset>

        <fieldset>
          <legend className="growa-eyebrow mb-3">{tr('Season figures')}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={tr('Production')}
              inputMode="decimal"
              suffix={<span className="text-[12px] text-content-soft">t</span>}
              value={values.estimatedProductionTons}
              onChange={(e) => set('estimatedProductionTons', e.target.value)}
              error={numberError(values.estimatedProductionTons)}
            />
            <Field
              label={tr('Energy')}
              inputMode="decimal"
              suffix={<span className="text-[12px] text-content-soft">kWh</span>}
              value={values.energyConsumptionKwh}
              onChange={(e) => set('energyConsumptionKwh', e.target.value)}
              error={numberError(values.energyConsumptionKwh)}
            />
            <Field
              label={tr('Water')}
              inputMode="decimal"
              suffix={<span className="text-[12px] text-content-soft">m³</span>}
              value={values.waterConsumptionM3}
              onChange={(e) => set('waterConsumptionM3', e.target.value)}
              error={numberError(values.waterConsumptionM3)}
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
