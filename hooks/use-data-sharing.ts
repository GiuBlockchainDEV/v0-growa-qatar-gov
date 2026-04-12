'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DataSharingRecord {
  id: string
  owner_organization_id: string
  shared_with_organization_id: string
  resource_type: string
  resource_id?: string
  is_active: boolean
  created_at: string
  expires_at?: string
}

export function useDataSharing() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  /**
   * Ottiene le condivisioni dati per un'organizzazione
   */
  const getDataSharing = useCallback(
    async (organizationId: string) => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('data_sharing')
          .select('*')
          .eq('owner_organization_id', organizationId)
          .eq('is_active', true)

        if (error) throw error
        return data || []
      } finally {
        setIsLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Crea una nuova condivisione dati
   */
  const createSharing = useCallback(
    async (
      ownerOrgId: string,
      sharedWithOrgId: string,
      resourceType: string,
      resourceId?: string
    ) => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('data_sharing')
          .insert({
            owner_organization_id: ownerOrgId,
            shared_with_organization_id: sharedWithOrgId,
            resource_type: resourceType,
            resource_id: resourceId,
            is_active: true,
          })
          .select()

        if (error) throw error
        return data?.[0]
      } finally {
        setIsLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Rimuove una condivisione dati
   */
  const removeSharing = useCallback(
    async (sharingId: string) => {
      setIsLoading(true)
      try {
        const { error } = await supabase
          .from('data_sharing')
          .update({ is_active: false })
          .eq('id', sharingId)

        if (error) throw error
        return true
      } finally {
        setIsLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Ottiene le organizzazioni con cui è possibile condividere
   */
  const getShareableOrganizations = useCallback(
    async (currentOrgType: string) => {
      try {
        const query = supabase.from('organizations').select('id, name, type')

        // Se sei government_master, puoi condividere con other government orgs
        if (currentOrgType === 'government_master') {
          return query.eq('type', 'government')
        }

        // Se sei government, puoi condividere col ministero
        if (currentOrgType === 'government') {
          return query.eq('type', 'government_master')
        }

        // Le private org non possono condividere
        return { data: [] }
      } catch {
        return { data: [] }
      }
    },
    [supabase]
  )

  return {
    isLoading,
    getDataSharing,
    createSharing,
    removeSharing,
    getShareableOrganizations,
  }
}
