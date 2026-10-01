'use client'

import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { useSearchParams } from 'next/navigation'
import { MapPin, Radio, X } from 'lucide-react'
import { hasOperationalOverlayContext, isHarvestDashboardModule } from '@/lib/dashboard/context-navigation'
import { navigateToFarm } from '@/lib/dashboard/operational-navigation'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { timeframeLabel } from '@/lib/domain/timeframes'
import { cn } from '@/lib/utils'

interface OperationalContextBannerProps {
  className?: string
}

export function OperationalContextBanner({ className }: OperationalContextBannerProps) {
  const { t, tr } = useI18n()
  const opCtx = useOperationalContextOptional()
  // Hooks before any early return (it was called after one: rules-of-hooks).
  const searchParams = useSearchParams()
  if (!opCtx) return null

  const { context, timeframe, selectedSignalId, clearContext } = opCtx
  const activeModule = searchParams.get('module')
  const hasContext = hasOperationalOverlayContext(searchParams, {
    ignoreParcelId: isHarvestDashboardModule(activeModule),
  })

  if (!hasContext) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sage-300 bg-cream-50 px-4 py-2.5',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-content">
        <span className="inline-flex items-center gap-2 font-medium text-content"><span aria-hidden="true" className="w-1.5 h-1.5 bg-sage" style={{ borderRadius: 1 }} />{t('context.active')}</span>
        {context.farmId && (
          <span className="inline-flex items-center gap-1">
            <MapPin strokeWidth={1.5} className="h-3 w-3" />
            {tr('Farm: {id}…', { id: context.farmId.slice(0, 8) })}
          </span>
        )}
        {context.parcelId && !isHarvestDashboardModule(activeModule) ? (
          <span>{tr('Parcel: {id}…', { id: context.parcelId.slice(0, 8) })}</span>
        ) : null}
        {context.cropId && <span>{tr('Crop: {id}', { id: context.cropId })}</span>}
        {(context.signalId || selectedSignalId) && (
          <span className="inline-flex items-center gap-1">
            <Radio strokeWidth={1.5} className="h-3 w-3" />
            {tr('Signal active')}
          </span>
        )}
        <span className="text-content-soft">· {tr(timeframeLabel(timeframe))}</span>
      </div>

      <div className="flex items-center gap-2">
        {context.farmId ? (
          <DashboardQueryLink
            href={navigateToFarm(searchParams, context.farmId, 'watchtower', 14)}
            className="text-[12px] text-sage-700 hover:text-ink transition-colors"
          >
            {tr('View in Watchtower')}
          </DashboardQueryLink>
        ) : null}
        <button
          type="button"
          onClick={clearContext}
          className="g-tag g-tag--outline-ink hover:bg-card transition-colors"
          style={{ height: 24, padding: '0 10px', fontSize: 11 }}
        >
          <X strokeWidth={1.5} className="h-3 w-3" />
          {t('context.clear')}
        </button>
      </div>
    </div>
  )
}
