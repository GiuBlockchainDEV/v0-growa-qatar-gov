'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardTopNav } from '@/components/dashboard/top-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
            <div className="h-16 w-16 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
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
      {/* Full Screen Map Content - Base Layer */}
      <main className="absolute inset-0">
        {children}
      </main>

      {/* Collapsible Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Top Navigation Bar */}
      <DashboardTopNav />
    </div>
  )
}
