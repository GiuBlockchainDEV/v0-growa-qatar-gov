'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle, MapPin, Plus, RefreshCw } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/brand/feedback'
import { Card, CardAction, EmptyState, Notice, PageHeader } from '@/components/brand/layout'
import { Button, Field, StatusDot, Textarea } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'
import { FilePlus2, ListChecks } from 'lucide-react'

interface Inspection {
  id: string
  title: string
  summary: string | null
  status: string
  priority: string
  farm_id: string | null
  scheduled_at: string | null
  due_at: string | null
  findings: string | null
  evidence_notes: string | null
  created_at: string
}

const WORKFLOW_STEPS = [
  'assigned',
  'preparing',
  'on_site',
  'evidence',
  'findings',
  'verification',
  'closed',
] as const

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Assigned',
  preparing: 'Prepare',
  on_site: 'Visit',
  evidence: 'Collect evidence',
  findings: 'Record findings',
  verification: 'Verification',
  closed: 'Closed',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export function InspectionsWorkspace() {
  const showToast = useToast()
  const { tr } = useI18n()
  const searchParams = useSearchParams()
  const { goToFarm } = useOperationalContext()
  const farmIdFromUrl = searchParams.get('farmId')
  const inspectionIdFromUrl = searchParams.get('inspectionId')

  const [items, setItems] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(inspectionIdFromUrl)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [farmId, setFarmId] = useState(farmIdFromUrl || '')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const query = farmIdFromUrl ? `?farmId=${encodeURIComponent(farmIdFromUrl)}` : ''
      const res = await fetch(`/api/inspections${query}`, { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error)
      setUnavailable(Boolean(payload.unavailable))
      setItems(Array.isArray(payload.inspections) ? payload.inspections : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [farmIdFromUrl])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (inspectionIdFromUrl) setSelectedId(inspectionIdFromUrl)
  }, [inspectionIdFromUrl])

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  )

  const create = async () => {
    if (!title.trim()) return
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          farmId: farmId || undefined,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || tr('Failed to create'))
      setShowForm(false)
      setTitle('')
      setSummary('')
      setFarmId(farmIdFromUrl || '')
      await load()
      if (payload.inspection?.id) setSelectedId(payload.inspection.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed'), 'error')
    }
  }

  const advance = async (id: string) => {
    try {
      const res = await fetch(`/api/inspections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advance: true }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || tr('Failed to advance'))
      await load()
      setSelectedId(id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed'), 'error')
    }
  }

  const saveNotes = async (id: string, findings: string, evidenceNotes: string) => {
    try {
      const res = await fetch(`/api/inspections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings, evidenceNotes }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || tr('Failed to save'))
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed'), 'error')
    }
  }

  const activeQueue = items.filter((item) => item.status !== 'closed')
  const completed = items.filter((item) => item.status === 'closed')

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <PageHeader
          eyebrow={tr('Compliance')}
          title={tr('Field inspections')}
          subtitle={tr('Assigned → prepare → visit → evidence → findings → verification → closure.')}
          actions={
            <>
              <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
                <Plus strokeWidth={1.5} className="h-4 w-4" />
                {tr('New inspection')}
              </Button>
              <CardAction icon={RefreshCw} label={tr('Refresh')} onClick={load} spinning={loading} />
            </>
          }
          className="!mb-2"
        />
        <OperationalContextBanner />
        {unavailable && <Notice tone="warning">{tr('Apply migration {migration} for inspections persistence.', { migration: '00030' })}</Notice>}

        {showForm && (
          <Card family="comando" icon={FilePlus2} title={tr('New inspection')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="insp-title" label={tr('Title')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Inspection title')} />
              <Field id="insp-farm" label={tr('Farm ID')} hint={tr('Optional.')} value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder={tr('Farm ID')} />
              <Textarea id="insp-scope" className="sm:col-span-2" label={tr('Scope / objective')} value={summary} onChange={(e) => setSummary(e.target.value)} />
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{tr('Cancel')}</Button>
                <Button size="sm" onClick={create} disabled={!title.trim()}>{tr('Create inspection')}</Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <Card icon={ListChecks} title={tr('Active queue')} actions={<StatusTag level="progress" label={String(activeQueue.length)} />} bodyClassName="space-y-2">
            {activeQueue.length === 0 ? (
              <EmptyState
                compact
                title={tr('No active inspections')}
                action={
                  <DashboardQueryLink href="/dashboard?module=watchtower" className="text-[13px] text-sage-700 hover:text-ink transition-colors">
                    {tr('Open Watchtower')}
                  </DashboardQueryLink>
                }
              />
            ) : (
              activeQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={selectedId === item.id}
                  className={cn(
                    'w-full bg-card border px-3.5 py-3 text-start transition-colors',
                    selectedId === item.id ? 'border-sage ring-2 ring-sage/25' : 'border-line hover:border-line-strong'
                  )}
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14px] text-content" style={{ fontWeight: 500 }}>{item.title}</h3>
                    {item.priority && <StatusTag level={item.priority} label={tr(PRIORITY_LABEL[item.priority] ?? humanize(item.priority))} />}
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-[12px] text-content-soft">
                    <StatusDot tone="progress" size={6} />
                    {STATUS_LABELS[item.status] ? tr(STATUS_LABELS[item.status]) : humanize(item.status)}
                  </p>
                  {item.summary && <p className="mt-1 text-[12px] text-content-soft line-clamp-2">{item.summary}</p>}
                </button>
              ))
            )}

            {completed.length > 0 && (
              <>
                <hr className="growa-dotted-rule my-3" />
                <p className="text-[12px] text-content-soft">{tr('Closed · {count}', { count: completed.length })}</p>
                {completed.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="flex w-full items-center gap-2 px-1 py-1.5 text-start text-[13px] text-content-soft hover:text-content"
                  >
                    <StatusDot tone="good" size={6} />
                    {item.title}
                  </button>
                ))}
              </>
            )}
          </Card>

          <div className="bg-card border border-line p-6 min-h-[360px]" style={{ borderRadius: 'var(--radius-xl)' }}>
            {!selected ? (
              <EmptyState title={tr('No inspection selected')} description={tr('Select an inspection to manage the field workflow.')} />
            ) : (
              <InspectionDetail
                inspection={selected}
                onAdvance={() => advance(selected.id)}
                onSaveNotes={(findings, evidenceNotes) =>
                  saveNotes(selected.id, findings, evidenceNotes)
                }
                onOpenFarm={() => {
                  if (selected.farm_id) goToFarm(selected.farm_id, 'live-map')
                }}
                onOpenMap={() => {
                  if (selected.farm_id) goToFarm(selected.farm_id, 'live-map')
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InspectionDetail({
  inspection,
  onAdvance,
  onSaveNotes,
  onOpenFarm,
  onOpenMap,
}: {
  inspection: Inspection
  onAdvance: () => void
  onSaveNotes: (findings: string, evidenceNotes: string) => void
  onOpenFarm: () => void
  onOpenMap: () => void
}) {
  const { tr } = useI18n()
  const [findings, setFindings] = useState(inspection.findings || '')
  const [evidenceNotes, setEvidenceNotes] = useState(inspection.evidence_notes || '')
  const currentIndex = WORKFLOW_STEPS.indexOf(inspection.status as typeof WORKFLOW_STEPS[number])

  useEffect(() => {
    setFindings(inspection.findings || '')
    setEvidenceNotes(inspection.evidence_notes || '')
  }, [inspection])

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-content" style={{ fontSize: 'var(--text-heading)', fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>{inspection.title}</h2>
        {inspection.summary && <p className="mt-1 text-[14px] text-content-soft leading-[1.45]">{inspection.summary}</p>}
      </div>

      {/* Workflow as a row of squares: done = sage, current = ink with its
          label, still to come = unlit. */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label={tr('Workflow')}>
        {WORKFLOW_STEPS.map((step, index) => {
          const active = index === currentIndex
          const complete = index < currentIndex
          return (
            <li key={step} className="flex items-center gap-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill text-[12px]',
                  active ? 'bg-ink text-white' : complete ? 'text-content' : 'text-stone-500'
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span aria-hidden="true" className="w-1.5 h-1.5" style={{ borderRadius: 1, background: active ? 'var(--growa-cream)' : complete ? 'var(--status-good)' : 'var(--growa-stone-300)' }} />
                {tr(STATUS_LABELS[step])}
              </span>
              {index < WORKFLOW_STEPS.length - 1 && <span aria-hidden="true" className="w-3 border-t border-dotted border-line-strong" />}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {inspection.status !== 'closed' && (
          <Button size="sm" onClick={onAdvance}>
            {tr('Advance workflow')}
            <ArrowRight strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
          </Button>
        )}
        {inspection.farm_id && (
          <Button size="sm" variant="outline" onClick={onOpenFarm}>
            <MapPin strokeWidth={1.5} className="h-4 w-4" />
            {tr('Open farm workspace')}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onOpenMap}>
          <MapPin strokeWidth={1.5} className="h-4 w-4" />
          {tr('National map')}
        </Button>
      </div>

      {(inspection.status === 'evidence' ||
        inspection.status === 'findings' ||
        inspection.status === 'verification' ||
        inspection.status === 'closed') && (
        <div className="space-y-4 pt-5 border-t border-dotted border-line-strong">
          <Textarea id="insp-evidence" label={tr('Evidence notes')} rows={3} value={evidenceNotes} onChange={(e) => setEvidenceNotes(e.target.value)} />
          <Textarea id="insp-findings" label={tr('Findings')} rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => onSaveNotes(findings, evidenceNotes)}>
            <CheckCircle strokeWidth={1.5} className="h-4 w-4" />
            {tr('Save evidence and findings')}
          </Button>
        </div>
      )}
    </div>
  )
}
