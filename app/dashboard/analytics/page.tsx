'use client'

import { useI18n } from '@/lib/i18n'
import { EmptyState, PageBody, PageHeader } from '@/components/brand/layout'

export default function AnalyticsPage() {
  const { tr } = useI18n()
  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader eyebrow={tr('Intelligence')} title={tr('Analytics')} subtitle={tr('View insights and analytics on your agricultural operations.')} />
        <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
          <EmptyState title={tr('Coming soon')} description={tr('Analytics dashboard features coming soon.')} />
        </div>
      </PageBody>
    </div>
  )
}
