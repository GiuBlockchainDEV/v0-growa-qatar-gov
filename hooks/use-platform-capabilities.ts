'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export interface PlatformCapabilities {
  isPlatformAdmin: boolean
  platformStaffTier: 'super_admin' | 'support' | null
  rolePreviewActive: boolean
  previewRole: string | null
  previewOrgId: string | null
}

const DEFAULT_CAPABILITIES: PlatformCapabilities = {
  isPlatformAdmin: false,
  platformStaffTier: null,
  rolePreviewActive: false,
  previewRole: null,
  previewOrgId: null,
}

export function usePlatformCapabilities() {
  const { user } = useAuth()
  const [capabilities, setCapabilities] = useState<PlatformCapabilities>(DEFAULT_CAPABILITIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setCapabilities(DEFAULT_CAPABILITIES)
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_auth_capabilities')
        if (cancelled) return
        if (error) {
          console.warn('[auth] get_my_auth_capabilities unavailable:', error.message)
          setCapabilities(DEFAULT_CAPABILITIES)
          return
        }
        const row = (Array.isArray(data) ? data[0] : data) as
          | {
              is_platform_admin?: boolean
              platform_staff_tier?: string | null
              role_preview_active?: boolean
              preview_role?: string | null
              preview_org_id?: string | null
            }
          | undefined

        setCapabilities({
          isPlatformAdmin: Boolean(row?.is_platform_admin),
          platformStaffTier:
            row?.platform_staff_tier === 'support'
              ? 'support'
              : row?.is_platform_admin
                ? 'super_admin'
                : null,
          rolePreviewActive: Boolean(row?.role_preview_active),
          previewRole: row?.preview_role ?? null,
          previewOrgId: row?.preview_org_id ?? null,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return { ...capabilities, loading }
}
