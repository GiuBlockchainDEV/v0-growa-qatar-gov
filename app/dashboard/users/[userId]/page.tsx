'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useUserAdmin } from '@/hooks/use-user-admin'
import { Card, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, FormMessage } from '@/components/brand/ui'
import { StatusTag } from '@/components/brand/status'

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { tr } = useI18n()
  const searchParams = useSearchParams()
  const organizationId = searchParams.get('organizationId') ?? ''
  const admin = useUserAdmin()
  const [userId, setUserId] = useState('')
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void params.then((p) => setUserId(p.userId))
  }, [params])

  useEffect(() => {
    if (!userId || !organizationId) return
    setLoading(true)
    admin.fetchUserDetail(organizationId, userId).then((result) => {
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDetail(result.detail)
    })
  }, [admin, userId, organizationId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingState label={tr('Loading…')} />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <PageBody>
        <FormMessage>{error ?? tr('User not found')}</FormMessage>
        <Link href={`/dashboard/team`} className="text-sage-700 text-[14px] mt-4 inline-block">
          {tr('Back to users')}
        </Link>
      </PageBody>
    )
  }

  const profile = detail.profile as Record<string, unknown>
  const permissions = (detail.permissionKeys as string[]) ?? []
  const invitations = (detail.invitations as Array<Record<string, unknown>>) ?? []
  const audit = (detail.audit as Array<Record<string, unknown>>) ?? []

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          title={String(profile.full_name || profile.email || tr('User'))}
          subtitle={String(profile.email ?? '')}
          actions={
            <Link href="/dashboard/team">
              <Button variant="outline">{tr('Back to users')}</Button>
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card title={tr('Identity')}>
            <dl className="px-4 py-3 space-y-2 text-[14px]">
              <div>
                <dt className="text-content-soft">{tr('Account status')}</dt>
                <dd>{String(profile.account_status ?? 'active')}</dd>
              </div>
              <div>
                <dt className="text-content-soft">{tr('Department or scope (optional)')}</dt>
                <dd>{String(profile.department_scope ?? '—')}</dd>
              </div>
            </dl>
          </Card>

          <Card title={tr('Role permissions')}>
            <ul className="px-4 py-3 flex flex-wrap gap-2">
              {permissions.map((key) => (
                <StatusTag key={key} level="good" label={key} />
              ))}
            </ul>
          </Card>

          <Card title={tr('Invitation history')} className="md:col-span-2">
            <ul className="divide-y divide-line">
              {invitations.length === 0 ? (
                <li className="px-4 py-3 text-content-soft text-[14px]">{tr('No invitations')}</li>
              ) : (
                invitations.map((inv) => (
                  <li key={String(inv.id)} className="px-4 py-3 text-[14px] flex justify-between gap-4">
                    <span>
                      {String(inv.role)} · {String(inv.status)}
                    </span>
                    <span className="text-content-soft">{String(inv.created_at ?? '')}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card title={tr('Security & audit')} className="md:col-span-2">
            <ul className="divide-y divide-line max-h-80 overflow-y-auto">
              {audit.length === 0 ? (
                <li className="px-4 py-3 text-content-soft text-[14px]">{tr('No audit events')}</li>
              ) : (
                audit.map((row) => (
                  <li key={String(row.id)} className="px-4 py-3 text-[13px]">
                    <span className="font-medium">{String(row.action)}</span>
                    <span className="text-content-soft ms-2">{String(row.created_at ?? '')}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </PageBody>
    </div>
  )
}
