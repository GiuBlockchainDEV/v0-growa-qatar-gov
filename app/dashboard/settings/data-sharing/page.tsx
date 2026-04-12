'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/hooks/use-organization'
import { useDataSharing } from '@/hooks/use-data-sharing'
import { useDataAccess } from '@/hooks/use-data-access'
import { Share2, Lock, Unlock, Trash2 } from 'lucide-react'

export default function DataSharingPage() {
  const { organization } = useOrganization()
  const { getDataSharing, createSharing, removeSharing, getShareableOrganizations } = useDataSharing()
  const { canManageSharing } = useDataAccess()

  const [sharings, setSharings] = useState<any[]>([])
  const [shareableOrgs, setShareableOrgs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!organization?.id) return

      const [data, orgs] = await Promise.all([
        getDataSharing(organization.id),
        getShareableOrganizations(organization.type),
      ])

      setSharings(data)
      setShareableOrgs(orgs?.data || [])
      setIsLoading(false)
    }

    loadData()
  }, [organization?.id, organization?.type, getDataSharing, getShareableOrganizations])

  if (!canManageSharing()) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">Solo le organizzazioni governative possono gestire la condivisione dati.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Share2 className="h-6 w-6 text-[#07f880]" />
        <h1 className="text-2xl font-bold text-foreground">Data Sharing</h1>
      </div>

      {/* Condivisioni attive */}
      <div className="rounded-lg border border-white/5">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-semibold text-foreground">Condivisioni Attive</h2>
        </div>

        {sharings.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground">
            Nessuna condivisione dati attiva
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sharings.map((sharing) => (
              <div key={sharing.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{sharing.resource_type}</p>
                  <p className="text-sm text-muted-foreground">
                    Condiviso con: {sharing.shared_with_organization_id}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Rimuovere questa condivisione?')) {
                      removeSharing(sharing.id).then(() => {
                        setSharings(sharings.filter((s) => s.id !== sharing.id))
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

      {/* Aggiungi nuova condivisione */}
      {shareableOrgs.length > 0 && (
        <div className="rounded-lg border border-white/5 p-5">
          <h3 className="font-semibold text-foreground mb-4">Aggiungi Condivisione</h3>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-3">
              Puoi condividere i tuoi dati con le seguenti organizzazioni:
            </div>
            {shareableOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() =>
                  createSharing(organization.id, org.id, 'all').then(() => {
                    getDataSharing(organization.id).then(setSharings)
                  })
                }
                className="w-full flex items-center justify-between p-3 rounded-lg border border-white/10 hover:border-[#07f880]/50 hover:bg-[#07f880]/5 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.type}</p>
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
