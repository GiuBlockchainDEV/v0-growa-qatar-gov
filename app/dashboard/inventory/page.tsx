'use client'

import { useI18n } from '@/lib/i18n'
import { EmptyState, PageBody, PageHeader } from '@/components/brand/layout'

export default function InventoryPage() {
  const { tr } = useI18n()
  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader eyebrow={tr('Resources')} title={tr('Inventory')} subtitle={tr('Track inputs, seeds, feed, fertilisers and other resources.')} />
        <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
          <EmptyState title={tr('Coming soon')} description={tr('Inventory management features coming soon.')} />
        </div>
      </PageBody>
    </div>
  )
}
