'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { useOrganization } from '@/hooks/use-organization'

interface PermissionGuardProps {
  permission: 'canView' | 'canEdit' | 'canManageUsers' | 'canDeleteOrganization'
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({
  permission,
  fallback = <div className="p-8 text-center text-muted-foreground">You don&apos;t have permission to access this</div>,
  children,
}: PermissionGuardProps) {
  const { organization } = useOrganization()
  const { getPermissions } = usePermissions()
  const [permissions, setPermissions] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const checkPermissions = async () => {
      if (!organization?.id) return
      const perms = await getPermissions(organization.id)
      setPermissions(perms)
      setIsLoading(false)
    }
    checkPermissions()
  }, [organization?.id, getPermissions])

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  return permissions?.[permission] ? <>{children}</> : <>{fallback}</>
}

import React from 'react'
