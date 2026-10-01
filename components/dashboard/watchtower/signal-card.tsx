'use client'

import { ArrowRight, MapPin, Bell } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { IntelligenceSignal } from '@/lib/domain/types'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { resolveDashboardHref } from '@/lib/dashboard/dashboard-navigation'
import {
  navigateToModuleWithContext,
  navigateToSignalEstimation,
} from '@/lib/dashboard/operational-navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/brand/ui'
import { StatusTag } from '@/components/brand/status'
import { useI18n } from '@/lib/i18n'

interface SignalCardProps {
  signal: IntelligenceSignal
  selected?: boolean
  onCreateAlert?: (signal: IntelligenceSignal) => void
  emphasized?: boolean
  compact?: boolean
}

export function SignalCard({ signal, selected, onCreateAlert, compact }: SignalCardProps) {
  const { tr } = useI18n()
  const opCtx = useOperationalContextOptional()
  const router = useRouter()
  const searchParams = useSearchParams()
  const entityCount =
    signal.farmIds?.length || signal.pointIds?.length || signal.parcelIds?.length || 0

  const navigate = (target: string) => {
    if (opCtx) {
      return
    }
    router.push(resolveDashboardHref(searchParams, target), { scroll: false })
  }

  const openEstimation = () => {
    const target = navigateToSignalEstimation(searchParams, signal)
    if (opCtx) {
      opCtx.goToSignal(signal, { onMap: true })
      return
    }
    navigate(target)
  }

  const openInvestigation = () => {
    const target = navigateToModuleWithContext(searchParams, 'investigations', {
      signalId: signal.id,
      farmId: signal.farmIds?.[0],
      parcelId: signal.parcelIds?.[0],
      pointId: signal.pointIds?.[0],
      timeframe: opCtx?.timeframe,
    })
    if (opCtx) {
      opCtx.goToModule('investigations', {
        signalId: signal.id,
        farmId: signal.farmIds?.[0],
        parcelId: signal.parcelIds?.[0],
        pointId: signal.pointIds?.[0],
      })
      return
    }
    navigate(target)
  }

  /* A signal is a tile inside the signals card: white, one-pixel line,
     severity as a status tag (square + sentence case), the facts on
     dotted rows, commands as pills. Selection is the sage ring, the one way
     the app says "look here". */
  return (
    <article
      className={cn(
        'relative z-10 bg-card border border-line transition-colors hover:border-line-strong',
        compact ? 'p-3' : 'p-4',
        selected && 'border-sage ring-2 ring-sage/30'
      )}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusTag level={signal.severity} />
        {signal.sourceMode === 'demo' && <span className="g-tag g-tag--muted" style={{ height: 22, padding: '0 9px', fontSize: 11 }}>{tr('Demo')}</span>}
      </div>

      <h4 className={cn('mt-3 text-content leading-snug', compact ? 'text-[13px]' : 'text-[14px]')} style={{ fontWeight: 500 }}>
        {signal.title}
      </h4>

      <p className={cn('mt-1.5 text-content-soft leading-[1.45]', compact ? 'text-[12px] line-clamp-2' : 'text-[13px]')}>
        {signal.summary}
      </p>

      {(signal.deviationPercent !== undefined || entityCount > 0 || signal.confidence !== undefined) && (
        <dl className="mt-3 border-t border-dotted border-line-strong pt-2 text-[12px] space-y-1">
          {signal.deviationPercent !== undefined && (
            <div className="flex justify-between gap-3">
              <dt className="text-content-soft">{tr('Deviation')}</dt>
              <dd className="text-content tabular-nums" style={{ fontWeight: 500 }}>
                {tr('{value}% vs baseline', { value: `${signal.deviationPercent > 0 ? '+' : ''}${signal.deviationPercent.toFixed(0)}` })}
              </dd>
            </div>
          )}
          {entityCount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-content-soft">{tr('Affected')}</dt>
              <dd className="text-content tabular-nums">{entityCount}</dd>
            </div>
          )}
          {signal.confidence !== undefined && (
            <div className="flex justify-between gap-3">
              <dt className="text-content-soft">{tr('Confidence')}</dt>
              <dd className="text-content tabular-nums">{Math.round(signal.confidence * 100)}%</dd>
            </div>
          )}
        </dl>
      )}

      <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation()
            openEstimation()
          }}
          style={{ height: 28, padding: '0 12px', fontSize: 12 }}
        >
          <MapPin strokeWidth={1.5} className="h-3.5 w-3.5" />
          {tr('Estimation')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation()
            openInvestigation()
          }}
          style={{ height: 28, padding: '0 12px', fontSize: 12 }}
        >
          {tr('Investigate')}
          <ArrowRight strokeWidth={1.5} className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </Button>
        {onCreateAlert && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation()
              onCreateAlert(signal)
            }}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            <Bell strokeWidth={1.5} className="h-3.5 w-3.5" />
            {tr('Alert')}
          </Button>
        )}
      </div>
    </article>
  )
}

export function SignalCardSkeleton() {
  return (
    <div className="border border-line bg-card p-4 animate-pulse" style={{ borderRadius: 'var(--radius-lg)' }}>
      <div className="h-[22px] w-20 bg-stone-100 rounded-pill" />
      <div className="mt-3 h-4 w-3/4 bg-stone-100 rounded-xs" />
      <div className="mt-2 h-3 w-full bg-muted rounded-xs" />
    </div>
  )
}
