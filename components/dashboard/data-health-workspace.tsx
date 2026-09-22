'use client'

import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { WatchtowerDataHealth } from '@/components/dashboard/watchtower/data-health'
import { useI18n } from '@/lib/i18n'

export function DataHealthWorkspace() {
  const { locale } = useI18n()
  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/watchtower/summary?timeframe=7d', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setSummary(data as WatchtowerSummary))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="h-full overflow-y-auto bg-[#050608] text-white p-6 pt-20">
      <header className="mb-6">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#07f880]" />
          {locale === 'ar' ? 'صحة البيانات' : 'Data Health & Source Coverage'}
        </h1>
        <p className="text-xs text-white/45 mt-1">
          Platform-wide data confidence, freshness and source availability
        </p>
      </header>

      {loading ? (
        <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
      ) : summary ? (
        <WatchtowerDataHealth dataQuality={summary.dataQuality} sourceStatus={summary.sourceStatus} />
      ) : (
        <p className="text-sm text-white/50">Unable to load data health from Watchtower aggregation.</p>
      )}
    </div>
  )
}
