'use client'

import { ArrowRight, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { IntelligenceSignal } from '@/lib/domain/types'
import { navigateToSignal } from '@/lib/dashboard/operational-navigation'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES: Record<IntelligenceSignal['severity'], string> = {
  info: 'text-sky-300 border-sky-500/30',
  attention: 'text-amber-300 border-amber-500/30',
  high: 'text-orange-300 border-orange-500/30',
  critical: 'text-red-300 border-red-500/30',
}

interface SignalQueueProps {
  signals: IntelligenceSignal[]
}

export function WatchtowerSignalQueue({ signals }: SignalQueueProps) {
  const searchParams = useSearchParams()

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/50">
        No priority signals detected in the current window.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {signals.slice(0, 8).map((signal) => {
        const href = navigateToSignal(searchParams, signal)
        const entityCount =
          signal.farmIds?.length || signal.pointIds?.length || signal.parcelIds?.length || 0

        return (
          <div
            key={signal.id}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-3 hover:border-white/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      SEVERITY_STYLES[signal.severity]
                    )}
                  >
                    {signal.severity}
                  </span>
                  {signal.sourceMode === 'demo' && (
                    <span className="text-[10px] uppercase text-white/40">Demo</span>
                  )}
                </div>
                <h4 className="mt-1.5 text-sm font-medium text-white">{signal.title}</h4>
                <p className="mt-1 text-xs text-white/60 leading-relaxed">{signal.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                  {entityCount > 0 && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {entityCount} affected
                    </span>
                  )}
                  {signal.deviationPercent !== undefined && (
                    <span>
                      {signal.deviationPercent > 0 ? '+' : ''}
                      {signal.deviationPercent.toFixed(0)}% deviation
                    </span>
                  )}
                  {signal.confidence !== undefined && (
                    <span>{Math.round(signal.confidence * 100)}% confidence</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={href}
                className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/15 transition-colors"
              >
                Investigate
                <ArrowRight className="h-3 w-3" />
              </Link>
              {signal.recommendedModule && signal.recommendedModule !== 'live-map' && (
                <Link
                  href={`/dashboard?module=${signal.recommendedModule}&signalId=${signal.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:text-white hover:border-white/20 transition-colors"
                >
                  Open {signal.recommendedModule.replace(/-/g, ' ')}
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
