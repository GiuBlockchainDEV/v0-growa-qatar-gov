'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { useUserAdmin, type OrganizationInvitation } from '@/hooks/use-user-admin'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { Card, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, FormMessage } from '@/components/brand/ui'
import { StatusTag } from '@/components/brand/status'

export default function InvitationsPage() {
  const { tr } = useI18n()
  const { organization } = useOrganization()
  const activeOrg = useActiveOrganizationOptional()
  const admin = useUserAdmin()
  const organizationId = organization?.id ?? ''

  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)

  const canInvite = activeOrg?.hasPermission('users.invite') ?? false

  const load = useCallback(async () => {
    if (!organizationId || !canInvite) {
      setLoading(false)
      return
    }
    setError(null)
    const result = await admin.listInvitations(organizationId)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setInvitations(result.invitations)
  }, [admin, organizationId, canInvite])

  useEffect(() => {
    void load()
  }, [load])

  if (!canInvite) {
    return (
      <PageBody>
        <p className="text-content-soft py-12 text-center">{tr('You do not have permission to manage invitations.')}</p>
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
        <PageHeader
          title={tr('Invitations')}
          subtitle={tr('Pending and historical organization invitations.')}
          actions={
            <Button onClick={() => setInviteOpen(true)}>{tr('Invite member')}</Button>
          }
        />

        <FormMessage>{error}</FormMessage>
        {devLink && (
          <p className="text-[12px] text-content-soft mb-4 break-all">
            {tr('Development invitation link')}: {devLink}
          </p>
        )}

        <Card title={tr('Invitations')} flush>
          <ul className="divide-y divide-line">
            {invitations.map((inv) => (
              <li key={inv.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium">{inv.email}</p>
                  <p className="text-[13px] text-content-soft">
                    {inv.role} · {inv.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag level={inv.status === 'pending' ? 'high' : 'unknown'} label={inv.status} />
                  {inv.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const result = await admin.resendInvitation(organizationId, inv.id)
                          if (!result.ok) setError(result.error)
                          else {
                            if (result.devInviteUrl) setDevLink(result.devInviteUrl)
                            void load()
                          }
                        }}
                      >
                        {tr('Resend invitation')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const result = await admin.revokeInvitation(organizationId, inv.id)
                          if (!result.ok) setError(result.error)
                          else void load()
                        }}
                      >
                        {tr('Revoke invitation')}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-6 text-[14px]">
          <Link href="/dashboard/team" className="text-sage-700">
            {tr('Users & roles')}
          </Link>
        </p>

        <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} organizationId={organizationId} onInvited={() => void load()} />
      </PageBody>
    </div>
  )
}
