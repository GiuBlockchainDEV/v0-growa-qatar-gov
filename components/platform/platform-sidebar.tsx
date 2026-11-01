'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { navIcon } from '@/components/platform/nav-icons'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { buildDashboardNavHref } from '@/lib/dashboard/context-navigation'
import { resolveDashboardPageModule } from '@/lib/dashboard/map-navigation'
import { isHarvestModuleKey, navItemLabel, type ProductNavItem } from '@/lib/navigation/registry'
import { Logo, LogoMark } from '@/components/brand/logo'
import { StatusDot } from '@/components/brand/ui'

/*
 * Navigation rail — the brand's strong INVERSE moment: ink panel, cream
 * voice (Brand Book p.80 console; nav kept on the start side by decision).
 * Group names are pills with the items as plain text beneath, as in the
 * console; the active item is a cream pill.
 *
 * Availability is a SQUARE (the brand's data point), never a round dot.
 * On ink the derived sage-300 reads better than sage; "upcoming" is an
 * unlit cream square.
 */
const AVAILABILITY_TONE: Record<ProductNavItem['availability'], string> = {
  live: 'var(--growa-sage-300)',
  partial: 'var(--warning)',
  upcoming: 'rgba(238,244,201,.22)',
}

export function PlatformSidebar({
  collapsed = false,
  drawer,
}: {
  collapsed?: boolean
  /** Phone drawer state; undefined on larger screens. */
  drawer?: 'open' | 'closed'
}) {
  const { locale, t, tr } = useI18n()
  const { navigation: nav } = useSharedRoleNavigation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  /* On /dashboard the page falls back to the watchtower when the URL has no
     `module` (direct link, reload, landing after sign-in): resolve it the
     same way here, or no menu item was marked active. */
  const activeModule =
    pathname === '/dashboard' ? resolveDashboardPageModule(searchParams) : searchParams.get('module')

  const isItemActive = (item: ProductNavItem) => {
    if (item.key === 'farms-sites' && pathname.startsWith('/dashboard/farms')) return true
    if (item.key === 'supply-overview' && pathname.startsWith('/dashboard/supply-overview')) return true
    if (item.path.startsWith('/dashboard/settings') && pathname.startsWith(item.path)) return true
    if (item.path === '/dashboard/team' && pathname.startsWith('/dashboard/team')) return true
    if (item.path === '/dashboard/account' && pathname.startsWith('/dashboard/account')) return true
    if (item.path === '/dashboard/invitations' && pathname.startsWith('/dashboard/invitations')) return true
    if (item.path === '/dashboard/access' && pathname.startsWith('/dashboard/access')) return true
    if (item.path === '/dashboard/audit' && pathname.startsWith('/dashboard/audit')) return true
    if (item.path.startsWith('/dashboard/users') && pathname.startsWith('/dashboard/users')) return item.key === 'users-roles'
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

  const availabilityLabel = (a: ProductNavItem['availability']) =>
    a === 'live' ? tr('Live') : a === 'partial' ? tr('Partial') : tr('Coming soon')

  const RULE = { borderTopColor: 'rgba(238,244,201,.22)' }

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        'growa growa-inverse fixed top-0 start-0 bottom-0 z-[2100] flex flex-col bg-sidebar text-sidebar-foreground',
        'transition-[width,translate] duration-200 ease-[var(--ease-brand)]',
        collapsed ? 'w-20' : 'w-[15.5rem]',
        drawer === 'closed' && '-translate-x-full rtl:translate-x-full',
        drawer === 'open' && 'shadow-panel-lg'
      )}
      aria-hidden={drawer === 'closed' ? true : undefined}
      inert={drawer === 'closed' ? true : undefined}
    >
      {/* The mark sits bare on the ink (no tile, no pill — Brand Book p.22
          forbids enclosing it). Collapsed, only the square of the mark stays,
          as the app icon does. */}
      {collapsed ? (
        <div className="shrink-0 flex h-16 items-center justify-center">
          <LogoMark className="h-[18px] w-[18px] text-cream" />
          <span className="sr-only">Growa</span>
        </div>
      ) : (
        <div className="shrink-0 px-5 pt-6 pb-5">
          <Logo className="h-[22px] w-auto text-cream" title="Growa" />
          <p className="mt-4 text-[12px] leading-tight text-cream/60 truncate">
            {tr('Qatar · National intelligence platform')}
          </p>
        </div>
      )}

      <hr className={cn('growa-dotted-rule', collapsed ? 'mx-4' : 'mx-5')} style={RULE} />

      <nav
        className={cn('flex-1 overflow-y-auto overflow-x-hidden py-4', collapsed ? 'px-2' : 'px-3')}
        aria-label={tr('Main navigation')}
      >
        {nav.grouped.map(({ area, items }, gi) => (
          <div key={area.id} className={collapsed ? 'mb-3' : 'mb-5'}>
            {/* Collapsed, the group pill becomes a dotted divider — the
                system's inner divider — as in the SaaS rail. */}
            {collapsed ? (
              gi > 0 ? <hr className="growa-dotted-rule mx-3 mb-3" style={RULE} /> : null
            ) : (
              <p
                className="mx-2 mb-2 inline-flex items-center h-[22px] px-2.5 rounded-pill border text-[11px] text-cream"
                style={{ borderColor: 'rgba(238,244,201,.28)' }}
              >
                {areaLabel(area.id, area.label, area.labelAr)}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = navIcon(item.icon)
                const active = isItemActive(item)
                const href = buildDashboardNavHref(searchParams, item.path, {
                  preserveWhenActive: isHarvestModuleKey(item.key),
                  active,
                })
                const squareTone = active
                  ? item.availability === 'upcoming' ? 'var(--growa-stone-300)' : 'var(--growa-sage)'
                  : AVAILABILITY_TONE[item.availability]
                return (
                  <DashboardQueryLink
                    key={item.key}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    // Icons only: without the name on hover the rail is not navigable.
                    title={collapsed ? `${navItemLabel(item, locale)} · ${availabilityLabel(item.availability)}` : undefined}
                    className={cn(
                      'group relative flex items-center rounded-pill h-9 text-[13px] transition-colors',
                      'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream',
                      collapsed ? 'mx-auto w-11 justify-center' : 'gap-2.5 px-3',
                      active
                        ? 'bg-cream text-ink'
                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    )}
                  >
                    <Icon
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0',
                        collapsed ? 'h-5 w-5' : 'h-4 w-4',
                        active ? 'text-ink' : 'text-cream/55 group-hover:text-cream'
                      )}
                    />
                    {collapsed ? (
                      <>
                        <span className="sr-only">{navItemLabel(item, locale)}</span>
                        {/* Collapsed, only what is NOT fully live keeps its corner
                            square: eleven lit squares next to eleven icons are noise. */}
                        {item.availability !== 'live' && (
                          <StatusDot tone={squareTone} size={5} className="absolute top-1.5 end-1.5" />
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate leading-tight">{navItemLabel(item, locale)}</span>
                        <StatusDot tone={squareTone} size={6} className="shrink-0" />
                      </>
                    )}
                    <span className="sr-only">{availabilityLabel(item.availability)}</span>
                  </DashboardQueryLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 py-4', collapsed ? 'px-4 flex flex-col items-center' : 'px-5')}>
        <hr className="growa-dotted-rule mb-4 w-full" style={RULE} />
        {collapsed ? (
          <span title={tr('System online')}>
            <StatusDot tone="var(--growa-sage-300)" size={6} pulse />
            <span className="sr-only">{tr('System online')}</span>
          </span>
        ) : (
          <>
            <StatusDot
              tone="var(--growa-sage-300)"
              size={6}
              pulse
              className="text-[12px] text-cream"
              label={tr('System online')}
            />
            <p className="mt-1.5 text-[11px] text-cream/45">v2.0 · {tr('Sovereign platform')}</p>
          </>
        )}
      </div>
    </aside>
  )
}
