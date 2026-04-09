'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { useState } from 'react'
import { LogOut, Settings, User, ChevronDown, Shield } from 'lucide-react'

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()
  const { locale } = useI18n()

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/auth/login')
    } catch (error) {
      console.error('[v0] Logout failed:', error)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || '?'
  const username = user?.email?.split('@')[0] || 'User'

  return (
    <div className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary border border-transparent hover:border-border transition-all"
      >
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          {userInitial}
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
            {username}
          </span>
          <span className="text-[10px] text-muted-foreground">Operator</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card shadow-xl z-50 overflow-hidden">
          {/* User Info */}
          <div className="bg-secondary/50 border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs">
              <Shield className="h-3 w-3 text-green-500" />
              <span className="text-green-500 font-medium">Verified Account</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <button
              onClick={() => {
                router.push('/dashboard/settings')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-foreground"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              {locale === 'ar' ? 'الملف الشخصي' : 'Profile'}
            </button>
            <button
              onClick={() => {
                router.push('/dashboard/settings')
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-foreground"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              {locale === 'ar' ? 'الإعدادات' : 'Settings'}
            </button>
            
            <div className="my-2 border-t border-border" />
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-red-400"
            >
              <LogOut className="h-4 w-4" />
              {locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
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
