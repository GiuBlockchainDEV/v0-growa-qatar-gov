'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { useTeamManagement, type TeamMember } from '@/hooks/use-team-management'
import { usePermissions } from '@/hooks/use-permissions'
import { Users, Plus, Trash2, Shield } from 'lucide-react'
import { useConfirm } from '@/components/brand/feedback'
import { Card, EmptyState, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'

export default function TeamPage() {
  const { tr, locale } = useI18n()
  const confirmDialog = useConfirm()
  const { user } = useAuth()
  const { organization } = useOrganization()
  const { getTeamMembers, removeMember } = useTeamManagement()
  const { getUserRole } = usePermissions()
  const organizationId = organization?.id || ''

  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!organizationId) {
        setIsLoading(false)
        return
      }

      const [fetchedMembers, role] = await Promise.all([
        getTeamMembers(organizationId),
        getUserRole(organizationId),
      ])

      setMembers(fetchedMembers)
      setUserRole(role)
      setIsLoading(false)
    }

    loadData()
  }, [organizationId, getTeamMembers, getUserRole])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={tr('Loading team members…')} />
      </div>
    )
  }

  const canManageUsers = userRole === 'admin' || userRole === 'super_admin'
  const dateLocale = locale === 'ar' ? 'ar-QA' : 'en-GB'

  /* Role as a status tag: the square carries the weight of the role. */
  const ROLE_LEVEL: Record<string, string> = {
    super_admin: 'critical',
    admin: 'high',
    editor: 'good',
    viewer: 'unknown',
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Company')}
          title={tr('Team members')}
          subtitle={tr('People with access to this organisation and their roles.')}
          actions={
            canManageUsers ? (
              <Button>
                <Plus strokeWidth={1.5} className="h-4 w-4" />
                {tr('Invite member')}
              </Button>
            ) : null
          }
        />

        <Card icon={Users} title={tr('Members')} actions={<StatusTag level="good" label={String(members.length)} />} flush>
          {members.length === 0 ? (
            <EmptyState compact title={tr('No members yet')} />
          ) : (
            <ul className="divide-y divide-line">
              {members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Initials on an ink square (radius 25%), like the user menu. */}
                    <div aria-hidden="true" className="h-10 w-10 shrink-0 bg-ink text-cream flex items-center justify-center text-[14px]" style={{ borderRadius: 10, fontWeight: 500 }}>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-content truncate" style={{ fontWeight: 500 }}>
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-[13px] text-content-soft truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusTag level={ROLE_LEVEL[member.role] || 'unknown'} label={tr(humanize(member.role))} />
                    <span className="text-[12px] text-content-soft tabular-nums">
                      {/* Typed rows showed it: a missing date used to print "Invalid Date". */}
                      {(() => {
                        const raw = member.status === 'invited' ? member.invited_at : member.joined_at ?? member.created_at
                        if (!raw) return null
                        const date = new Date(raw).toLocaleDateString(dateLocale)
                        return member.status === 'invited' ? tr('Invited {date}', { date }) : tr('Joined {date}', { date })
                      })()}
                    </span>

                    {canManageUsers && member.user_id !== user?.id && (
                      <button
                        disabled={!organizationId}
                        aria-label={tr('Remove {name}', { name: member.first_name || member.email })}
                        onClick={async () => {
                          if (await confirmDialog(tr('Remove this member?'))) {
                            removeMember(organizationId, member.id).then(() => {
                              setMembers(members.filter((m) => m.id !== member.id))
                            })
                          }
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-pill text-stone-500 hover:text-critical hover:bg-muted transition-colors"
                      >
                        <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card icon={Shield} title={tr('Role permissions')} className="mt-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Viewer', level: 'unknown', desc: 'View-only access' },
              { role: 'Editor', level: 'good', desc: 'Can edit data' },
              { role: 'Admin', level: 'high', desc: 'Manage users and data' },
              { role: 'Super admin', level: 'critical', desc: 'Full control' },
            ].map((item) => (
              <div key={item.role}>
                <dt><StatusTag level={item.level} label={tr(item.role)} /></dt>
                <dd className="mt-1.5 text-[13px] text-content-soft">{tr(item.desc)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </PageBody>
    </div>
  )
}
