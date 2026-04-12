'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { cn } from '@/lib/utils'
import { 
  ChevronDown, 
  LayoutDashboard, 
  Sprout, 
  RefreshCw, 
  Package, 
  BarChart3, 
  Users, 
  Settings,
  Building2,
  Share2,
  X
} from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'

const navigationItems = [
  { href: '/dashboard', label: 'Overview', labelAr: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/dashboard/farms', label: 'Farms', labelAr: 'المزارع', icon: Sprout },
  { href: '/dashboard/cycles', label: 'Production', labelAr: 'الإنتاج', icon: RefreshCw },
  { href: '/dashboard/inventory', label: 'Inventory', labelAr: 'المخزون', icon: Package },
  { href: '/dashboard/analytics', label: 'Analytics', labelAr: 'التحليلات', icon: BarChart3 },
  { href: '/dashboard/team', label: 'Team', labelAr: 'الفريق', icon: Users },
]

const adminItems = [
  { href: '/dashboard/settings/organizations', label: 'Organizations', labelAr: 'المنظمات', icon: Building2 },
  { href: '/dashboard/settings/data-sharing', label: 'Data Sharing', labelAr: 'مشاركة البيانات', icon: Share2 },
  { href: '/dashboard/settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings },
]

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const { locale } = useI18n()
  const { organization, loading } = useOrganization()
  const { getUserRole } = usePermissions()
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) {
      getUserRole(organization.id).then(setUserRole)
    }
  }, [organization?.id, getUserRole])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          'fixed top-16 left-0 bottom-0 z-[2100] w-64 bg-[#0c0c0e]/98 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Organization Selector */}
        <div className="border-b border-white/5 px-4 py-4">
          <button className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm hover:bg-white/10 hover:border-[#07fc82]/30 transition-all group">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#07fc82]" />
              <span className="truncate text-left font-medium text-white">
                {loading ? 'Loading...' : organization?.name || 'Select Organization'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/50 group-hover:text-[#07fc82] transition-colors" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 mb-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
            {locale === 'ar' ? 'التنقل' : 'Navigation'}
          </p>
          {navigationItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-[#07fc82]/10 text-[#07fc82] border border-[#07fc82]/20'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-[#07fc82]' : '')} />
                <span>{locale === 'ar' ? item.labelAr : item.label}</span>
              </Link>
            )
          })}

          {/* Admin Items - Show for all admin-level roles */}
          {userRole && ['admin', 'super_admin', 'ministry_admin', 'ministry_super_admin', 'hassad_admin', 'qdb_admin', 'farm_company_admin'].includes(userRole) && (
            <>
              <p className="px-3 mt-6 mb-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                {locale === 'ar' ? 'الإدارة' : 'Administration'}
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      active
                        ? 'bg-[#07fc82]/10 text-[#07fc82] border border-[#07fc82]/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-[#07fc82]' : '')} />
                    <span>{locale === 'ar' ? item.labelAr : item.label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 px-4 py-4">
          <div className="rounded-lg bg-white/5 px-3 py-3 border border-white/5">
            <p className="text-xs font-semibold text-white">Growa Qatar</p>
            <p className="text-[10px] text-white/40 mt-0.5">v0.1.0 - Sovereign Platform</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#07fc82] animate-pulse" />
              <span className="text-[10px] text-[#07fc82] font-medium">System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
