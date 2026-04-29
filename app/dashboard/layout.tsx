'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'

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
  const sidebarOpen = true
  const handledReloadRedirectRef = useRef(false)

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
  const targetFarmId = searchParams.get('farmId')
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
      <main className="absolute inset-y-0 right-0 left-64">
        {isMinistryWorkspace && shouldRenderMapSurface ? (
          <SatelliteMap
            targetFarmId={targetFarmId}
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
        onMenuToggle={() => {}} 
        menuOpen={sidebarOpen}
        sidebarOffsetClassName="left-64"
        hideMenuToggle
        hideBrand
      />

      {/* Sidebar - Persistently open on the left */}
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => {}}
        persistent
      />
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
