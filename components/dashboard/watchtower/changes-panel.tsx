'use client'

import { TrendingDown, TrendingUp, Plus, CheckCircle, Minus } from 'lucide-react'
import Link from 'next/link'
import type { SituationChange } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const DIRECTION_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  new: Plus,
  resolved: CheckCircle,
  stable: Minus,
}

const SIGNIFICANCE_STYLES = {
  low: 'text-white/50',
  medium: 'text-amber-300',
  high: 'text-orange-300',
}

interface ChangesPanelProps {
  changes: SituationChange[]
}

export function WatchtowerChangesPanel({ changes }: ChangesPanelProps) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-white/50">No significant changes in the comparison window.</p>
    )
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => {
        const Icon = DIRECTION_ICON[change.direction]
        return (
          <div
            key={change.id}
            className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5"
          >
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', SIGNIFICANCE_STYLES[change.significance])} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/80 leading-relaxed">{change.description}</p>
              {change.entityCount !== undefined && (
                <p className="mt-1 text-[10px] text-white/40 uppercase tracking-wide">
                  {change.entityCount} entities
                </p>
              )}
            </div>
            {change.deepLink && (
              <Link
                href={change.deepLink}
                className="shrink-0 text-[10px] text-[#07f880] hover:underline"
              >
                View
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
