'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'

const MAP_SURFACE_MODULES = new Set(['live-map', 'map', 'national-map', 'inspection-map'])
const WORKSPACE_MODULES = new Set([
  'rss-feed',
  'data-analytics',
  'water-intelligence',
  'energy-intelligence',
  'weather',
  'harvest',
  'production-harvest',
])

function readBrowserSearchParams() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

function hasDeepLinkContext(params: URLSearchParams | null) {
  if (!params) return false
  return Boolean(
    params.get('module') ||
      params.get('farmId') ||
      params.get('pointId') ||
      params.get('zoom') ||
      params.get('focus') ||
      params.get('weatherGridId') ||
      params.get('weatherLat') ||
      params.get('weatherLng')
  )
}

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
  const lastModuleRef = useRef<string | null>(null)

  const moduleFromHook = searchParams.get('module')
  if (moduleFromHook) {
    lastModuleRef.current = moduleFromHook
  }
  const effectiveModule = moduleFromHook || lastModuleRef.current

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard') return

    const browserSearchParams = readBrowserSearchParams()
    const moduleFromUrl = browserSearchParams?.get('module') || null
    const resolvedModule = moduleFromHook || moduleFromUrl || lastModuleRef.current
    const hasTargetContextInUrl = hasDeepLinkContext(browserSearchParams)

    // Avoid stripping deep-link params during hydration/race conditions.
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

  const targetPointId = searchParams.get('pointId')
  const targetFocusToken = searchParams.get('focus')
  const zoomParam = searchParams.get('zoom')
  const requestedZoom = zoomParam ? Number(zoomParam) : Number.NaN
  const targetZoom =
    Number.isFinite(requestedZoom) && requestedZoom >= 3 && requestedZoom <= 19
      ? requestedZoom
      : undefined
  const hasWeatherContext = Boolean(
    searchParams.get('weatherGridId') ||
      searchParams.get('weatherLat') ||
      searchParams.get('weatherLng')
  )
  const isWorkspaceModule = Boolean(
    effectiveModule && (WORKSPACE_MODULES.has(effectiveModule) || hasWeatherContext)
  )
  const shouldRenderMapSurface =
    pathname === '/dashboard' &&
    !isWorkspaceModule &&
    (!effectiveModule || MAP_SURFACE_MODULES.has(effectiveModule))

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Base content surface: map-first for ministry workspace */}
      <main className="absolute inset-y-0 right-0 left-64">
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
        onMenuToggle={() => {}} 
        menuOpen={sidebarOpen}
        sidebarOffsetClassName="left-0"
        hideMenuToggle
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
