'use client'

import { TrendingDown, TrendingUp, Plus, CheckCircle, Minus } from 'lucide-react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import type { SituationChange } from '@/lib/domain/types'
import { useI18n } from '@/lib/i18n'

const DIRECTION_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  new: Plus,
  resolved: CheckCircle,
  stable: Minus,
}

const SIGNIFICANCE_TONE = {
  low: 'var(--status-progress)',
  medium: 'var(--warning)',
  high: 'var(--high)',
}

interface ChangesPanelProps {
  changes: SituationChange[]
}

export function WatchtowerChangesPanel({ changes }: ChangesPanelProps) {
  const { tr } = useI18n()
  if (changes.length === 0) {
    return (
      <p className="text-[13px] text-content-soft">{tr('No significant changes in the comparison window.')}</p>
    )
  }

  return (
    <div className="divide-y divide-dotted divide-line-strong -my-1">
      {changes.map((change) => {
        const Icon = DIRECTION_ICON[change.direction]
        return (
          <div key={change.id} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 inline-flex items-center gap-1.5 shrink-0">
              <span aria-hidden="true" className="w-1.5 h-1.5" style={{ background: SIGNIFICANCE_TONE[change.significance], borderRadius: 1 }} />
              <Icon strokeWidth={1.5} className="h-4 w-4 text-content-soft rtl:-scale-x-100" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-content leading-[1.45]">{change.description}</p>
              {change.entityCount !== undefined && (
                <p className="mt-0.5 text-[12px] text-content-soft">{tr('{count} entities', { count: change.entityCount })}</p>
              )}
            </div>
            {change.deepLink && (
              <DashboardQueryLink
                href={change.deepLink}
                className="shrink-0 text-[12px] text-sage-700 hover:text-ink transition-colors"
              >
                {tr('View')}
              </DashboardQueryLink>
            )}
          </div>
        )
      })}
    </div>
  )
}
