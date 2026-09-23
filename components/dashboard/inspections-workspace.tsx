'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  MapPin,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useOperationalContext } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

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

export function InspectionsWorkspace() {
  const { locale } = useI18n()
  const searchParams = useSearchParams()
  const { goToFarm, goToModule } = useOperationalContext()
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
      if (!res.ok) throw new Error(payload.error || 'Failed to create')
      setShowForm(false)
      setTitle('')
      setSummary('')
      setFarmId(farmIdFromUrl || '')
      await load()
      if (payload.inspection?.id) setSelectedId(payload.inspection.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
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
      if (!res.ok) throw new Error(payload.error || 'Failed to advance')
      await load()
      setSelectedId(id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
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
      if (!res.ok) throw new Error(payload.error || 'Failed to save')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    }
  }

  const activeQueue = items.filter((item) => item.status !== 'closed')
  const completed = items.filter((item) => item.status === 'closed')

  return (
    <div className="flex h-full flex-col bg-[#050608] text-white overflow-hidden">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#07f880]" />
              {locale === 'ar' ? 'التفتيشات الميدانية' : 'Field Inspections'}
            </h1>
            <p className="text-xs text-white/45 mt-1">
              Assigned → Prepare → Visit → Evidence → Findings → Verification → Closure
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1 rounded bg-[#07f880]/15 px-3 py-1.5 text-xs text-[#07f880]"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === 'ar' ? 'تفتيش جديد' : 'New inspection'}
            </button>
            <button type="button" onClick={load} className="rounded border border-white/10 px-2 py-1.5 text-white/50">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="mt-3">
          <OperationalContextBanner />
        </div>
        {unavailable && (
          <p className="mt-2 text-xs text-amber-300">Apply migration 00030 for inspections persistence.</p>
        )}
      </header>

      {showForm && (
        <div className="shrink-0 border-b border-white/10 px-5 py-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Inspection title"
            className="w-full rounded border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm"
          />
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Scope / objective"
            className="w-full rounded border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm min-h-[60px]"
          />
          <input
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
            placeholder="Farm ID (optional)"
            className="w-full rounded border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={create}
            className="rounded bg-[#07f880] px-4 py-1.5 text-sm font-medium text-black"
          >
            Create inspection
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="w-full max-w-sm shrink-0 border-r border-white/10 overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Active queue ({activeQueue.length})
          </p>
          {activeQueue.length === 0 ? (
            <p className="text-sm text-white/40 py-8 text-center">
              No active inspections.
              <Link href="/dashboard?module=watchtower" className="block mt-2 text-[#07f880] hover:underline">
                Open Watchtower
              </Link>
            </p>
          ) : (
            activeQueue.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                  selectedId === item.id
                    ? 'border-[#07f880]/30 bg-[#07f880]/10'
                    : 'border-white/10 bg-[#0a0d12] hover:border-white/20'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <span className="text-[10px] uppercase text-white/40">{item.priority}</span>
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-[#07f880]/80">
                  {STATUS_LABELS[item.status] || item.status}
                </p>
                {item.summary && <p className="mt-1 text-xs text-white/50 line-clamp-2">{item.summary}</p>}
              </button>
            ))
          )}

          {completed.length > 0 && (
            <>
              <p className="pt-4 text-[10px] uppercase tracking-widest text-white/40">
                Closed ({completed.length})
              </p>
              {completed.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full rounded-lg border border-white/10 bg-[#0a0d12]/60 px-3 py-2 text-left opacity-70"
                >
                  <p className="text-sm">{item.title}</p>
                </button>
              ))}
            </>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              Select an inspection to manage the field workflow.
            </div>
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
        </main>
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
        <h2 className="text-xl font-semibold">{inspection.title}</h2>
        {inspection.summary && <p className="mt-1 text-sm text-white/55">{inspection.summary}</p>}
      </div>

      <div className="flex flex-wrap gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const active = index === currentIndex
          const complete = index < currentIndex
          return (
            <div
              key={step}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider',
                active && 'border-[#07f880]/40 bg-[#07f880]/15 text-[#07f880]',
                complete && 'border-white/10 bg-white/5 text-white/50',
                !active && !complete && 'border-white/10 text-white/30'
              )}
            >
              {STATUS_LABELS[step]}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {inspection.farm_id && (
          <button
            type="button"
            onClick={onOpenFarm}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            <MapPin className="h-3.5 w-3.5" />
            Open farm workspace
          </button>
        )}
        <button
          type="button"
          onClick={onOpenMap}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          <MapPin className="h-3.5 w-3.5" />
          National map
        </button>
        {inspection.status !== 'closed' && (
          <button
            type="button"
            onClick={onAdvance}
            className="inline-flex items-center gap-1 rounded bg-[#07f880] px-3 py-1.5 text-xs font-medium text-black"
          >
            Advance workflow
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {(inspection.status === 'evidence' ||
        inspection.status === 'findings' ||
        inspection.status === 'verification' ||
        inspection.status === 'closed') && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0d12] p-4">
          <label className="block text-xs uppercase tracking-wider text-white/40">Evidence notes</label>
          <textarea
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            className="w-full min-h-[80px] rounded border border-white/10 bg-[#050608] px-3 py-2 text-sm"
          />
          <label className="block text-xs uppercase tracking-wider text-white/40">Findings</label>
          <textarea
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            className="w-full min-h-[100px] rounded border border-white/10 bg-[#050608] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onSaveNotes(findings, evidenceNotes)}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Save evidence & findings
          </button>
        </div>
      )}
    </div>
  )
}
