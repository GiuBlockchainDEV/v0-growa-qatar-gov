import { Metadata } from 'next'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardTopNav } from '@/components/dashboard/top-nav'

export const metadata: Metadata = {
  title: 'Dashboard | Growa Qatar',
  description: 'Agricultural Operations Dashboard',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navigation */}
        <DashboardTopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
