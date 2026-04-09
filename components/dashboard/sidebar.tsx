'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChevronDown, Menu, X } from 'lucide-react'

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/farms', label: 'Farms', icon: '🌾' },
  { href: '/dashboard/cycles', label: 'Production Cycles', icon: '🔄' },
  { href: '/dashboard/inventory', label: 'Inventory', icon: '📦' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈' },
  { href: '/dashboard/team', label: 'Team', icon: '👥' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const { t, direction } = useI18n()

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 md:hidden rounded-lg border border-border bg-card p-2 hover:bg-accent"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : direction === 'rtl' ? 'translate-x-full' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <div className="flex flex-col">
            <h1 className="font-bold text-foreground">{t('app.name')}</h1>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
        </div>

        {/* Organization Selector */}
        <div className="border-b border-border px-4 py-3">
          <button className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:bg-muted">
            <span className="truncate text-left font-medium">Ministry of Municipality</span>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'text-muted-foreground'
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p>Growa Qatar v0.1.0</p>
          <p>Sovereign Platform</p>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
