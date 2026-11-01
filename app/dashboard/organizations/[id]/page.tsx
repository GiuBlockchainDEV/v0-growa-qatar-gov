'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { Card, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, Field, FormMessage } from '@/components/brand/ui'

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tr } = useI18n()
  const activeOrg = useActiveOrganizationOptional()
  const [orgId, setOrgId] = useState('')
  const [org, setOrg] = useState<Record<string, unknown> | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  const canManage =
    activeOrg?.hasPermission('organizations.manage') ||
    activeOrg?.hasPermission('platform.organizations.provision')

  useEffect(() => {
    void params.then((p) => setOrgId(p.id))
  }, [params])

  useEffect(() => {
    if (!orgId) return
    fetch(`/api/organizations/${orgId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setOrg(data.organization)
        setMemberCount(data.activeMemberCount ?? 0)
        setName(String(data.organization?.name ?? ''))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [orgId])

  const save = async () => {
    setError(null)
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      return
    }
    void fetch(`/api/organizations/${orgId}`).then((r) => r.json()).then((d) => setOrg(d.organization))
  }

  const toggleActive = async (isActive: boolean) => {
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingState label={tr('Loading organisations…')} />
      </div>
    )
  }

  if (!org) {
    return (
      <PageBody>
        <FormMessage>{error ?? tr('Unknown error')}</FormMessage>
      </PageBody>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          title={String(org.name)}
          subtitle={String(org.slug ?? '')}
          actions={
            <Link href="/dashboard/settings/organizations">
              <Button variant="outline">{tr('Back to organisations')}</Button>
            </Link>
          }
        />

        <Card title={tr('Organisation')} className="mb-4">
          <div className="p-4 space-y-4">
            {canManage ? (
              <>
                <Field id="org-name" label={tr('Organisation name')} value={name} onChange={(e) => setName(e.target.value)} />
                <Button onClick={() => void save()}>{tr('Save profile')}</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void toggleActive(true)}>
                    {tr('Activate organisation')}
                  </Button>
                  <Button variant="outline" onClick={() => void toggleActive(false)}>
                    {tr('Deactivate organisation')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-[14px] text-content-soft">{String(org.description ?? '')}</p>
            )}
            <p className="text-[13px]">
              {tr('Members')}: {memberCount}
            </p>
            <Link href={`/dashboard/team?organizationId=${orgId}`} className="text-sage-700 text-[14px]">
              {tr('Users & roles')}
            </Link>
          </div>
        </Card>

        <FormMessage>{error}</FormMessage>
      </PageBody>
    </div>
  )
}
