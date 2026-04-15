'use client'

import { Suspense, useEffect, useState } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false) // Closed by default

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (loading || navLoading || !user || pathname !== '/dashboard') return

    const module = searchParams.get('module')
    if (!module && landingPage && landingPage !== '/dashboard') {
      router.replace(landingPage)
    }
  }, [loading, navLoading, user, pathname, searchParams, landingPage, router])

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
  const shouldRenderMapSurface =
    pathname === '/dashboard' &&
    (!activeModule || ['live-map', 'map', 'national-map', 'inspection-map'].includes(activeModule))

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Base content surface: map-first for ministry workspace */}
      <main className="absolute inset-0">
        {isMinistryWorkspace && shouldRenderMapSurface ? <SatelliteMap /> : children}
      </main>

      {/* Header - Always Visible on Top */}
      <DashboardHeader 
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        menuOpen={sidebarOpen}
      />

      {/* Sidebar - Slides in from left when open */}
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
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
