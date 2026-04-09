'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { Sprout, Shield, Database, Globe, ArrowRight, Activity } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const features = [
    { icon: Sprout, title: 'Agricultural Operations', description: 'Manage farms, crops, and production cycles' },
    { icon: Database, title: 'Real-time Data', description: 'Monitor environmental conditions and inventory' },
    { icon: Shield, title: 'Sovereign Security', description: 'Enterprise-grade data protection and RLS' },
    { icon: Globe, title: 'Bilingual Support', description: 'Full Arabic and English interface support' },
  ]

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 data-grid opacity-30" />
      
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16">
        {/* Status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
          <Activity className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-medium text-green-500">System Operational</span>
        </div>

        {/* Main content */}
        <div className="text-center space-y-6 max-w-3xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
              <Sprout className="h-7 w-7 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl glow-primary opacity-50" />
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-foreground tracking-tight">
            GROWA <span className="text-primary">QATAR</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Sovereign Agricultural Operations Platform for Qatar. 
            Real-time monitoring, analytics, and management of agricultural resources.
          </p>

          {/* CTA Buttons */}
          <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/login"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all glow-primary"
            >
              Access Platform
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center justify-center rounded-lg border border-border px-8 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary hover:border-primary/30 transition-all"
            >
              Request Access
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group rounded-lg border border-border bg-card/50 backdrop-blur-sm p-5 hover:border-primary/30 hover:bg-card transition-all"
              >
                <div className="rounded-lg p-2.5 bg-primary/10 text-primary w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-muted-foreground">
            Growa Qatar v0.1.0 - Sovereign Platform
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Ministry of Municipality - State of Qatar
          </p>
        </div>
      </div>
    </main>
  )
}
