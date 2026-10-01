'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { useDataSharing } from '@/hooks/use-data-sharing'
import { useDataAccess } from '@/hooks/use-data-access'
import { Share2, Unlock, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/brand/feedback'
import { Card, EmptyState, LoadingState, Notice, PageBody, PageHeader } from '@/components/brand/layout'
import { Tag } from '@/components/brand/ui'
import { humanize } from '@/components/brand/status'

export default function DataSharingPage() {
  const { tr } = useI18n()
  const confirmDialog = useConfirm()
  const { organization } = useOrganization()
  const { getDataSharing, createSharing, removeSharing, getShareableOrganizations } = useDataSharing()
  const { canManageSharing } = useDataAccess()
  const organizationId = organization?.id || ''
  const organizationType = organization?.type || organization?.organization_type || ''

  const [sharings, setSharings] = useState<any[]>([])
  const [shareableOrgs, setShareableOrgs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!organizationId) {
        setIsLoading(false)
        return
      }

      const [data, orgs] = await Promise.all([
        getDataSharing(organizationId),
        getShareableOrganizations(organizationType),
      ])

      setSharings(data)
      setShareableOrgs(orgs?.data || [])
      setIsLoading(false)
    }

    loadData()
  }, [organizationId, organizationType, getDataSharing, getShareableOrganizations])

  /* Copy was Italian in an English / Arabic interface: brought to English
     like the rest of the app. */
  if (!canManageSharing()) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <PageBody>
          <PageHeader eyebrow={tr('Settings')} title={tr('Data sharing')} />
          <Notice tone="critical">{tr('Only government organisations can manage data sharing.')}</Notice>
        </PageBody>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={tr('Loading…')} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader eyebrow={tr('Settings')} title={tr('Data sharing')} subtitle={tr('Organisations that can read your data, and those you can share with.')} />

        <div className="space-y-4">
          <Card icon={Share2} title={tr('Active sharing')} actions={<Tag size="sm" variant="outline-ink">{sharings.length}</Tag>} flush>
            {sharings.length === 0 ? (
              <EmptyState compact title={tr('No active data sharing')} />
            ) : (
              <ul className="divide-y divide-line">
                {sharings.map((sharing) => (
                  <li key={sharing.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>{humanize(sharing.resource_type)}</p>
                      <p className="text-[13px] text-content-soft truncate">
                        {tr('Shared with:')} <span className="font-mono">{sharing.shared_with_organization_id}</span>
                      </p>
                    </div>
                    <button
                      aria-label={tr('Remove sharing')}
                      onClick={async () => {
                        if (await confirmDialog(tr('Remove this data sharing?'))) {
                          removeSharing(sharing.id).then(() => {
                            setSharings(sharings.filter((s) => s.id !== sharing.id))
                          })
                        }
                      }}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-pill text-stone-500 hover:text-critical hover:bg-muted transition-colors"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {shareableOrgs.length > 0 && (
            <Card family="comando" icon={Unlock} title={tr('Add sharing')} subtitle={tr('You can share your data with these organisations.')}>
              <div className="space-y-2">
                {shareableOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() =>
                      createSharing(organizationId, org.id, 'all').then(() => {
                        getDataSharing(organizationId).then(setSharings)
                      })
                    }
                    disabled={!organizationId}
                    className="w-full flex items-center justify-between gap-3 bg-card border border-line px-4 py-3 hover:border-line-strong transition-colors text-start disabled:opacity-40"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    <div>
                      <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>{org.name}</p>
                      <p className="text-[12px] text-content-soft">{humanize(org.type)}</p>
                    </div>
                    <span className="g-btn g-btn--outline" style={{ height: 30, padding: '0 12px', fontSize: 12 }}>{tr('Share')}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </PageBody>
    </div>
  )
}
