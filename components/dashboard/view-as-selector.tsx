'use client'

import { useEffect, useState } from 'react'
import { useImpersonation } from '@/hooks/use-impersonation'
import { 
  Eye, 
  EyeOff, 
  ChevronDown, 
  Building2, 
  Shield, 
  Sprout, 
  Briefcase,
  Users,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ORG_TYPE_ICONS: Record<string, typeof Building2> = {
  government_master: Shield,
  government: Briefcase,
  farm_company: Sprout,
  private: Users,
}

const ORG_TYPE_LABELS: Record<string, string> = {
  government_master: 'Ministry',
  government: 'Government Agency',
  farm_company: 'Farm Company',
  private: 'Private',
}

const ORG_TYPE_COLORS: Record<string, string> = {
  government_master: 'text-amber-400',
  government: 'text-blue-400',
  farm_company: 'text-primary',
  private: 'text-purple-400',
}

export function ViewAsSelector() {
  const {
    isGrowaAdmin,
    isImpersonating,
    viewMode,
    currentRole,
    currentOrgName,
    currentOrgType,
    organizations,
    loading,
    setImpersonation,
    clearImpersonation,
    getRolesForOrgType,
  } = useImpersonation()

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'normal' | 'impersonation'>('normal')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [step, setStep] = useState<'org' | 'role'>('org')

  const handleOrgSelect = (orgId: string, orgType: string) => {
    setSelectedOrgId(orgId)
    const roles = getRolesForOrgType(orgType)
    if (roles.length === 1) {
      // Auto-select if only one role
      handleRoleSelect(roles[0].role)
    } else {
      setStep('role')
    }
  }

  const handleRoleSelect = async (role: string) => {
    if (!selectedOrgId) return
    await setImpersonation(role, selectedOrgId)
    setIsOpen(false)
    setStep('org')
    setSelectedOrgId(null)
    setSelectedRole(null)
  }

  const handleClear = async () => {
    await clearImpersonation()
    setMode('normal')
    setStep('org')
    setSelectedOrgId(null)
    setSelectedRole(null)
    setIsOpen(false)
  }

  const selectedOrg = organizations.find(o => o.id === selectedOrgId)
  const availableRoles = selectedOrg ? getRolesForOrgType(selectedOrg.type) : []

  // Group organizations by type
  const groupedOrgs = organizations.reduce((acc, org) => {
    if (!acc[org.type]) acc[org.type] = []
    acc[org.type].push(org)
    return acc
  }, {} as Record<string, typeof organizations>)

  const OrgIcon = currentOrgType ? ORG_TYPE_ICONS[currentOrgType] || Building2 : Building2

  // Keep local mode in sync with effective backend impersonation state
  useEffect(() => {
    setMode(viewMode)
  }, [viewMode])

  // Only show for growa.ai admins
  if (!isGrowaAdmin) return null

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
          isImpersonating
            ? 'border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20'
            : 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50'
        )}
      >
        <div className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg',
          isImpersonating ? 'bg-amber-500/20' : 'bg-primary/20'
        )}>
          {isImpersonating ? (
            <Eye className="h-4 w-4 text-amber-400" />
          ) : (
            <OrgIcon className={cn('h-4 w-4', ORG_TYPE_COLORS[currentOrgType || ''] || 'text-primary')} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-medium',
              isImpersonating ? 'text-amber-400' : 'text-primary'
            )}>
              {isImpersonating ? 'View Mode: Impersonated' : 'View Mode: Normal'}
            </span>
            {isImpersonating && (
              <AlertTriangle className="h-3 w-3 text-amber-400" />
            )}
          </div>
          <p className="text-sm text-white truncate">{currentOrgName || 'Normal User'}</p>
          <p className="text-xs text-white/50 truncate capitalize">
            {currentRole?.replace(/_/g, ' ') || 'No role'}
          </p>
        </div>

        <ChevronDown className={cn(
          'h-4 w-4 text-white/50 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-white/10 bg-[#0c0c0e] shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {step === 'org' ? 'Select View Mode' : 'Select Role'}
              </h3>
              {step === 'role' && (
                <button
                  onClick={() => {
                    setStep('org')
                    setSelectedOrgId(null)
                  }}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Back
                </button>
              )}
            </div>
            {step === 'org' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleClear()
                  }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs transition-colors',
                    !isImpersonating
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-white/10 bg-white/5 text-white/70 hover:text-white'
                  )}
                >
                  Normal User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('impersonation')
                    setStep('org')
                  }}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs transition-colors',
                    isImpersonating || mode === 'impersonation'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-white/10 bg-white/5 text-white/70 hover:text-white'
                  )}
                >
                  View As Role
                </button>
              </div>
            )}
            {isImpersonating && step === 'org' && mode === 'impersonation' && (
              <button
                onClick={handleClear}
                disabled={loading}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                Exit View Mode
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : step === 'org' ? (
              // Organization Selection
              <div className="space-y-3">
                {mode === 'normal' ? (
                  <div className="px-3 py-6 text-center text-sm text-white/60">
                    Normal mode active. Select <span className="text-primary">View As Role</span> to impersonate.
                  </div>
                ) : (
                  <>
                {Object.entries(groupedOrgs).map(([type, orgs]) => {
                  const TypeIcon = ORG_TYPE_ICONS[type] || Building2
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <TypeIcon className={cn('h-3.5 w-3.5', ORG_TYPE_COLORS[type])} />
                        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                          {ORG_TYPE_LABELS[type] || type}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {orgs.map(org => (
                          <button
                            key={org.id}
                            onClick={() => handleOrgSelect(org.id, org.type)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                              'hover:bg-white/5 text-white/80 hover:text-white'
                            )}
                          >
                            <span className="text-sm truncate">{org.name}</span>
                            {currentOrgName === org.name && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                  </>
                )}
              </div>
            ) : (
              // Role Selection
              <div className="space-y-1">
                <div className="px-2 py-1.5 mb-2">
                  <span className="text-xs text-white/50">
                    Selecting role for: <span className="text-white">{selectedOrg?.name}</span>
                  </span>
                </div>
                {availableRoles.map(role => (
                  <button
                    key={role.role}
                    onClick={() => handleRoleSelect(role.role)}
                    disabled={loading}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors',
                      'hover:bg-white/5 text-white/80 hover:text-white',
                      loading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div>
                      <span className="text-sm">{role.displayName}</span>
                      <p className="text-xs text-white/40">{role.role}</p>
                    </div>
                    {loading ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : currentRole === role.role && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
