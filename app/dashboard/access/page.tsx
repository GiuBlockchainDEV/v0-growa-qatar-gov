'use client'

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { PERMISSION_KEYS } from '@/lib/auth/capabilities'
import { permissionsForOrgRole, roleDisplayName } from '@/lib/auth/role-registry'
import { Card, PageBody, PageHeader } from '@/components/brand/layout'
import { StatusTag } from '@/components/brand/status'

export default function AccessPermissionsPage() {
  const { tr } = useI18n()
  const activeOrg = useActiveOrganizationOptional()

  const canView = activeOrg?.hasPermission('users.view') ?? false
  const effectiveRole = activeOrg?.effectiveOrgRole ?? 'viewer'

  const granted = useMemo(() => Array.from(activeOrg?.permissions ?? []), [activeOrg?.permissions])
  const roleCapabilities = useMemo(() => Array.from(permissionsForOrgRole(effectiveRole)), [effectiveRole])

  if (!canView) {
    return (
      <PageBody>
        <p className="text-center text-content-soft py-12">{tr('You do not have permission to view access settings.')}</p>
      </PageBody>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          title={tr('Access & permissions')}
          subtitle={tr('Effective capabilities for your account in the active organisation.')}
        />

        <Card title={tr('Your role')} className="mb-4">
          <p className="px-4 py-3 text-[14px]">
            {roleDisplayName(effectiveRole)} ({effectiveRole})
          </p>
        </Card>

        <Card title={tr('Granted permissions')} className="mb-4">
          <ul className="px-4 py-3 flex flex-wrap gap-2">
            {granted.map((key) => (
              <StatusTag key={key} level="good" label={key} />
            ))}
          </ul>
        </Card>

        <Card title={tr('Role permissions')}>
          <p className="px-4 pt-3 text-[13px] text-content-soft">
            {tr('Capabilities assigned to your organisation role (reference).')}
          </p>
          <ul className="px-4 py-3 flex flex-wrap gap-2">
            {roleCapabilities.map((key) => (
              <StatusTag
                key={key}
                level={granted.includes(key) ? 'good' : 'unknown'}
                label={key}
              />
            ))}
          </ul>
          <p className="px-4 pb-3 text-[12px] text-content-soft">
            {tr('Canonical permission keys')}: {PERMISSION_KEYS.length}
          </p>
        </Card>
      </PageBody>
    </div>
  )
}
