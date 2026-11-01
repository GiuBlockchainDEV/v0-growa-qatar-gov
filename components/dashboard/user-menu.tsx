'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { roleDisplayName } from '@/lib/auth/role-registry'
import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { LogOut, Settings, User, ChevronDown, Shield } from 'lucide-react'

/* Avatar = the app icon's grammar (Brand Book p.78): ink square with
   radius 25% of its side, the initial in cream. No gradients. */
function Avatar({ size, initial }: { size: 32 | 40; initial: string }) {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 bg-ink text-cream flex items-center justify-center font-medium"
      style={{ width: size, height: size, borderRadius: size / 4, fontSize: size === 32 ? 13 : 15 }}
    >
      {initial}
    </div>
  )
}

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const activeOrg = useActiveOrganizationOptional()
  const router = useRouter()
  const { tr } = useI18n()
  const roleLabel = activeOrg?.effectiveOrgRole
    ? roleDisplayName(activeOrg.effectiveOrgRole)
    : tr('Operator')

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/auth/login')
    } catch (error) {
      console.error('[auth] sign-out failed:', error)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || '?'
  const username = user?.email?.split('@')[0] || tr('User')

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setIsOpen(false)
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={tr('User menu')}
        className="flex items-center gap-2 rounded-pill ps-1 pe-3 py-1 hover:bg-stone-100 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
      >
        <Avatar size={32} initial={userInitial} />
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-[13px] font-medium text-content truncate max-w-[110px] leading-tight">
            {username}
          </span>
          <span className="text-[11px] text-content-soft leading-tight">
            {roleLabel}
          </span>
        </div>
        <ChevronDown strokeWidth={1.5} className="h-4 w-4 text-content-soft hidden sm:block" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="growa absolute end-0 mt-2 w-64 rounded-xl border border-line bg-card shadow-panel z-50 overflow-hidden"
        >
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Avatar size={40} initial={userInitial} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-content truncate">{username}</p>
                <p className="text-[12px] text-content-soft truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-3">
              <span className="g-tag g-tag--outline" style={{ height: 24, padding: '0 10px', fontSize: 'var(--text-caption)' }}>
                <Shield strokeWidth={1.5} className="h-3 w-3" aria-hidden="true" />
                {tr('Verified account')}
              </span>
            </div>
          </div>

          <hr className="growa-dotted-rule mx-4" />

          <div className="p-2">
            <button
              role="menuitem"
              onClick={() => {
                router.push('/dashboard/account')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 rounded-pill px-3 h-10 text-[14px] hover:bg-stone-100 transition-colors text-content"
            >
              <User strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
              {tr('My profile')}
            </button>
            {activeOrg?.hasPermission('users.view') && (
              <button
                role="menuitem"
                onClick={() => {
                  router.push('/dashboard/team')
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 rounded-pill px-3 h-10 text-[14px] hover:bg-stone-100 transition-colors text-content"
              >
                <Shield strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
                {tr('Users & roles')}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                router.push('/dashboard/settings?tab=preferences')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 rounded-pill px-3 h-10 text-[14px] hover:bg-stone-100 transition-colors text-content"
            >
              <Settings strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
              {tr('Settings')}
            </button>

            <hr className="growa-dotted-rule my-2 mx-2" />

            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-pill px-3 h-10 text-[14px] hover:bg-critical/10 transition-colors text-critical"
            >
              <LogOut strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
              {tr('Sign out')}
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
