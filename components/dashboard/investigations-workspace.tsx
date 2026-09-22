'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useI18n } from '@/lib/i18n'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

interface Investigation {
  id: string
  title: string
  summary: string | null
  status: string
  priority: string
  source_signal_id: string | null
  created_at: string
}

export function InvestigationsWorkspace() {
  const { locale } = useI18n()
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
        const res = await fetch('/api/watchtower/summary?timeframe=7d', { cache: 'no-store' })
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
      if (!res.ok) throw new Error(payload.error || 'Failed to create')
      setShowForm(false)
      setTitle('')
      setSummary('')
      setSourceSignalId(null)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#050608] text-white overflow-hidden">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Search className="h-5 w-5 text-[#07f880]" />
              {locale === 'ar' ? 'التحقيقات' : 'Investigations'}
            </h1>
            <p className="text-xs text-white/45 mt-1">
              Signal → Alert → Investigation → Action workflow
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1 rounded bg-[#07f880]/15 px-3 py-1.5 text-xs text-[#07f880]">
              <Plus className="h-3.5 w-3.5" /> New
            </button>
            <button onClick={load} className="rounded border border-white/10 px-2 py-1.5 text-white/50">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div className="mt-3"><OperationalContextBanner /></div>
        {unavailable && (
          <p className="mt-2 text-xs text-amber-300">Apply migration 00029 for investigations persistence.</p>
        )}
      </header>

      {showForm && (
        <div className="shrink-0 border-b border-white/10 px-5 py-3 space-y-2">
          {sourceSignalId && (
            <p className="text-xs text-[#07f880]/80">
              Linked signal: {sourceSignalId}
            </p>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Investigation title"
            className="w-full rounded border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm"
          />
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary"
            className="w-full rounded border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm min-h-[60px]"
          />
          <button onClick={create} className="rounded bg-[#07f880] px-4 py-1.5 text-sm font-medium text-black">Create investigation</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {items.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-12">
            No investigations. Create from Watchtower signals or start a new investigation.
            <Link href="/dashboard?module=watchtower" className="block mt-2 text-[#07f880] hover:underline">Open Watchtower</Link>
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-[#0a0d12] p-4">
              <div className="flex justify-between gap-2">
                <h3 className="text-sm font-medium">{item.title}</h3>
                <span className="text-[10px] uppercase text-white/40">{item.status}</span>
              </div>
              {item.summary && <p className="mt-1 text-xs text-white/55">{item.summary}</p>}
              {item.source_signal_id && (
                <Link href={`/dashboard?module=watchtower&signalId=${item.source_signal_id}`} className="mt-2 inline-block text-[10px] text-[#07f880]">
                  Source signal →
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
