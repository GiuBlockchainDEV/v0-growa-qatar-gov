'use client'

import type { NationalStatusDomain, StatusLevel } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const DOMAIN_LABELS: Record<NationalStatusDomain['domain'], string> = {
  production: 'Production',
  water: 'Water',
  climate: 'Climate',
  crop_health: 'Crop Health',
  supply: 'Supply',
}

const LEVEL_STYLES: Record<StatusLevel, string> = {
  normal: 'border-[#07f880]/30 bg-[#07f880]/10 text-[#07f880]',
  attention: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  unknown: 'border-white/10 bg-white/5 text-white/50',
}

const LEVEL_DOT: Record<StatusLevel, string> = {
  normal: 'bg-[#07f880]',
  attention: 'bg-amber-400',
  high: 'bg-orange-400',
  critical: 'bg-red-400',
  unknown: 'bg-white/30',
}

interface StatusStripProps {
  statuses: NationalStatusDomain[]
}

export function WatchtowerStatusStrip({ statuses }: StatusStripProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {statuses.map((status) => (
        <div
          key={status.domain}
          className={cn(
            'rounded-lg border px-3 py-2.5 transition-colors',
            LEVEL_STYLES[status.level]
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', LEVEL_DOT[status.level])} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {DOMAIN_LABELS[status.domain]}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-snug opacity-90 line-clamp-2">{status.reason}</p>
          <div className="mt-2 flex flex-wrap gap-x-2 text-[10px] uppercase tracking-wide opacity-60">
            {status.affectedEntityCount !== undefined && (
              <span>{status.affectedEntityCount} affected</span>
            )}
            {status.level === 'unknown' && <span>Insufficient data</span>}
            {status.sourceMode === 'demo' && <span>Demo</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
