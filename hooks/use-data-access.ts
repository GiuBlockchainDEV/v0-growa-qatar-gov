'use client'

import { useCallback } from 'react'
import { useAuth } from './use-auth'
import { useOrganization } from './use-organization'

type OrganizationType = 'government_master' | 'government' | 'private' | 'public'

export function useDataAccess() {
  const { user } = useAuth()
  const { organization } = useOrganization()

  /**
   * Determina se l'utente corrente può visualizzare i dati di un'altra organizzazione
   */
  const canViewOrganization = useCallback(
    (targetOrgType: OrganizationType, isShared: boolean) => {
      if (!organization) return false

      const orgType = organization.type || organization.organization_type
      if (!orgType) return false

      // Se è la stessa organizzazione
      if (orgType === targetOrgType) return true

      // Ministero vede tutto ciò che è condiviso
      if (orgType === 'government_master' && isShared) {
        return true
      }

      // Organizzazioni governative vedono solo i loro dati
      if (orgType === 'government') {
        return isShared
      }

      // Organizzazioni private vedono solo i loro dati
      if (orgType === 'private') {
        return false
      }

      return false
    },
    [organization]
  )

  /**
   * Determina quali risorse sono visibili all'utente
   */
  const getVisibleFarms = useCallback(
    (farms: any[], sharedFarms: any[] = []) => {
      if (!organization) return []

      const orgType = organization.type || organization.organization_type
      if (!orgType) return []

      if (orgType === 'government_master') {
        // Il ministero vede i propri farm + quelli condivisi
        return [
          ...farms.filter((f) => f.organization_id === organization.id),
          ...sharedFarms,
        ]
      }

      if (orgType === 'government') {
        // Le org governative vedono solo i propri farm + condivisi con loro
        return [
          ...farms.filter((f) => f.organization_id === organization.id),
          ...sharedFarms,
        ]
      }

      // Le org private vedono solo i propri farm
      return farms.filter((f) => f.organization_id === organization.id)
    },
    [organization]
  )

  /**
   * Verifica se l'utente può gestire la condivisione dati
   */
  const canManageSharing = useCallback((): boolean => {
    if (!organization) return false
    const orgType = organization.type || organization.organization_type
    return orgType === 'government' || orgType === 'government_master'
  }, [organization])

  return {
    canViewOrganization,
    getVisibleFarms,
    canManageSharing,
  }
}
