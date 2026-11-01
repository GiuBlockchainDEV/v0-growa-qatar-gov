'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { useUserAdmin, type AdminUserRow } from '@/hooks/use-user-admin'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { Users, Plus, Search, ExternalLink } from 'lucide-react'
import { useConfirm } from '@/components/brand/feedback'
import { Card, EmptyState, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, Field, FormMessage, Select } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'
import { ASSIGNABLE_ORG_ROLES } from '@/lib/auth/assignable-org-roles'

export default function TeamPage() {
  const { tr } = useI18n()
  const confirmDialog = useConfirm()
  const { user } = useAuth()
  const { organization } = useOrganization()
  const activeOrg = useActiveOrganizationOptional()
  const admin = useUserAdmin()
  const organizationId = organization?.id || ''

  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const canView = activeOrg?.hasPermission('users.view') ?? false
  const canInvite = activeOrg?.hasPermission('users.invite') ?? false
  const canManage = activeOrg?.hasPermission('users.manage') ?? false
  const canAssign = activeOrg?.hasPermission('roles.assign') ?? false

  const loadUsers = useCallback(async () => {
    if (!organizationId || !canView) {
      setIsLoading(false)
      return
    }
    setError(null)
    setIsLoading(true)
    const result = await admin.listUsers(organizationId, {
      q: search.trim() || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
    })
    setIsLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUsers(result.users)
  }, [admin, organizationId, canView, search, roleFilter, statusFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const roleOptions = useMemo(() => {
    const roles = new Set<string>([...ASSIGNABLE_ORG_ROLES, ...users.map((u) => u.role)])
    return Array.from(roles).sort()
  }, [users])


  if (!canView) {
    return (
      <PageBody>
        <NoticeUnauthorized />
      </PageBody>
    )
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={tr('Loading team members…')} />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Platform access')}
          title={tr('Users & roles')}
          subtitle={tr('People with access to this organisation and their roles.')}
          actions={
            canInvite ? (
              <Button onClick={() => setInviteOpen(true)}>
                <Plus strokeWidth={1.5} className="h-4 w-4" />
                {tr('Invite member')}
              </Button>
            ) : null
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Field
            id="user-search"
            label={tr('Search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Name or email')}
            prefix={<Search strokeWidth={1.5} className="h-4 w-4" />}
          />
          <Select
            id="role-filter"
            label={tr('Role')}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">{tr('All roles')}</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </Select>
          <Select
            id="status-filter"
            label={tr('Status')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{tr('All statuses')}</option>
            <option value="active">{tr('Active')}</option>
            <option value="invited">{tr('Invited')}</option>
            <option value="inactive">{tr('Inactive')}</option>
          </Select>
        </div>

        <div className="flex gap-2 mb-4">
          <Button variant="outline" onClick={() => void loadUsers()}>
            {tr('Apply filters')}
          </Button>
        </div>

        <FormMessage>{error}</FormMessage>

        <Card icon={Users} title={tr('Members')} actions={<StatusTag level="good" label={String(users.length)} />} flush>
          {users.length === 0 ? (
            <EmptyState compact title={tr('No members yet')} />
          ) : (
            <ul className="divide-y divide-line">
              {users.map((member) => (
                <li key={member.membershipId} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      aria-hidden="true"
                      className="h-10 w-10 shrink-0 bg-ink text-cream flex items-center justify-center text-[14px]"
                      style={{ borderRadius: 10, fontWeight: 500 }}
                    >
                      {(member.fullName || member.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-content truncate" style={{ fontWeight: 500 }}>
                        {member.fullName || member.email}
                      </p>
                      <p className="text-[13px] text-content-soft truncate">{member.email}</p>
                      <p className="text-[12px] text-content-soft">
                        {tr('Account status')}: {member.accountStatus}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {canAssign && member.userId !== user?.id ? (
                      <Select
                        id={`role-${member.membershipId}`}
                        label=""
                        value={member.role}
                        onChange={async (e) => {
                          const nextRole = e.target.value
                          const result = await admin.updateMemberRole(organizationId, member.membershipId, nextRole)
                          if (!result.ok) {
                            setError(result.error)
                            return
                          }
                          void loadUsers()
                        }}
                        className="min-w-[140px]"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {humanize(r)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <StatusTag level="unknown" label={tr(humanize(member.role))} />
                    )}

                    <StatusTag
                      level={member.status === 'active' ? 'good' : member.status === 'invited' ? 'high' : 'unknown'}
                      label={member.status}
                    />

                    <Link
                      href={`/dashboard/users/${member.userId}?organizationId=${organizationId}`}
                      className="text-sage-700 hover:text-ink inline-flex items-center gap-1 text-[13px]"
                    >
                      {tr('Details')}
                      <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
                    </Link>

                    {canManage && member.userId !== user?.id && (
                      <>
                        {member.accountStatus === 'suspended' ? (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              const result = await admin.setAccountStatus(organizationId, member.userId, 'reactivate')
                              if (!result.ok) setError(result.error)
                              else void loadUsers()
                            }}
                          >
                            {tr('Reactivate')}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!(await confirmDialog(tr('Suspend this user?')))) return
                              const result = await admin.setAccountStatus(organizationId, member.userId, 'suspend')
                              if (!result.ok) setError(result.error)
                              else void loadUsers()
                            }}
                          >
                            {tr('Suspend')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={async () => {
                            if (!(await confirmDialog(tr('Remove this member?')))) return
                            const result = await admin.removeMember(organizationId, member.membershipId)
                            if (!result.ok) {
                              setError(result.error)
                              return
                            }
                            void loadUsers()
                          }}
                        >
                          {tr('Remove access')}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <InviteMemberDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          organizationId={organizationId}
          onInvited={() => void loadUsers()}
        />
      </PageBody>
    </div>
  )
}

function NoticeUnauthorized() {
  const { tr } = useI18n()
  return (
    <div className="py-16 text-center text-content-soft">
      {tr('You do not have permission to manage members.')}
    </div>
  )
}
