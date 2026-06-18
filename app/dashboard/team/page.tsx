'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useOrganization } from '@/hooks/use-organization'
import { useTeamManagement } from '@/hooks/use-team-management'
import { usePermissions } from '@/hooks/use-permissions'
import { Users, Plus, Trash2, Shield, Eye, Edit3 } from 'lucide-react'

export default function TeamPage() {
  const { user } = useAuth()
  const { organization } = useOrganization()
  const { getTeamMembers, updateMemberRole, removeMember } = useTeamManagement()
  const { getUserRole } = usePermissions()
  const organizationId = organization?.id || ''

  const [members, setMembers] = useState<any[]>([])
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Loading team members...</div>
      </div>
    )
  }

  const canManageUsers = userRole === 'admin' || userRole === 'super_admin'

  const getRoleIcon = (role: string) => {
    const iconProps = { className: 'h-4 w-4' }
    switch (role) {
      case 'super_admin':
        return <Shield {...iconProps} className="h-4 w-4 text-red-500" />
      case 'admin':
        return <Shield {...iconProps} className="h-4 w-4 text-orange-500" />
      case 'editor':
        return <Edit3 {...iconProps} className="h-4 w-4 text-[#07f880]" />
      case 'viewer':
        return <Eye {...iconProps} className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'admin':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'editor':
        return 'bg-[#07f880]/10 text-[#07f880] border-[#07f880]/20'
      case 'viewer':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-[#07f880]" />
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
        </div>
        {canManageUsers && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#07f880]/10 text-[#07f880] hover:bg-[#07f880]/20 transition-colors border border-[#07f880]/20">
            <Plus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      <div className="rounded-lg border border-white/5 overflow-hidden">
        <div className="divide-y divide-white/5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="h-10 w-10 rounded-full bg-[#07f880]/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#07f880]">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getRoleColor(member.role)}`}>
                  {getRoleIcon(member.role)}
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </div>

                <div className="text-xs text-muted-foreground">
                  {member.status === 'invited'
                    ? `Invited ${new Date(member.invited_at).toLocaleDateString()}`
                    : `Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                </div>

                {canManageUsers && member.user_id !== user?.id && (
                  <button
                    disabled={!organizationId}
                    onClick={() => {
                      if (confirm('Remove this member?')) {
                        removeMember(organizationId, member.id).then(() => {
                          setMembers(members.filter((m) => m.id !== member.id))
                        })
                      }
                    }}
                    className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Reference */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <h3 className="font-semibold text-foreground mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { role: 'Viewer', desc: 'View-only access' },
            { role: 'Editor', desc: 'Can edit data' },
            { role: 'Admin', desc: 'Manage users & data' },
            { role: 'Super Admin', desc: 'Full control' },
          ].map((item) => (
            <div key={item.role} className="flex gap-2">
              <div className="text-sm">
                <p className="font-medium text-foreground">{item.role}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
