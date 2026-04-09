'use client'

import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { Bell, Search, Command, Activity, Globe } from 'lucide-react'

export function DashboardTopNav() {
  const { locale } = useI18n()

  return (
    <header className="fixed top-0 right-0 left-0 z-30 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left spacer for sidebar toggle */}
        <div className="w-12" />

        {/* Center - Search (pointer-events-auto to make it clickable) */}
        <div className="flex-1 max-w-lg pointer-events-auto">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder={locale === 'ar' ? 'البحث في المنصة...' : 'Search platform...'}
              className="w-full rounded-lg border border-border bg-card/90 backdrop-blur-md px-3 py-2 pl-10 pr-20 text-sm placeholder-muted-foreground focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all shadow-lg"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">
                <Command className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">K</kbd>
            </div>
          </div>
        </div>

        {/* Right Side Actions (pointer-events-auto to make them clickable) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* System Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-[#07fc82]/30 shadow-lg">
            <Activity className="h-3.5 w-3.5 text-[#07fc82]" />
            <span className="text-xs font-medium text-[#07fc82]">
              {locale === 'ar' ? 'متصل' : 'Online'}
            </span>
          </div>

          {/* Notifications */}
          <button className="relative rounded-lg p-2.5 bg-card/90 backdrop-blur-md border border-border hover:border-primary/50 transition-all shadow-lg">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          </button>

          {/* Language Toggle */}
          <div className="rounded-lg bg-card/90 backdrop-blur-md border border-border shadow-lg">
            <LanguageToggle />
          </div>

          {/* User Menu */}
          <div className="rounded-lg bg-card/90 backdrop-blur-md border border-border shadow-lg">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
