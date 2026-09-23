'use client'

import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Bot, MapPin, Radio } from 'lucide-react'
import type { IntelligenceSignal, OutlookSummary, SituationChange } from '@/lib/domain/types'
import {
  InvestigationActionBar,
  InvestigationActionButton,
} from '@/components/dashboard/intelligence-investigation-layout'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { cn } from '@/lib/utils'

export function IntelligenceMapHint({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="rounded-lg border border-[#07f880]/20 bg-[#07f880]/5 px-4 py-3 text-sm text-white/70">
      <p className="flex items-center gap-2 font-medium text-[#07f880]">
        <MapPin className="h-4 w-4" />
        Map surface active
      </p>
      <p className="mt-1 text-xs text-white/50">
        Use the national map panel to explore {moduleLabel}. Click rows, producers or grid cells to focus the map
        without losing investigation context.
      </p>
    </div>
  )
}

export function IntelligenceWatchtowerSignals({
  signals,
  loading,
  module = 'watchtower',
}: {
  signals: IntelligenceSignal[]
  loading?: boolean
  module?: string
}) {
  const opCtx = useOperationalContextOptional()
  const searchParams = useSearchParams()
  const activeModule = searchParams.get('module') || module

  if (loading) {
    return <p className="text-sm text-white/45">Loading platform signals…</p>
  }

  if (signals.length === 0) {
    return <p className="text-sm text-white/45">No active signals linked to this domain in the current timeframe.</p>
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => (
        <button
          key={signal.id}
          type="button"
          onClick={() =>
            opCtx?.goToModule(activeModule, {
              signalId: signal.id,
              parcelId:
                activeModule === 'harvest' || activeModule === 'production-harvest'
                  ? signal.parcelIds?.[0]
                  : undefined,
              pointId:
                activeModule === 'water-intelligence' || activeModule === 'energy-intelligence'
                  ? signal.pointIds?.[0]
                  : undefined,
              zoom:
                activeModule === 'water-intelligence' || activeModule === 'energy-intelligence'
                  ? 16
                  : undefined,
            })
          }
          className="flex w-full items-start gap-2 rounded-lg border border-white/10 px-3 py-2 text-left hover:border-white/20"
        >
          <AlertTriangle
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              signal.severity === 'critical' ? 'text-red-300' : signal.severity === 'high' ? 'text-orange-300' : 'text-amber-300'
            )}
          />
          <div>
            <p className="text-sm text-white">{signal.title}</p>
            <p className="text-xs text-white/45 line-clamp-2">{signal.summary}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

export function IntelligenceWatchtowerChanges({
  changes,
  loading,
}: {
  changes: SituationChange[]
  loading?: boolean
}) {
  if (loading) {
    return <p className="text-sm text-white/45">Loading recent changes…</p>
  }

  if (changes.length === 0) {
    return <p className="text-sm text-white/45">No significant platform changes in the selected timeframe.</p>
  }

  return (
    <ul className="space-y-2 text-sm text-white/70">
      {changes.map((change) => (
        <li key={change.id} className="flex gap-2">
          <span className="text-white/30">•</span>
          <span>{change.description}</span>
        </li>
      ))}
    </ul>
  )
}

export function IntelligenceWatchtowerForecast({
  outlook,
  loading,
  domain = 'operational',
}: {
  outlook?: OutlookSummary
  loading?: boolean
  domain?: 'climate' | 'production' | 'operational'
}) {
  if (loading) {
    return <p className="text-sm text-white/45">Loading outlook…</p>
  }

  const sevenDay =
    domain === 'climate'
      ? outlook?.sevenDay?.climate || outlook?.sevenDay?.cropStress
      : domain === 'production'
        ? outlook?.thirtyDay?.harvest || outlook?.thirtyDay?.production
        : outlook?.sevenDay?.operationalRisk || outlook?.sevenDay?.irrigationDemand

  const thirtyDay =
    domain === 'climate'
      ? outlook?.thirtyDay?.waterRequirement
      : domain === 'production'
        ? outlook?.thirtyDay?.harvest || outlook?.thirtyDay?.production
        : outlook?.thirtyDay?.supplyImplications

  return (
    <div className="grid gap-3 sm:grid-cols-2 text-sm text-white/70">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40">7-day outlook</p>
        <p className="mt-1">{sevenDay || 'Insufficient forecast linkage'}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40">30-day outlook</p>
        <p className="mt-1">{thirtyDay || 'Insufficient forecast linkage'}</p>
      </div>
    </div>
  )
}

function estimationModuleFor(module: string): string {
  if (module === 'harvest' || module === 'production-harvest') return 'harvest'
  if (module === 'weather') return 'weather'
  if (module === 'water-intelligence') return 'water-intelligence'
  if (module === 'energy-intelligence') return 'energy-intelligence'
  return 'data-analytics'
}

export function IntelligenceModuleActions({
  module,
}: {
  module: string
  mapLayers?: string[]
}) {
  const opCtx = useOperationalContextOptional()
  const searchParams = useSearchParams()
  const currentModule = searchParams.get('module')
  const parcelId = searchParams.get('parcelId')
  const estimationModule = estimationModuleFor(module)
  const onHarvestDetail = Boolean(parcelId && (module === 'harvest' || currentModule === 'harvest'))

  return (
    <InvestigationActionBar>
      <InvestigationActionButton
        variant="primary"
        onClick={() =>
          opCtx?.goToModule('ai-mission-control', {
            module,
            parcelId: onHarvestDetail ? parcelId || undefined : undefined,
          })
        }
      >
        <Bot className="h-3.5 w-3.5" />
        Run AI investigation
      </InvestigationActionButton>
      {!onHarvestDetail ? (
        <InvestigationActionButton variant="ghost" onClick={() => opCtx?.goToModule('watchtower')}>
          <Radio className="h-3.5 w-3.5" />
          National Watchtower
        </InvestigationActionButton>
      ) : null}
      {estimationModule !== currentModule && !onHarvestDetail ? (
        <InvestigationActionButton
          variant="ghost"
          onClick={() => opCtx?.goToModule(estimationModule)}
        >
          <MapPin className="h-3.5 w-3.5" />
          Open estimation view
        </InvestigationActionButton>
      ) : null}
    </InvestigationActionBar>
  )
}
