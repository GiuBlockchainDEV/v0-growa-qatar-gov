'use client'

import { useI18n } from '@/lib/i18n'
import { EmptyState, PageBody, PageHeader } from '@/components/brand/layout'

export default function CyclesPage() {
  const { tr } = useI18n()
  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader eyebrow={tr('Operations')} title={tr('Production cycles')} subtitle={tr('Track and manage your crop, livestock and aquaculture production cycles.')} />
        <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
          <EmptyState title={tr('Coming soon')} description={tr('Production cycle management is coming soon.')} />
        </div>
      </PageBody>
    </div>
  )
}
