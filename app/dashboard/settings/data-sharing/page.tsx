'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/hooks/use-organization'
import { useDataSharing } from '@/hooks/use-data-sharing'
import { useDataAccess } from '@/hooks/use-data-access'
import { resolveOrganizationType } from '@/lib/supabase/schema-compat'
import { DashboardState } from '@/components/dashboard/dashboard-state'
import { Share2, Unlock, Trash2 } from 'lucide-react'

export default function DataSharingPage() {
  const { organization } = useOrganization()
  const { getDataSharing, createSharing, removeSharing, getShareableOrganizations } = useDataSharing()
  const { canManageSharing } = useDataAccess()

  const [sharings, setSharings] = useState<any[]>([])
  const [shareableOrgs, setShareableOrgs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentOrgType = resolveOrganizationType(organization)

  useEffect(() => {
    const loadData = async () => {
      if (!organization?.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [data, orgs] = await Promise.all([
          getDataSharing(organization.id),
          getShareableOrganizations(currentOrgType || 'private'),
        ])

        setSharings(data)
        setShareableOrgs(orgs?.data || [])
      } catch (loadError) {
        console.error('[data-sharing] load failed', loadError)
        setError('Unable to load data sharing settings.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [organization?.id, currentOrgType, getDataSharing, getShareableOrganizations])

  if (!canManageSharing()) {
    return (
      <DashboardState
        variant="notice"
        title="Access restricted"
        description="Only government organizations can manage data sharing."
      />
    )
  }

  if (isLoading) {
    return (
      <DashboardState
        variant="loading"
        title="Loading data sharing"
        description="Fetching current sharing policies and eligible organizations."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Share2 className="h-6 w-6 text-[#07f880]" />
        <h1 className="text-2xl font-bold text-foreground">Data Sharing</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Active sharing policies */}
      <div className="rounded-lg border border-white/5">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-semibold text-foreground">Active Shares</h2>
        </div>

        {sharings.length === 0 ? (
          <div className="px-5 py-6">
            <DashboardState
              variant="empty"
              title="No active shares"
              description="No active data sharing rules exist for this organization yet."
              className="py-8"
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sharings.map((sharing) => (
              <div key={sharing.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{sharing.resource_type}</p>
                  <p className="text-sm text-muted-foreground">
                    Shared with: {sharing.shared_with_organization_id}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Remove this sharing rule?')) {
                      removeSharing(sharing.id).then((ok) => {
                        if (!ok) {
                          setError('Unable to remove sharing.')
                          return
                        }
                        setSharings((prev) => prev.filter((s) => s.id !== sharing.id))
                      })
                    }
                  }}
                  className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add a new share */}
      {shareableOrgs.length > 0 && (
        <div className="rounded-lg border border-white/5 p-5">
          <h3 className="font-semibold text-foreground mb-4">Add Sharing Rule</h3>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-3">
              You can share your data with the following organizations:
            </div>
            {shareableOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() =>
                  createSharing(organization.id, org.id, 'all').then(() => {
                    getDataSharing(organization.id).then((rows) => {
                      setSharings(rows)
                    })
                  })
                }
                className="w-full flex items-center justify-between p-3 rounded-lg border border-white/10 hover:border-[#07f880]/50 hover:bg-[#07f880]/5 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {org.type || org.organization_type || 'organization'}
                  </p>
                </div>
                <Unlock className="h-4 w-4 text-[#07f880]" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
