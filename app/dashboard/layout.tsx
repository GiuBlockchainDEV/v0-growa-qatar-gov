'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { PlatformSidebar } from '@/components/platform/platform-sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { RoleNavigationProvider } from '@/contexts/role-navigation-context'
import { ActiveOrganizationProvider } from '@/contexts/active-organization-context'
import { OperationalContextProvider } from '@/contexts/operational-context-provider'
import { LatticeLoader } from '@/components/brand/ui'
import { canonicalWatchtowerEntry } from '@/lib/dashboard/map-navigation'

const LAST_DASHBOARD_MODULE_KEY = 'growa:last-dashboard-module'
const SIDEBAR_COLLAPSED_KEY = 'growa:sidebar-collapsed'

function DashboardShellContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const { tr } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  /* Rail open (15.5rem) or icons only (5rem), as in the SaaS. The choice is
     remembered per browser; without one, narrow screens start collapsed. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (stored !== null) setSidebarCollapsed(stored === '1')
      else if (window.innerWidth < 1280) setSidebarCollapsed(true)
    } catch {
      /* storage blocked: keep the default */
    }
  }, [])
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* storage blocked: the toggle still works for this session */
      }
      return next
    })
  }, [])
  /* Both phones AND portrait tablets get a full-width workspace with
     navigation in an accessible temporary drawer (desktop rail >=1024px).
     The media query is the same breakpoint as the responsive stylesheet. */
  const [isCompact, setIsCompact] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const update = () => { setIsCompact(query.matches); setDrawerOpen(false) }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname, searchParams])

  const handleMenuToggle = useCallback(() => {
    if (isCompact) setDrawerOpen((open) => !open)
    else toggleSidebar()
  }, [isCompact, toggleSidebar])

  useEffect(() => {
    if (!isCompact || !drawerOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [isCompact, drawerOpen])

  // Literal class names so Tailwind generates all of them.
  const railOffset = isCompact ? 'start-0' : sidebarCollapsed ? 'start-20' : 'start-[15.5rem]'

  const moduleFromHook = searchParams.get('module')

  useEffect(() => {
    if (!moduleFromHook) return
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(LAST_DASHBOARD_MODULE_KEY, moduleFromHook)
  }, [moduleFromHook])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Canonicalize only the landing screen; don't override an explicit module,
  // field deep-link, or the selected Watchtower tab.
  useEffect(() => {
    if (loading || !user || pathname !== '/dashboard') return
    const target = canonicalWatchtowerEntry(
      new URLSearchParams(window.location.search), window.location.hash,
    )
    if (target) router.replace(target, { scroll: false })
  }, [loading, user, pathname, searchParams, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        {/* Brand wait state: the lattice lighting up, not a spinner. */}
        <div className="flex flex-col items-center gap-4 text-ink">
          <LatticeLoader label={tr('Loading')} />
          <span className="text-[14px] text-content-soft">{tr('Loading…')}</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div data-dashboard-shell className="growa relative h-dvh min-h-0 w-full overflow-hidden bg-muted">
      {isCompact && drawerOpen && (
        <button
          type="button"
          aria-label={tr('Close navigation')}
          className="fixed inset-0 z-[2050] cursor-default"
          style={{ background: 'rgba(17,30,19,.45)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <PlatformSidebar
        collapsed={isCompact ? false : sidebarCollapsed}
        drawer={isCompact ? (drawerOpen ? 'open' : 'closed') : undefined}
        onClose={() => setDrawerOpen(false)}
        onNavigate={() => setDrawerOpen(false)}
      />

      <DashboardHeader
        onMenuToggle={handleMenuToggle}
        menuOpen={isCompact ? drawerOpen : !sidebarCollapsed}
        sidebarOffsetClassName={railOffset}
        hideBrand
        platformShell
      />

      {/* Logical insets: in Arabic the rail and the offset mirror to the right. */}
      <main
        data-dashboard-main
        className={`absolute bottom-0 end-0 top-16 min-w-0 overflow-hidden transition-[inset-inline-start] duration-200 ease-[var(--ease-brand)] ${railOffset}`}
      >
        {children}
      </main>
    </div>
  )
}

function DashboardLayoutFallback() {
  const { tr } = useI18n()
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-ink">
        <LatticeLoader label={tr('Loading workspace')} />
        <span className="text-[14px] text-content-soft">{tr('Loading workspace…')}</span>
      </div>
    </div>
  )
}

function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ActiveOrganizationProvider>
      <RoleNavigationProvider>
        <OperationalContextProvider>
          <DashboardShellContent>{children}</DashboardShellContent>
        </OperationalContextProvider>
      </RoleNavigationProvider>
    </ActiveOrganizationProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  )
}
