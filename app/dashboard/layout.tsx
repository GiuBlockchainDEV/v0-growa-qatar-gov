'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { cn } from '@/lib/utils'

const SIDEBAR_STORAGE_KEY = 'growa-dashboard-sidebar-open'

function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { landingPage, isMinistryWorkspace, isLoading: navLoading } = useRoleNavigation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHydrated, setSidebarHydrated] = useState(false)
  const handledReloadRedirectRef = useRef(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored === 'true' || stored === 'false') {
      setSidebarOpen(stored === 'true')
    }
    setSidebarHydrated(true)
  }, [])

  useEffect(() => {
    if (!sidebarHydrated || typeof window === 'undefined') return
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen))
  }, [sidebarHydrated, sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSidebar, sidebarOpen])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard') return

    const moduleFromHook = searchParams.get('module')
    const browserSearchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const moduleFromUrl = browserSearchParams?.get('module') || null
    const hasTargetContextInUrl = Boolean(
      browserSearchParams?.get('farmId') ||
        browserSearchParams?.get('pointId') ||
        browserSearchParams?.get('zoom') ||
        browserSearchParams?.get('focus')
    )

    // Avoid stripping deep-link params during hydration/race conditions.
    if (!moduleFromHook && !moduleFromUrl && !hasTargetContextInUrl && landingPage && landingPage !== '/dashboard') {
      router.replace(landingPage)
    }
  }, [loading, navLoading, user, pathname, searchParams, landingPage, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard' || handledReloadRedirectRef.current) return
    if (typeof window === 'undefined') return

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const isReloadNavigation = navigationEntry?.type === 'reload'
    if (!isReloadNavigation) return

    const currentParams = new URLSearchParams(window.location.search)
    const currentModule = currentParams.get('module')
    const isMapSurface =
      !currentModule ||
      ['live-map', 'map', 'national-map', 'inspection-map'].includes(currentModule)
    if (!isMapSurface) return

    const canonicalParams = new URLSearchParams({ module: 'live-map', zoom: '10' })
    const currentCanonical =
      currentModule === 'live-map' &&
      currentParams.get('zoom') === '10' &&
      !currentParams.get('farmId') &&
      !currentParams.get('pointId') &&
      !currentParams.get('focus')
    if (currentCanonical) return

    handledReloadRedirectRef.current = true
    router.replace(`/dashboard?${canonicalParams.toString()}`)
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

  const activeModule = searchParams.get('module')
  const targetPointId = searchParams.get('pointId')
  const targetFocusToken = searchParams.get('focus')
  const zoomParam = searchParams.get('zoom')
  const requestedZoom = zoomParam ? Number(zoomParam) : Number.NaN
  const targetZoom =
    Number.isFinite(requestedZoom) && requestedZoom >= 3 && requestedZoom <= 19
      ? requestedZoom
      : undefined
  const shouldRenderMapSurface =
    pathname === '/dashboard' &&
    (!activeModule || ['live-map', 'map', 'national-map', 'inspection-map'].includes(activeModule))

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Base content surface: map-first for ministry workspace */}
      <main
        className={cn(
          'absolute inset-y-0 right-0 transition-[left] duration-300 ease-in-out',
          sidebarOpen ? 'left-64' : 'left-0'
        )}
      >
        {isMinistryWorkspace && shouldRenderMapSurface ? (
          <SatelliteMap
            targetPointId={targetPointId}
            targetFocusToken={targetFocusToken}
            targetZoom={targetZoom}
          />
        ) : (
          children
        )}
      </main>

      {/* Header - Always Visible on Top */}
      <DashboardHeader
        onMenuToggle={toggleSidebar}
        menuOpen={sidebarOpen}
        sidebarOffsetClassName="left-0"
      />

      {/* Sidebar - Collapsible navigation */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
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
