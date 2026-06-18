'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { 
  Building2,
  Share2,
  Settings
} from 'lucide-react'
import { useRoleNavigation, getIconComponent } from '@/hooks/use-role-navigation'

// Admin items are always the same
const adminItems = [
  { href: '/dashboard/settings/organizations', label: 'Organizations', labelAr: 'المنظمات', icon: Building2 },
  { href: '/dashboard/settings/data-sharing', label: 'Data Sharing', labelAr: 'مشاركة البيانات', icon: Share2 },
  { href: '/dashboard/settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings },
]

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
  persistent?: boolean
}

const arabicMenuLabels: Record<string, string> = {
  'live-map': 'الخريطة المباشرة',
  'rss-feed': 'موجز RSS',
  'data-analytics': 'تحليلات البيانات',
  'water-intelligence': 'ذكاء المياه',
  'energy-intelligence': 'ذكاء الطاقة',
  weather: 'الطقس',
  monitoring: 'المراقبة',
  alerts: 'التنبيهات',
  reports: 'التقارير',
  support: 'الدعم',
  settings: 'الإعدادات',
  'supply-overview': 'نظرة عامة على الإمداد',
  overview: 'نظرة عامة',
}

export function DashboardSidebar({
  isOpen,
  onClose,
  persistent = false,
}: DashboardSidebarProps) {
  const { locale } = useI18n()
  const {
    primaryItems,
    secondaryItems,
    menuItems,
    isLoading: navLoading,
    isMinistryWorkspace,
    effectiveRole,
  } =
    useRoleNavigation()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

  const isAdminRole = effectiveRole && [
    'admin', 'super_admin', 'ministry_admin', 'ministry_super_admin', 
    'hassad_admin', 'qdb_admin', 'farm_company_admin'
  ].includes(effectiveRole)

  const resolveItemLabel = (item: { key: string; label: string }) => {
    if (locale !== 'ar') return item.label
    return arabicMenuLabels[item.key] || item.label
  }

  return (
    <>
      {/* Overlay */}
      {!persistent && isOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          'fixed top-16 left-0 bottom-0 z-[2100] w-64 bg-[#0c0c0e]/98 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-in-out flex flex-col',
          persistent || isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
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
                  onClick={persistent ? undefined : onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-[#07f880]/10 text-[#07f880] border border-[#07f880]/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-[#07f880]' : '')} />
                  <span>{resolveItemLabel(item)}</span>
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
                    onClick={persistent ? undefined : onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      active
                        ? 'bg-[#07f880]/10 text-[#07f880] border border-[#07f880]/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-[#07f880]' : '')} />
                    <span>{resolveItemLabel(item)}</span>
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
                    onClick={persistent ? undefined : onClose}
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
