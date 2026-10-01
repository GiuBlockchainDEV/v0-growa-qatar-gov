'use client'

import { useEffect, useState } from 'react'
import type { WatchtowerSummary } from '@/lib/domain/types'
import { WatchtowerDataHealth } from '@/components/dashboard/watchtower/data-health'
import { useI18n } from '@/lib/i18n'
import { ErrorState, LoadingState, PageHeader } from '@/components/brand/layout'
import { sharedFetch } from '@/lib/client/shared-fetch'

export function DataHealthWorkspace() {
  const { tr } = useI18n()
  const [summary, setSummary] = useState<WatchtowerSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sharedFetch('/api/watchtower/summary?timeframe=7d')
      .then((r) => r.json())
      .then((data) => setSummary(data as WatchtowerSummary))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6">
        <PageHeader
          eyebrow={tr('Platform')}
          title={tr('Data health and source coverage')}
          subtitle={tr('Platform-wide data confidence, freshness and source availability.')}
        />

        {loading ? (
          <LoadingState label={tr('Loading data health…')} />
        ) : summary?.dataQuality && summary?.sourceStatus ? (
          <WatchtowerDataHealth dataQuality={summary.dataQuality} sourceStatus={summary.sourceStatus} />
        ) : (
          <ErrorState message={tr('Unable to load data health from Watchtower aggregation.')} retryLabel={tr('Retry')} />
        )}
      </div>
    </div>
  )
}
