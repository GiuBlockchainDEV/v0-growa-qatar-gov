'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { SatelliteMap } from '@/components/dashboard/satellite-map'
import { 
  Sprout, 
  RefreshCw, 
  Package, 
  Activity,
  TrendingUp,
  TrendingDown,
  Droplets,
  Thermometer,
  Wind,
  Sun,
  X,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { locale } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {locale === 'ar' ? 'جاري التحميل...' : 'Loading platform...'}
          </p>
        </div>
      </div>
    )
  }

  const stats = [
    { 
      label: locale === 'ar' ? 'إجمالي المزارع' : 'Total Farms', 
      value: '12', 
      change: '+2', 
      trend: 'up',
      icon: Sprout,
      color: 'text-[#07fc82]'
    },
    { 
      label: locale === 'ar' ? 'دورات نشطة' : 'Active Cycles', 
      value: '47', 
      change: '+8', 
      trend: 'up',
      icon: RefreshCw,
      color: 'text-[#07fc82]'
    },
    { 
      label: locale === 'ar' ? 'عناصر المخزون' : 'Inventory Items', 
      value: '1,247', 
      change: '-23', 
      trend: 'down',
      icon: Package,
      color: 'text-amber-400'
    },
    { 
      label: locale === 'ar' ? 'الأنشطة اليومية' : 'Daily Activities', 
      value: '89', 
      change: '+12', 
      trend: 'up',
      icon: Activity,
      color: 'text-violet-400'
    },
  ]

  const environmentalData = [
    { label: 'Temperature', value: '38°C', icon: Thermometer, status: 'warning' },
    { label: 'Humidity', value: '45%', icon: Droplets, status: 'normal' },
    { label: 'Wind', value: '12 km/h', icon: Wind, status: 'normal' },
    { label: 'UV Index', value: '9', icon: Sun, status: 'warning' },
  ]

  const activities = [
    { time: '2 min ago', action: 'Irrigation system activated', farm: 'Al Khor Farm' },
    { time: '15 min ago', action: 'Harvest recorded', farm: 'Date Palm Grove A' },
    { time: '1 hour ago', action: 'New cycle started', farm: 'Greenhouse Complex' },
    { time: '3 hours ago', action: 'Inventory restocked', farm: 'Central Warehouse' },
  ]

  return (
    <div className="absolute inset-0">
      {/* Full Screen Satellite Map - Base Layer */}
      <SatelliteMap locale={locale} fullscreen />

      {/* Sidebar Toggle Button - Always Visible, Fixed Position */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-20 left-4 z-50 p-3 rounded-lg bg-card/95 backdrop-blur-md border border-border hover:border-[#07fc82]/50 hover:bg-card transition-all shadow-xl group"
        title={sidebarOpen ? 'Close Panel' : 'Open Panel'}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-5 w-5 text-[#07fc82]" />
        ) : (
          <PanelLeftOpen className="h-5 w-5 text-foreground group-hover:text-[#07fc82] transition-colors" />
        )}
      </button>

      {/* Sliding Sidebar Panel */}
      <div 
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl z-40 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img 
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
              alt="Growa" 
              className="h-6 w-6"
            />
            <span className="font-bold text-foreground">
              {locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
            </span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="h-[calc(100%-60px)] overflow-y-auto p-4 space-y-6">
          
          {/* Stats Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {locale === 'ar' ? 'ملخص العمليات' : 'Operations Summary'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="p-3 rounded-lg bg-secondary/50 border border-border/50 hover:border-[#07fc82]/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`rounded p-1.5 bg-background ${stat.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className={`flex items-center gap-0.5 text-[10px] font-medium ${stat.trend === 'up' ? 'text-[#07fc82]' : 'text-red-400'}`}>
                        {stat.trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {stat.change}
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Environment Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {locale === 'ar' ? 'الظروف البيئية' : 'Environmental Conditions'}
            </h3>
            <div className="space-y-2">
              {environmentalData.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${item.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-[#07fc82]/20 text-[#07fc82]'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className={`text-sm font-bold ${item.status === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>
                      {item.value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity Section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {locale === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
            </h3>
            <div className="space-y-1">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className="h-2 w-2 mt-1.5 rounded-full bg-[#07fc82] shadow-[0_0_8px_#07fc8280]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.farm}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* User Info */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#07fc82]/20 flex items-center justify-center text-[#07fc82] font-bold">
                {user?.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#07fc82] animate-pulse" />
                  <span className="text-[10px] text-[#07fc82] font-medium">
                    {locale === 'ar' ? 'متصل' : 'Online'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
