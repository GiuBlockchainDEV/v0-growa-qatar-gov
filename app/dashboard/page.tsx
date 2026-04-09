'use client'

import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { Loader } from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t('app.name')}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t('app.tagline')}
        </p>
      </div>

      {/* Welcome Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-foreground">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
          </h2>
          <p className="text-sm text-muted-foreground">
            You are successfully connected to the Growa Qatar agricultural operations platform.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {['Farms', 'Active Cycles', 'Inventory Items', 'Recent Activities'].map((stat) => (
          <div
            key={stat}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {stat}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">0</p>
          </div>
        ))}
      </div>

      {/* Coming Soon */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          More features coming soon...
        </p>
      </div>
    </div>
  )
}
