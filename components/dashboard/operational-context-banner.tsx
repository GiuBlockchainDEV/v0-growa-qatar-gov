'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MapPin, Radio, X } from 'lucide-react'
import { hasOperationalOverlayContext, isHarvestDashboardModule } from '@/lib/dashboard/context-navigation'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { useI18n } from '@/lib/i18n'
import { timeframeLabel } from '@/lib/domain/timeframes'
import { cn } from '@/lib/utils'

interface OperationalContextBannerProps {
  className?: string
}

export function OperationalContextBanner({ className }: OperationalContextBannerProps) {
  const { t } = useI18n()
  const opCtx = useOperationalContextOptional()
  if (!opCtx) return null

  const searchParams = useSearchParams()
  const { context, timeframe, selectedSignalId, clearContext } = opCtx
  const activeModule = searchParams.get('module')
  const hasContext = hasOperationalOverlayContext(searchParams, {
    ignoreParcelId: isHarvestDashboardModule(activeModule),
  })

  if (!hasContext) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#07f880]/20 bg-[#07f880]/5 px-3 py-2',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70">
        <span className="font-medium text-[#07f880]">{t('context.active')}</span>
        {context.farmId && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Farm: {context.farmId.slice(0, 8)}…
          </span>
        )}
        {context.parcelId && !isHarvestDashboardModule(activeModule) ? (
          <span>Parcel: {context.parcelId.slice(0, 8)}…</span>
        ) : null}
        {context.cropId && <span>Crop: {context.cropId}</span>}
        {(context.signalId || selectedSignalId) && (
          <span className="inline-flex items-center gap-1">
            <Radio className="h-3 w-3" />
            Signal active
          </span>
        )}
        <span className="text-white/40">· {timeframeLabel(timeframe)}</span>
      </div>

      <div className="flex items-center gap-2">
        {context.farmId ? (
          <Link
            href={`/dashboard?module=watchtower&farmId=${context.farmId}`}
            scroll={false}
            className="text-[10px] text-[#07f880] hover:underline"
          >
            View in Watchtower
          </Link>
        ) : null}
        <button
          type="button"
          onClick={clearContext}
          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/50 hover:text-white"
        >
          <X className="h-3 w-3" />
          {t('context.clear')}
        </button>
      </div>
    </div>
  )
}
