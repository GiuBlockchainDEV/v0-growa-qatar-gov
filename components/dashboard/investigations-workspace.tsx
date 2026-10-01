'use client'

import { useCallback, useEffect, useState } from 'react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useI18n } from '@/lib/i18n'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { useToast } from '@/components/brand/feedback'
import { Card, CardAction, EmptyState, Notice, PageHeader } from '@/components/brand/layout'
import { Button, Field, Textarea } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'
import { FilePlus2 } from 'lucide-react'
import { sharedFetch } from '@/lib/client/shared-fetch'

interface Investigation {
  id: string
  title: string
  summary: string | null
  status: string
  priority: string
  source_signal_id: string | null
  created_at: string
}

/* English labels; translated at render with tr(). */
const STATUS_LABEL: Record<string, string> = {
  open: 'Open|status',
  in_progress: 'In progress',
  pending_review: 'Pending review',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function InvestigationsWorkspace() {
  const showToast = useToast()
  const { tr } = useI18n()
  const searchParams = useSearchParams()
  const signalId = searchParams.get('signalId')
  const [items, setItems] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [sourceSignalId, setSourceSignalId] = useState<string | null>(signalId)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/investigations', { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error)
      setUnavailable(Boolean(payload.unavailable))
      setItems(Array.isArray(payload.investigations) ? payload.investigations : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!signalId) return
    let cancelled = false

    const prefillFromSignal = async () => {
      try {
        const res = await sharedFetch('/api/watchtower/summary?timeframe=7d')
        const payload = (await res.json()) as WatchtowerSummary
        if (!res.ok || cancelled) return
        const signal = payload.signals.find((entry) => entry.id === signalId)
        if (!signal) return
        setSourceSignalId(signal.id)
        setTitle(`Investigate: ${signal.title}`)
        setSummary(signal.summary)
        setShowForm(true)
      } catch {
        // Keep manual form usable if signal lookup fails.
      }
    }

    prefillFromSignal()
    return () => {
      cancelled = true
    }
  }, [signalId])

  const create = async () => {
    if (!title.trim()) return
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, sourceSignalId }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || tr('Failed to create'))
      setShowForm(false)
      setTitle('')
      setSummary('')
      setSourceSignalId(null)
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed'), 'error')
    }
  }

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <PageHeader
          eyebrow={tr('Operations')}
          title={tr('Investigations')}
          subtitle={tr('Signal → alert → investigation → action.')}
          actions={
            <>
              <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
                <Plus strokeWidth={1.5} className="h-4 w-4" /> {tr('New investigation')}
              </Button>
              <CardAction icon={RefreshCw} label={tr('Refresh')} onClick={load} spinning={loading} />
            </>
          }
          className="!mb-2"
        />
        <OperationalContextBanner />
        {unavailable && <Notice tone="warning">{tr('Apply migration {migration} for investigations persistence.', { migration: '00029' })}</Notice>}

        {showForm && (
          <Card family="comando" icon={FilePlus2} title={tr('New investigation')} subtitle={sourceSignalId ? tr('Linked signal: {id}', { id: sourceSignalId }) : undefined}>
            <div className="space-y-4">
              <Field id="inv-title" label={tr('Title')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Investigation title')} />
              <Textarea id="inv-summary" label={tr('Summary')} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={tr('What is being investigated, and why')} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{tr('Cancel')}</Button>
                <Button size="sm" onClick={create} disabled={!title.trim()}>{tr('Create investigation')}</Button>
              </div>
            </div>
          </Card>
        )}

        {items.length === 0 ? (
          <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
            <EmptyState
              title={tr('No investigations')}
              description={tr('Create one from a Watchtower signal, or start a new investigation.')}
              action={
                <DashboardQueryLink href="/dashboard?module=watchtower" className="g-btn g-btn--outline">
                  <span className="inline-flex items-center px-4 h-9 text-[14px]">{tr('Open Watchtower')}</span>
                </DashboardQueryLink>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="bg-card border border-line p-5" style={{ borderRadius: 'var(--radius-xl)' }}>
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="text-[16px] text-content" style={{ fontWeight: 500 }}>{item.title}</h3>
                  <StatusTag level={item.status === 'closed' || item.status === 'resolved' ? 'good' : 'progress'} label={tr(STATUS_LABEL[item.status] ?? humanize(item.status))} />
                </div>
                {item.summary && <p className="mt-1 text-[14px] text-content-soft leading-[1.45]">{item.summary}</p>}
                {item.source_signal_id && (
                  <DashboardQueryLink href={`/dashboard?module=watchtower&signalId=${item.source_signal_id}`} className="mt-3 inline-block text-[12px] text-sage-700 hover:text-ink transition-colors">
                    {tr('Source signal')} <span className="inline-block rtl:-scale-x-100">→</span>
                  </DashboardQueryLink>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
