'use client'

import { ArrowRight, MapPin, Bell, AlertCircle } from 'lucide-react'
import type { IntelligenceSignal } from '@/lib/domain/types'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES: Record<IntelligenceSignal['severity'], { border: string; badge: string; label: string }> = {
  info: { border: 'border-sky-500/20', badge: 'bg-sky-500/15 text-sky-300', label: 'INFO' },
  attention: { border: 'border-amber-500/25', badge: 'bg-amber-500/15 text-amber-300', label: 'ATTENTION' },
  high: { border: 'border-orange-500/30', badge: 'bg-orange-500/15 text-orange-300', label: 'HIGH' },
  critical: { border: 'border-red-500/35', badge: 'bg-red-500/15 text-red-300', label: 'CRITICAL' },
}

interface SignalCardProps {
  signal: IntelligenceSignal
  selected?: boolean
  onCreateAlert?: (signal: IntelligenceSignal) => void
}

export function SignalCard({ signal, selected, onCreateAlert }: SignalCardProps) {
  const opCtx = useOperationalContextOptional()
  const styles = SEVERITY_STYLES[signal.severity]
  const entityCount =
    signal.farmIds?.length || signal.pointIds?.length || signal.parcelIds?.length || 0

  return (
    <div
      className={cn(
        'rounded-lg border bg-[#0a0d12] p-3 transition-all',
        styles.border,
        selected && 'ring-1 ring-[#07f880]/40 border-[#07f880]/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider', styles.badge)}>
          {styles.label}
        </span>
        {signal.sourceMode === 'demo' && (
          <span className="text-[9px] uppercase text-amber-400/80">Demo</span>
        )}
      </div>

      <h4 className="mt-2 text-sm font-medium text-white leading-snug">{signal.title}</h4>

      <div className="mt-2 space-y-1 text-[11px] text-white/55">
        <p>{signal.summary}</p>
        {signal.deviationPercent !== undefined && (
          <p className="text-white/70">
            <span className="text-white/40">Deviation:</span>{' '}
            {signal.deviationPercent > 0 ? '+' : ''}{signal.deviationPercent.toFixed(0)}% vs baseline
          </p>
        )}
        {entityCount > 0 && (
          <p className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-white/40" />
            {entityCount} affected
          </p>
        )}
        {signal.confidence !== undefined && (
          <p>
            <span className="text-white/40">Confidence:</span> {Math.round(signal.confidence * 100)}%
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => opCtx?.goToSignal(signal, { onMap: true })}
          className="inline-flex items-center gap-1 rounded bg-[#07f880]/12 px-2 py-1 text-[10px] font-medium text-[#07f880] hover:bg-[#07f880]/20"
        >
          <MapPin className="h-3 w-3" />
          Map
        </button>
        <button
          type="button"
          onClick={() => opCtx?.goToSignal(signal)}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:text-white"
        >
          Investigate
          <ArrowRight className="h-3 w-3" />
        </button>
        {onCreateAlert && (
          <button
            type="button"
            onClick={() => onCreateAlert(signal)}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:text-amber-300"
          >
            <Bell className="h-3 w-3" />
            Alert
          </button>
        )}
      </div>
    </div>
  )
}

export function SignalCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-3 animate-pulse">
      <div className="h-3 w-16 bg-white/10 rounded" />
      <div className="mt-2 h-4 w-3/4 bg-white/10 rounded" />
      <div className="mt-2 h-3 w-full bg-white/5 rounded" />
    </div>
  )
}
