'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { useUserAdmin } from '@/hooks/use-user-admin'
import { Card, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { FormMessage } from '@/components/brand/ui'

export default function AuditPage() {
  const { tr } = useI18n()
  const { organization } = useOrganization()
  const activeOrg = useActiveOrganizationOptional()
  const admin = useUserAdmin()
  const organizationId = organization?.id ?? ''

  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canView = activeOrg?.hasPermission('audit.view') ?? false

  const load = useCallback(async () => {
    if (!organizationId || !canView) {
      setLoading(false)
      return
    }
    const result = await admin.fetchAudit(organizationId, 100)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEvents(result.events as Array<Record<string, unknown>>)
  }, [admin, organizationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  if (!canView) {
    return (
      <PageBody>
        <p className="text-center text-content-soft py-12">{tr('You do not have permission to view audit logs.')}</p>
      </PageBody>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingState label={tr('Loading…')} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader title={tr('Security & audit')} subtitle={tr('Security-sensitive events for this organisation.')} />
        <FormMessage>{error}</FormMessage>
        <Card title={tr('Audit log')} flush>
          <ul className="divide-y divide-line">
            {events.length === 0 ? (
              <li className="px-4 py-6 text-content-soft text-[14px]">{tr('No audit events')}</li>
            ) : (
              events.map((ev) => (
                <li key={String(ev.id)} className="px-4 py-3 text-[13px]">
                  <span className="font-medium">{String(ev.action)}</span>
                  <span className="text-content-soft ms-2">{String(ev.resource_type ?? '')}</span>
                  <span className="block text-content-soft mt-1">{String(ev.created_at ?? '')}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </PageBody>
    </div>
  )
}
