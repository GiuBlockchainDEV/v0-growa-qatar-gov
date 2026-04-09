'use client'

import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { Bell, Search, Command, Activity } from 'lucide-react'

export function DashboardTopNav() {
  const { t, locale } = useI18n()

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Search */}
        <div className="flex-1 max-w-lg">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder={locale === 'ar' ? 'البحث في المنصة...' : 'Search platform...'}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 pl-10 pr-20 text-sm placeholder-muted-foreground focus:border-primary/50 focus:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">
                <Command className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">K</kbd>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* System Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <Activity className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-green-500">
              {locale === 'ar' ? 'متصل' : 'Online'}
            </span>
          </div>

          {/* Notifications */}
          <button className="relative rounded-lg p-2.5 hover:bg-secondary border border-transparent hover:border-border transition-all">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Language Toggle */}
          <LanguageToggle />

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
