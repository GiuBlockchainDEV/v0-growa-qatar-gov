'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { cn } from '@/lib/utils'
import { 
  ChevronDown, 
  Menu, 
  X, 
  LayoutDashboard, 
  Sprout, 
  RefreshCw, 
  Package, 
  BarChart3, 
  Users, 
  Settings,
  Building2
} from 'lucide-react'

const navigationItems = [
  { href: '/dashboard', label: 'Overview', labelAr: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/dashboard/farms', label: 'Farms', labelAr: 'المزارع', icon: Sprout },
  { href: '/dashboard/cycles', label: 'Production', labelAr: 'الإنتاج', icon: RefreshCw },
  { href: '/dashboard/inventory', label: 'Inventory', labelAr: 'المخزون', icon: Package },
  { href: '/dashboard/analytics', label: 'Analytics', labelAr: 'التحليلات', icon: BarChart3 },
  { href: '/dashboard/team', label: 'Team', labelAr: 'الفريق', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings },
]

export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const { locale, direction } = useI18n()
  const { organization, loading } = useOrganization()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 md:hidden rounded-lg border border-border bg-card p-3 hover:bg-secondary shadow-lg"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 z-40 flex w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : direction === 'rtl' ? 'translate-x-full' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
            alt="Growa" 
            className="h-10 w-10 drop-shadow-md"
          />
          <div className="flex flex-col">
            <h1 className="font-bold text-lg text-sidebar-foreground tracking-tight">GROWA</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-medium">Qatar Operations</p>
          </div>
        </div>

        {/* Organization Selector */}
        <div className="border-b border-sidebar-border px-4 py-3">
          <button className="w-full flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-sm hover:bg-sidebar-accent hover:border-primary/30 transition-all group">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="truncate text-left font-medium text-sidebar-foreground">
                {loading ? 'Loading...' : organization?.name || 'Select Organization'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {locale === 'ar' ? 'التنقل' : 'Navigation'}
          </p>
          {navigationItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-primary/10 text-primary border border-primary/20 glow-border'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : '')} />
                <span>{locale === 'ar' ? item.labelAr : item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-3 border border-sidebar-border">
            <p className="text-xs font-semibold text-sidebar-foreground">Growa Qatar</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">v0.1.0 - Sovereign Platform</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-500 font-medium">System Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
