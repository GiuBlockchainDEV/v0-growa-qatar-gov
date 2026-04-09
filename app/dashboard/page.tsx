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
  ChevronUp,
  ChevronDown,
  Droplets,
  Thermometer,
  Wind,
  Sun,
  X,
  LayoutGrid
} from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { locale } = useI18n()
  const [showStats, setShowStats] = useState(false)
  const [showEnvironment, setShowEnvironment] = useState(false)
  const [showActivity, setShowActivity] = useState(false)

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
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
      color: 'text-green-400'
    },
    { 
      label: locale === 'ar' ? 'دورات نشطة' : 'Active Cycles', 
      value: '47', 
      change: '+8', 
      trend: 'up',
      icon: RefreshCw,
      color: 'text-primary'
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
    <div className="fixed inset-0 top-14 left-0 md:left-64">
      {/* Full Screen Satellite Map */}
      <SatelliteMap locale={locale} fullscreen />

      {/* Floating Toggle Buttons - Always Visible */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowStats(!showStats)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md border transition-all ${
            showStats 
              ? 'bg-primary text-primary-foreground border-primary' 
              : 'bg-card/80 text-foreground border-border hover:border-primary/50'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="text-sm font-medium hidden sm:inline">
            {locale === 'ar' ? 'الإحصائيات' : 'Stats'}
          </span>
          {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <button
          onClick={() => setShowEnvironment(!showEnvironment)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md border transition-all ${
            showEnvironment 
              ? 'bg-primary text-primary-foreground border-primary' 
              : 'bg-card/80 text-foreground border-border hover:border-primary/50'
          }`}
        >
          <Thermometer className="h-4 w-4" />
          <span className="text-sm font-medium hidden sm:inline">
            {locale === 'ar' ? 'البيئة' : 'Environment'}
          </span>
          {showEnvironment ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <button
          onClick={() => setShowActivity(!showActivity)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md border transition-all ${
            showActivity 
              ? 'bg-primary text-primary-foreground border-primary' 
              : 'bg-card/80 text-foreground border-border hover:border-primary/50'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium hidden sm:inline">
            {locale === 'ar' ? 'النشاط' : 'Activity'}
          </span>
          {showActivity ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Stats Panel - Collapsible */}
      {showStats && (
        <div className="absolute top-4 left-40 sm:left-44 z-20 w-80 sm:w-96">
          <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">
                {locale === 'ar' ? 'ملخص العمليات' : 'Operations Summary'}
              </h3>
              <button onClick={() => setShowStats(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`rounded p-1.5 bg-background ${stat.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className={`flex items-center gap-0.5 text-[10px] font-medium ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
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
        </div>
      )}

      {/* Environmental Panel - Collapsible */}
      {showEnvironment && (
        <div className="absolute top-20 left-40 sm:left-44 z-20 w-64">
          <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">
                {locale === 'ar' ? 'الظروف البيئية' : 'Environment'}
              </h3>
              <button onClick={() => setShowEnvironment(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {environmentalData.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <div className={`rounded p-1 ${item.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className={`text-xs font-semibold ${item.status === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>
                      {item.value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Activity Panel - Collapsible */}
      {showActivity && (
        <div className="absolute top-36 left-40 sm:left-44 z-20 w-72 sm:w-80">
          <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">
                {locale === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
              </h3>
              <button onClick={() => setShowActivity(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-secondary/30 transition-colors">
                  <div className="h-1.5 w-1.5 mt-1.5 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{activity.action}</p>
                    <p className="text-[10px] text-muted-foreground">{activity.farm}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Welcome - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="px-3 py-2 rounded-lg bg-card/80 backdrop-blur-md border border-border">
          <p className="text-xs text-muted-foreground">
            {locale === 'ar' 
              ? `مرحبا بعودتك، ${user?.email?.split('@')[0] || 'مستخدم'}` 
              : `Welcome back, ${user?.email?.split('@')[0] || 'User'}`}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-500 font-medium">
              {locale === 'ar' ? 'متصل' : 'Online'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
