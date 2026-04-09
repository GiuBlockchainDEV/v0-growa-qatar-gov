'use client'

import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { Bell, Search } from 'lucide-react'

export function DashboardTopNav() {
  const { user, loading } = useAuth()
  const { t } = useI18n()

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('common.search')}
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 pl-10 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button className="relative rounded-lg p-2 hover:bg-muted transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
          </button>

          {/* Language Toggle */}
          <LanguageToggle />

          {/* User Menu */}
          {!loading && user && <UserMenu user={user} />}
        </div>
      </div>
    </header>
  )
}
