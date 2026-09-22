'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getIconComponent, isHarvestModuleKey } from '@/hooks/use-role-navigation'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { buildProductNavigation, type ProductNavItem } from '@/lib/platform/product-navigation'

const AVAILABILITY_DOT: Record<ProductNavItem['availability'], string> = {
  live: 'bg-[#07f880]',
  partial: 'bg-amber-400',
  upcoming: 'bg-white/20',
}

export function PlatformSidebar() {
  const { locale, t } = useI18n()
  const { effectiveRole, roleProfile } = useSharedRoleNavigation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeModule = searchParams.get('module')
  const nav = buildProductNavigation(effectiveRole, roleProfile)

  const isItemActive = (item: ProductNavItem) => {
    if (item.key === 'farms-sites' && pathname.startsWith('/dashboard/farms')) return true
    if (item.key === 'supply-overview' && pathname.startsWith('/dashboard/supply-overview')) return true
    if (item.path.startsWith('/dashboard/settings') && pathname.startsWith(item.path)) return true
    if (item.path === '/dashboard/team' && pathname.startsWith('/dashboard/team')) return true
    if (activeModule) {
      if (item.key === activeModule) return true
      if (
        (item.key === 'watchtower' || item.key === 'national-overview') &&
        (activeModule === 'watchtower' || activeModule === 'national-overview')
      ) {
        return true
      }
      if (isHarvestModuleKey(item.key) && isHarvestModuleKey(activeModule)) return true
      if (item.key === 'harvest' && activeModule === 'harvest') return true
      if (item.key === 'production-harvest' && activeModule === 'harvest') return true
      if (item.key === 'cross-analytics' && activeModule === 'data-analytics') return true
      if (item.key === 'data-analytics' && activeModule === 'data-analytics') return true
      if (item.key === 'ai-briefings' && activeModule === 'watchtower') return true
    }
    return false
  }

  const areaLabel = (areaId: string, fallback: string, fallbackAr: string) => {
    const key = `nav.area.${areaId}`
    const translated = t(key)
    if (translated && translated !== key) return translated
    return locale === 'ar' ? fallbackAr : fallback
  }

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-[2100] w-[15.5rem] flex flex-col border-r border-white/[0.06] bg-[#06080c]">
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#07f880]/10 ring-1 ring-[#07f880]/20">
            <span className="text-xs font-bold text-[#07f880]">GQ</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Growa Qatar</p>
            <p className="text-[10px] text-white/35 truncate">
              {locale === 'ar' ? 'منصة الذكاء الزراعي' : 'National Intelligence Platform'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.grouped.map(({ area, items }) => (
          <div key={area.id} className="mb-4">
            <p className="px-2.5 mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
              {areaLabel(area.id, area.label, area.labelAr)}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = getIconComponent(item.icon)
                const active = isItemActive(item)
                return (
                  <Link
                    key={item.key}
                    href={item.path}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                      active
                        ? 'bg-[#07f880]/10 text-[#07f880] ring-1 ring-[#07f880]/15'
                        : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#07f880]' : 'text-white/40')} />
                    <span className="flex-1 truncate leading-tight">{item.label}</span>
                    <span
                      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', AVAILABILITY_DOT[item.availability])}
                      title={item.availability}
                    />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.05]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#07f880] animate-pulse" />
            <span className="text-[10px] font-medium text-[#07f880]">
              {locale === 'ar' ? 'النظام متصل' : 'System Online'}
            </span>
          </div>
          <p className="mt-1 text-[9px] text-white/30">v2.0 · Sovereign Platform</p>
        </div>
      </div>
    </aside>
  )
}
