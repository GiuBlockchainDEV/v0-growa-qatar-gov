'use client'

import { useSearchParams } from 'next/navigation'
import { Bot, MapPin, Radio } from 'lucide-react'
import type { IntelligenceSignal, OutlookSummary, SituationChange } from '@/lib/domain/types'
import {
  InvestigationActionBar,
  InvestigationActionButton,
} from '@/components/dashboard/intelligence-investigation-layout'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { Notice } from '@/components/brand/layout'
import { StatusDot } from '@/components/brand/ui'
import { severityTone } from '@/components/brand/status'
import { useI18n } from '@/lib/i18n'

export function IntelligenceMapHint({ moduleLabel }: { moduleLabel: string }) {
  const { tr } = useI18n()
  return (
    <Notice tone="good" title={tr('Map surface active')}>
      {tr('Use the national map panel to explore {module}. Click rows, producers or grid cells to focus the map without losing investigation context.', { module: moduleLabel })}
    </Notice>
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
  const { tr } = useI18n()
  const opCtx = useOperationalContextOptional()
  const searchParams = useSearchParams()
  const activeModule = searchParams.get('module') || module

  if (loading) {
    return <p className="text-[13px] text-content-soft">{tr('Loading platform signals…')}</p>
  }

  if (signals.length === 0) {
    return <p className="text-[13px] text-content-soft">{tr('No active signals linked to this domain in the current timeframe.')}</p>
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
          className="flex w-full items-start gap-3 bg-card border border-line px-3.5 py-3 text-start transition-colors hover:border-line-strong"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <StatusDot tone={severityTone(signal.severity)} size={7} className="mt-1.5 shrink-0" />
          <div>
            <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>{signal.title}</p>
            <p className="text-[12px] text-content-soft line-clamp-2 mt-0.5">{signal.summary}</p>
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
  const { tr } = useI18n()
  if (loading) {
    return <p className="text-[13px] text-content-soft">{tr('Loading recent changes…')}</p>
  }

  if (changes.length === 0) {
    return <p className="text-[13px] text-content-soft">{tr('No significant platform changes in the selected timeframe.')}</p>
  }

  return (
    <ul className="divide-y divide-dotted divide-line-strong text-[13px] text-content -my-1">
      {changes.map((change) => (
        <li key={change.id} className="flex gap-3 py-2">
          <span aria-hidden="true" className="mt-[7px] w-1.5 h-1.5 shrink-0 bg-content-soft" style={{ borderRadius: 1 }} />
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
  const { tr } = useI18n()
  if (loading) {
    return <p className="text-[13px] text-content-soft">{tr('Loading outlook…')}</p>
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
    <div className="grid gap-3 sm:grid-cols-2 text-[13px] text-content">
      <div>
        <p className="text-[12px] text-content-soft">{tr('7-day outlook')}</p>
        <p className="mt-1">{sevenDay || tr('Insufficient forecast linkage')}</p>
      </div>
      <div>
        <p className="text-[12px] text-content-soft">{tr('30-day outlook')}</p>
        <p className="mt-1">{thirtyDay || tr('Insufficient forecast linkage')}</p>
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
  const { tr } = useI18n()
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
            parcelId: onHarvestDetail ? parcelId || undefined : undefined,
          })
        }
      >
        <Bot strokeWidth={1.5} className="h-3.5 w-3.5" />
        {tr('Run AI investigation')}
      </InvestigationActionButton>
      {!onHarvestDetail ? (
        <InvestigationActionButton variant="ghost" onClick={() => opCtx?.goToModule('watchtower')}>
          <Radio strokeWidth={1.5} className="h-3.5 w-3.5" />
          {tr('National watchtower')}
        </InvestigationActionButton>
      ) : null}
      {estimationModule !== currentModule && !onHarvestDetail ? (
        <InvestigationActionButton
          variant="ghost"
          onClick={() => opCtx?.goToModule(estimationModule)}
        >
          <MapPin strokeWidth={1.5} className="h-3.5 w-3.5" />
          Open estimation view
        </InvestigationActionButton>
      ) : null}
    </InvestigationActionBar>
  )
}
