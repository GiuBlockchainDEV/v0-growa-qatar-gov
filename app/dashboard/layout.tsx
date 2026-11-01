'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { PlatformSidebar } from '@/components/platform/platform-sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { RoleNavigationProvider, useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { ActiveOrganizationProvider } from '@/contexts/active-organization-context'
import { OperationalContextProvider } from '@/contexts/operational-context-provider'
import { LatticeLoader } from '@/components/brand/ui'
import {
  hasDashboardDeepLinkContext,
  isDashboardMapSurfaceModule,
  resolveDashboardPageModule,
} from '@/lib/dashboard/map-navigation'

const LAST_DASHBOARD_MODULE_KEY = 'growa:last-dashboard-module'
const SIDEBAR_COLLAPSED_KEY = 'growa:sidebar-collapsed'

function readBrowserSearchParams() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

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
  const { landingPage, isLoading: navLoading } = useSharedRoleNavigation()
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
  /* Phones: the rail becomes a drawer over the page (with a scrim) instead
     of eating 80px of a 390px screen. It closes on navigation. */
  const [isPhone, setIsPhone] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setIsPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname, searchParams])

  const handleMenuToggle = useCallback(() => {
    if (isPhone) setDrawerOpen((open) => !open)
    else toggleSidebar()
  }, [isPhone, toggleSidebar])

  // Literal class names so Tailwind generates all of them.
  const railOffset = isPhone ? 'start-0' : sidebarCollapsed ? 'start-20' : 'start-[15.5rem]'
  const handledReloadRedirectRef = useRef(false)
  const lastModuleRef = useRef<string | null>(null)

  const moduleFromHook = searchParams.get('module')

  useEffect(() => {
    if (!moduleFromHook) return
    lastModuleRef.current = moduleFromHook
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(LAST_DASHBOARD_MODULE_KEY, moduleFromHook)
  }, [moduleFromHook])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard') return

    const browserParams = readBrowserSearchParams()
    const resolvedModule =
      resolveDashboardPageModule(searchParams) ||
      moduleFromHook ||
      browserParams?.get('module') ||
      lastModuleRef.current
    const hasTargetContextInUrl = hasDashboardDeepLinkContext(browserParams)

    if (!resolvedModule && !hasTargetContextInUrl && landingPage && landingPage !== '/dashboard') {
      router.replace(landingPage)
    }
  }, [loading, navLoading, user, pathname, searchParams, moduleFromHook, landingPage, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard' || handledReloadRedirectRef.current) return
    if (typeof window === 'undefined') return

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const isReloadNavigation = navigationEntry?.type === 'reload'
    if (!isReloadNavigation) return

    const currentParams = new URLSearchParams(window.location.search)
    const currentModule = resolveDashboardPageModule(currentParams) || currentParams.get('module')
    const isMapSurface =
      !currentModule || isDashboardMapSurfaceModule(currentModule)
    if (!isMapSurface) return

    if (hasDashboardDeepLinkContext(currentParams)) return

    const currentCanonical = currentModule === 'watchtower'
    if (currentCanonical) return

    handledReloadRedirectRef.current = true
    router.replace('/dashboard?module=watchtower')
  }, [loading, navLoading, user, pathname, router])

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
    <div className="growa h-screen w-screen overflow-hidden bg-muted relative">
      {isPhone && drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[2050]"
          style={{ background: 'rgba(17,30,19,.45)' }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <PlatformSidebar
        collapsed={isPhone ? false : sidebarCollapsed}
        drawer={isPhone ? (drawerOpen ? 'open' : 'closed') : undefined}
      />

      <DashboardHeader
        onMenuToggle={handleMenuToggle}
        menuOpen={isPhone ? drawerOpen : !sidebarCollapsed}
        sidebarOffsetClassName={railOffset}
        hideBrand
        platformShell
      />

      {/* Logical insets: in Arabic the rail and the offset mirror to the right. */}
      <main
        className={`absolute bottom-0 end-0 top-16 overflow-hidden transition-[inset-inline-start] duration-200 ease-[var(--ease-brand)] ${railOffset}`}
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
