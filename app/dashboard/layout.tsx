'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { PlatformSidebar } from '@/components/platform/platform-sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { RoleNavigationProvider, useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { OperationalContextProvider } from '@/contexts/operational-context-provider'
import {
  hasDashboardDeepLinkContext,
  isDashboardMapSurfaceModule,
  resolveDashboardPageModule,
} from '@/lib/dashboard/map-navigation'

const LAST_DASHBOARD_MODULE_KEY = 'growa:last-dashboard-module'

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { landingPage, isLoading: navLoading } = useSharedRoleNavigation()
  const sidebarOpen = true
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
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-[#07f880]/20 border-t-[#07f880] animate-spin" />
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png"
              alt="Growa"
              className="absolute inset-0 m-auto h-8 w-8"
            />
          </div>
          <span className="text-sm text-muted-foreground font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050608] relative">
      <PlatformSidebar />

      <DashboardHeader
        onMenuToggle={() => {}}
        menuOpen={sidebarOpen}
        sidebarOffsetClassName="left-[15.5rem]"
        hideMenuToggle
        hideBrand
        platformShell
      />

      <main className="absolute inset-y-0 right-0 left-[15.5rem] top-16 overflow-hidden">{children}</main>
    </div>
  )
}

function DashboardLayoutFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-[#07f880]/20 border-t-[#07f880] animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">Loading workspace...</span>
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
    <RoleNavigationProvider>
      <OperationalContextProvider>
        <DashboardShellContent>{children}</DashboardShellContent>
      </OperationalContextProvider>
    </RoleNavigationProvider>
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
