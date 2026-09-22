'use client'

import type { DataQualityStatus, SourceStatus } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const HEALTH_STYLES: Record<string, string> = {
  healthy: 'text-[#07f880]',
  fresh: 'text-[#07f880]',
  degraded: 'text-amber-300',
  partial: 'text-amber-300',
  stale: 'text-amber-300',
  offline: 'text-red-300',
  missing: 'text-red-300',
  unavailable: 'text-red-300',
  unknown: 'text-white/40',
}

interface DataHealthProps {
  dataQuality: DataQualityStatus[]
  sourceStatus: SourceStatus[]
}

export function WatchtowerDataHealth({ dataQuality, sourceStatus }: DataHealthProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">Source health</h4>
        <div className="space-y-1.5">
          {sourceStatus.map((source) => (
            <div
              key={source.source}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div>
                <p className="text-xs text-white/80">{source.source}</p>
                {source.message && (
                  <p className="text-[10px] text-white/40">{source.message}</p>
                )}
              </div>
              <span className={cn('text-[10px] font-semibold uppercase', HEALTH_STYLES[source.health])}>
                {source.health}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">Data coverage</h4>
        <div className="space-y-1.5">
          {dataQuality.map((item) => (
            <div
              key={item.source}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div>
                <p className="text-xs text-white/80">{item.source}</p>
                {item.entityCount !== undefined && (
                  <p className="text-[10px] text-white/40">
                    {item.entityCount} records
                    {item.missingEntityCount ? ` · ${item.missingEntityCount} gaps` : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={cn('text-[10px] font-semibold uppercase', HEALTH_STYLES[item.status])}>
                  {item.status}
                </span>
                {item.coveragePercent !== undefined && (
                  <p className="text-[10px] text-white/40">{item.coveragePercent}% coverage</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
