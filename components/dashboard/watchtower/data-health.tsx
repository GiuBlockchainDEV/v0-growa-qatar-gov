'use client'

import { Database, Gauge } from 'lucide-react'
import type { DataQualityStatus, SourceStatus } from '@/lib/domain/types'
import { Card } from '@/components/brand/layout'
import { StatusTag, humanize } from '@/components/brand/status'
import { useI18n } from '@/lib/i18n'

/* Source health words → the system's status squares. */
const HEALTH_LEVEL: Record<string, string> = {
  healthy: 'good',
  fresh: 'good',
  degraded: 'attention',
  partial: 'attention',
  stale: 'attention',
  offline: 'critical',
  missing: 'critical',
  unavailable: 'critical',
  unknown: 'unknown',
}

interface DataHealthProps {
  dataQuality: DataQualityStatus[]
  sourceStatus: SourceStatus[]
}

export function WatchtowerDataHealth({ dataQuality, sourceStatus }: DataHealthProps) {
  const { tr } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card icon={Gauge} title={tr('Source health')}>
        <ul className="divide-y divide-dotted divide-line-strong -my-1">
          {sourceStatus.map((source) => (
            <li key={source.source} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[14px] text-content font-mono">{source.source}</p>
                {source.message && <p className="text-[12px] text-content-soft">{source.message}</p>}
              </div>
              <StatusTag level={HEALTH_LEVEL[source.health] || 'unknown'} label={tr(humanize(source.health))} />
            </li>
          ))}
        </ul>
      </Card>
      <Card icon={Database} title={tr('Data coverage')}>
        <ul className="divide-y divide-dotted divide-line-strong -my-1">
          {dataQuality.map((item) => (
            <li key={item.source} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[14px] text-content font-mono">{item.source}</p>
                {item.entityCount !== undefined && (
                  <p className="text-[12px] text-content-soft">
                    {tr('{count} records', { count: item.entityCount })}
                    {item.missingEntityCount ? ` · ${tr('{count} gaps', { count: item.missingEntityCount })}` : ''}
                  </p>
                )}
              </div>
              <div className="text-end shrink-0">
                <StatusTag level={HEALTH_LEVEL[item.status] || 'unknown'} label={tr(humanize(item.status))} />
                {item.coveragePercent !== undefined && (
                  <p className="mt-1 text-[11px] text-content-soft tabular-nums">{tr('{percent}% coverage', { percent: item.coveragePercent })}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
