'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IntelligenceSignal, SignalType, SituationChange, WatchtowerSummary } from '@/lib/domain/types'

export function useModuleWatchtowerContext(signalTypes: SignalType[]) {
  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/watchtower/summary?timeframe=7d', { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to load watchtower context')
      setSummary(payload as WatchtowerSummary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load watchtower context')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const signals = useMemo(() => {
    if (!summary) return [] as IntelligenceSignal[]
    if (signalTypes.length === 0) return summary.signals.slice(0, 6)
    return summary.signals.filter((signal) => signalTypes.includes(signal.type)).slice(0, 6)
  }, [signalTypes, summary])

  const changes = useMemo(() => {
    if (!summary) return [] as SituationChange[]
    return summary.changes.slice(0, 5)
  }, [summary])

  return {
    summary,
    signals,
    changes,
    outlook: summary?.outlook,
    loading,
    error,
    refresh: load,
  }
}
