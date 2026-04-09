'use client'

import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { User, LogOut, Settings } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface UserMenuProps {
  user: SupabaseUser
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { logout } = useAuth()
  const router = useRouter()
  const { t } = useI18n()

  const handleLogout = async () => {
    try {
      await logout()
      setIsOpen(false)
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('[v0] Logout error:', error)
    }
  }

  return (
    <div className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
        <span className="hidden sm:inline text-sm font-medium text-foreground truncate max-w-[120px]">
          {user.email?.split('@')[0]}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg z-50">
          {/* User Info */}
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Account
            </p>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {user.email}
            </p>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 px-2 py-2">
            <button
              onClick={() => {
                router.push('/dashboard/settings')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
