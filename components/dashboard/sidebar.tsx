'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { cn } from '@/lib/utils'
import { 
  ChevronDown, 
  Building2,
  Share2,
  Settings,
  HelpCircle,
  PanelLeftOpen,
  PanelRightOpen
} from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { useRoleNavigation, getIconComponent } from '@/hooks/use-role-navigation'
import { ViewAsSelector } from './view-as-selector'

// Admin items are always the same
const adminItems = [
  { href: '/dashboard/settings/organizations', label: 'Organizations', labelAr: 'المنظمات', icon: Building2 },
  { href: '/dashboard/settings/data-sharing', label: 'Data Sharing', labelAr: 'مشاركة البيانات', icon: Share2 },
  { href: '/dashboard/settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings },
]

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
  contextualPanelOpen?: boolean
  rightDrawerOpen?: boolean
  onToggleContextualPanel?: () => void
  onToggleRightDrawer?: () => void
}

export function DashboardSidebar({
  isOpen,
  onClose,
  contextualPanelOpen = true,
  rightDrawerOpen = false,
  onToggleContextualPanel,
  onToggleRightDrawer,
}: DashboardSidebarProps) {
  const { locale } = useI18n()
  const { organization, loading } = useOrganization()
  const { getUserRole } = usePermissions()
  const { primaryItems, secondaryItems, menuItems, isLoading: navLoading, isMinistryWorkspace } =
    useRoleNavigation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  const activeModule = searchParams.get('module')
  const mainNavItems = primaryItems.length > 0
    ? primaryItems
    : menuItems.filter((item) => !['settings', 'support'].includes(item.key))
  const moreNavItems = secondaryItems.length > 0
    ? secondaryItems
    : menuItems.filter((item) => ['settings', 'support'].includes(item.key))

  const isAdminRole = userRole && [
    'admin', 'super_admin', 'ministry_admin', 'ministry_super_admin', 
    'hassad_admin', 'qdb_admin', 'farm_company_admin'
  ].includes(userRole)

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
          'fixed top-16 left-0 bottom-0 z-[2100] w-64 bg-[#0c0c0e]/98 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Organization Selector */}
        <div className="border-b border-white/5 px-4 py-4">
          <button className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm hover:bg-white/10 hover:border-[#07f880]/30 transition-all group">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#07f880]" />
              <span className="truncate text-left font-medium text-white">
                {loading ? 'Loading...' : organization?.name || 'Select Organization'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-white/50 group-hover:text-[#07f880] transition-colors" />
          </button>
          {isMinistryWorkspace && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleContextualPanel}
                className={cn(
                  'flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] transition-all',
                  contextualPanelOpen
                    ? 'border-[#07f880]/30 bg-[#07f880]/10 text-[#07f880]'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                )}
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
                {locale === 'ar' ? 'لوحة السياق' : 'Context'}
              </button>
              <button
                type="button"
                onClick={onToggleRightDrawer}
                className={cn(
                  'flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] transition-all',
                  rightDrawerOpen
                    ? 'border-[#07f880]/30 bg-[#07f880]/10 text-[#07f880]'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                )}
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
                {locale === 'ar' ? 'درج العمليات' : 'Ops Drawer'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 mb-3 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
            {locale === 'ar' ? 'التنقل' : 'Navigation'}
          </p>
          
          {navLoading ? (
            <div className="px-3 py-2">
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            </div>
          ) : (
            mainNavItems.map((item) => {
              const Icon = getIconComponent(item.icon)
              const active = activeModule ? activeModule === item.key : isActive(item.path)
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-[#07f880]/10 text-[#07f880] border border-[#07f880]/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-[#07f880]' : '')} />
                  <span>{item.label}</span>
                </Link>
              )
            })
          )}

          {moreNavItems.length > 0 && (
            <>
              <p className="px-3 mt-5 mb-2 text-[10px] uppercase tracking-widest text-white/35 font-semibold">
                {locale === 'ar' ? 'المزيد' : 'More'}
              </p>
              {moreNavItems.map((item) => {
                const Icon = getIconComponent(item.icon)
                const active = activeModule ? activeModule === item.key : isActive(item.path)
                return (
                  <Link
                    key={item.key}
                    href={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      active
                        ? 'bg-[#07f880]/10 text-[#07f880] border border-[#07f880]/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-[#07f880]' : '')} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </>
          )}

          {/* Admin Items - Show for non-ministry admin roles */}
          {isAdminRole && !isMinistryWorkspace && (
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
                        ? 'bg-[#07f880]/10 text-[#07f880] border border-[#07f880]/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-[#07f880]' : '')} />
                    <span>{locale === 'ar' ? item.labelAr : item.label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* View As Selector (only for @growa.ai users) */}
        <div className="border-t border-white/5 px-4 py-3">
          <ViewAsSelector />
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-4 py-4">
          <div className="rounded-lg bg-white/5 px-3 py-3 border border-white/5">
            <p className="text-xs font-semibold text-white">Growa Qatar</p>
            <p className="text-[10px] text-white/40 mt-0.5">v0.1.0 - Sovereign Platform</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#07f880] animate-pulse" />
              <span className="text-[10px] text-[#07f880] font-medium">System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
