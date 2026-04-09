'use client'

import { useI18n } from '@/lib/i18n'
import { UserMenu } from './user-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { Bell, Search, Command, Activity, PanelLeft, Globe } from 'lucide-react'

interface DashboardHeaderProps {
  onMenuToggle: () => void
  menuOpen: boolean
}

export function DashboardHeader({ onMenuToggle, menuOpen }: DashboardHeaderProps) {
  const { locale } = useI18n()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0c0c0e]/95 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left - Menu Toggle + Logo */}
        <div className="flex items-center gap-3">
          {/* Menu Toggle Button */}
          <button
            onClick={onMenuToggle}
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#07fc82]/50 transition-all"
            title={menuOpen ? 'Close Menu' : 'Open Menu'}
          >
            <PanelLeft className={`h-5 w-5 transition-colors ${menuOpen ? 'text-[#07fc82]' : 'text-white/70'}`} />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img 
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
              alt="Growa" 
              className="h-8 w-8"
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-white tracking-tight leading-none">GROWA</span>
              <span className="text-[10px] text-[#07fc82] uppercase tracking-widest font-medium">Qatar Operations</span>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 group-focus-within:text-[#07fc82] transition-colors" />
            <input
              type="text"
              placeholder={locale === 'ar' ? 'البحث في المنصة...' : 'Search platform...'}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-10 pr-20 text-sm text-white placeholder-white/40 focus:border-[#07fc82]/50 focus:bg-white/10 focus:outline-none transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-white/30">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 font-mono">
                <Command className="h-3 w-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 font-mono">K</kbd>
            </div>
          </div>
        </div>

        {/* Right - Status, Notifications, Language, User */}
        <div className="flex items-center gap-2">
          {/* Online Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#07fc82]/30 bg-[#07fc82]/10">
            <Activity className="h-3.5 w-3.5 text-[#07fc82]" />
            <span className="text-xs font-medium text-[#07fc82]">Online</span>
          </div>

          {/* Notifications */}
          <button className="relative h-10 w-10 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
            <Bell className="h-4 w-4 text-white/70" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#07fc82]" />
          </button>

          {/* Language */}
          <div className="hidden sm:block">
            <LanguageToggle />
          </div>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
