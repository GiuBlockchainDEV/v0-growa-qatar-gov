'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { Activity } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { menuItems, landingPage, isMinistryWorkspace, isLoading: navLoading } = useRoleNavigation()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Closed by default
  const [contextualPanelOpen, setContextualPanelOpen] = useState(true)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

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

  const activeModule = useMemo(() => {
    const moduleParam = searchParams.get('module')
    if (moduleParam) {
      return menuItems.find((item) => item.key === moduleParam) || null
    }
    return menuItems[0] || null
  }, [searchParams, menuItems])

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
    <div className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Base content surface: map-first for ministry workspace */}
      <main className="absolute inset-0">
        {isMinistryWorkspace && pathname === '/dashboard' ? <SatelliteMap /> : children}
      </main>

      {/* Left contextual panel */}
      {isMinistryWorkspace && contextualPanelOpen && activeModule && pathname === '/dashboard' && (
        <aside className="fixed top-16 left-0 bottom-0 z-[2050] w-[300px] border-r border-white/10 bg-[#0b0b0d]/95 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Context</p>
              <h2 className="text-sm font-semibold text-white mt-1">{activeModule.label}</h2>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Purpose</p>
              <p className="text-sm text-white/85">{activeModule.purpose}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Default Content</p>
              <p className="text-sm text-white/85">{activeModule.defaultContent}</p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Allowed Actions</p>
              <ul className="space-y-1.5">
                {(activeModule.allowedActions || []).map((action) => (
                  <li key={action} className="text-sm text-white/80 flex items-start gap-2">
                    <Activity className="h-3.5 w-3.5 text-[#07f880] mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Submenu</p>
              <div className="space-y-1.5">
                {(activeModule.submenu || []).map((subItem) => (
                  <div
                    key={subItem.key}
                    className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-white/80"
                  >
                    {subItem.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Right operational drawer */}
      {isMinistryWorkspace && rightDrawerOpen && activeModule && pathname === '/dashboard' && (
        <aside className="fixed top-16 right-0 bottom-0 z-[2050] w-[320px] border-l border-white/10 bg-[#0b0b0d]/95 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Operational Drawer</p>
              <h2 className="text-sm font-semibold text-white mt-1">{activeModule.label}</h2>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Visibility Scope</p>
              <p className="text-xs text-white/70">
                Org Types:{' '}
                {Array.isArray(activeModule.visibilityScope?.allowedOrgTypes)
                  ? activeModule.visibilityScope?.allowedOrgTypes.join(', ')
                  : 'All'}
              </p>
              <p className="text-xs text-white/70 mt-1">
                Required Permissions:{' '}
                {(activeModule.visibilityScope?.requiredPermissions || []).join(', ') || 'none'}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Map Context</p>
              <p className="text-sm text-white/80">
                This drawer is reserved for map-linked operational workflows (selection context, quick actions,
                and case links) for the active workspace module.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Header - Always Visible on Top */}
      <DashboardHeader 
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
        menuOpen={sidebarOpen}
      />

      {/* Sidebar - Slides in from left when open */}
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        contextualPanelOpen={contextualPanelOpen}
        rightDrawerOpen={rightDrawerOpen}
        onToggleContextualPanel={() => setContextualPanelOpen((prev) => !prev)}
        onToggleRightDrawer={() => setRightDrawerOpen((prev) => !prev)}
      />
    </div>
  )
}
