'use client'

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
  ArrowRight,
  Droplets,
  Thermometer,
  Wind,
  Sun
} from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { locale } = useI18n()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {locale === 'ar' ? 'نظرة عامة على العمليات' : 'Operations Overview'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === 'ar' 
              ? `مرحبا بعودتك، ${user?.email?.split('@')[0] || 'مستخدم'}` 
              : `Welcome back, ${user?.email?.split('@')[0] || 'User'}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>{locale === 'ar' ? 'آخر تحديث: الآن' : 'Last updated: Just now'}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="group relative rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">
                    {stat.value}
                  </p>
                  <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{stat.change} {locale === 'ar' ? 'هذا الشهر' : 'this month'}</span>
                  </div>
                </div>
                <div className={`rounded-lg p-2.5 bg-secondary ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Satellite Map - Central Feature */}
      <div className="h-[450px] lg:h-[500px]">
        <SatelliteMap locale={locale} />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Environmental Conditions */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">
              {locale === 'ar' ? 'الظروف البيئية' : 'Environmental Conditions'}
            </h2>
            <span className="text-xs text-muted-foreground">Qatar</span>
          </div>
          <div className="p-5 space-y-4">
            {environmentalData.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${item.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={`text-sm font-semibold ${item.status === 'warning' ? 'text-amber-400' : 'text-foreground'}`}>
                    {item.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">
              {locale === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
            </h2>
            <button className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
              {locale === 'ar' ? 'عرض الكل' : 'View All'}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {[
                { time: '2 min ago', action: 'Irrigation system activated', farm: 'Al Khor Farm', type: 'system' },
                { time: '15 min ago', action: 'Harvest recorded', farm: 'Date Palm Grove A', type: 'harvest' },
                { time: '1 hour ago', action: 'New cycle started', farm: 'Greenhouse Complex', type: 'cycle' },
                { time: '3 hours ago', action: 'Inventory restocked', farm: 'Central Warehouse', type: 'inventory' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.farm}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">
              {locale === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {locale === 'ar' ? 'إدارة العمليات الزراعية الخاصة بك' : 'Manage your agricultural operations'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: locale === 'ar' ? 'إضافة مزرعة' : 'Add Farm', href: '/dashboard/farms' },
              { label: locale === 'ar' ? 'دورة جديدة' : 'New Cycle', href: '/dashboard/cycles' },
              { label: locale === 'ar' ? 'تحديث المخزون' : 'Update Inventory', href: '/dashboard/inventory' },
            ].map((action) => (
              <button
                key={action.label}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all text-foreground"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
