'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { DetailDrawer } from '@/components/dashboard/detail-drawer'
import { DrawerProvider } from '@/contexts/drawer-context'
import { MapLayerProvider } from '@/contexts/map-layer-context'
import { MapLayerControl } from '@/components/dashboard/map-layer-control'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Closed by default

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

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
    <DrawerProvider>
      <MapLayerProvider>
        <div className="h-screen w-screen overflow-hidden bg-background relative">
          {/* Full Screen Content (Map) - Base Layer */}
          <main className="absolute inset-0">
            {children}
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

          {/* Map Layer Control - Top right */}
          <MapLayerControl />

          {/* Detail Drawer - Slides in from right */}
          <DetailDrawer />
        </div>
      </MapLayerProvider>
    </DrawerProvider>
  )
}
