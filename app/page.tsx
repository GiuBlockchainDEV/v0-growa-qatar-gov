'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { Logo } from '@/components/brand/logo'
import { DottedDivider, Lattice, SectionTitle, StatusDot } from '@/components/brand/ui'

/*
 * Landing — built on the brand's website page (Brand Book p.72): a hero of
 * full-bleed photography inside an ink frame held off the page edge, the
 * cream mark bare on it, a glass pill for navigation with the active voice
 * in cream. Below, white and calm: generous negative space (p.46), section
 * titles marked by the square, dotted rules between columns.
 *
 * The photograph is the one the SaaS access screens use. The brand's
 * register is WIDE AERIAL farmland (p.72, p.81); a proper aerial of Qatari
 * farms should replace it when available — only `HERO_IMAGE` changes.
 */
const HERO_IMAGE = '/brand/auth-soil.jpg'

const FEATURES = [
  { title: 'Agricultural operations', description: 'Manage farms, crops and production cycles.' },
  { title: 'Real-time data', description: 'Monitor environmental conditions and inventory.' },
  { title: 'Sovereign security', description: 'Enterprise-grade data protection and row-level access.' },
  { title: 'Bilingual', description: 'Full Arabic and English interface, mirrored layout.' },
]

export default function Home() {
  const { user, loading } = useAuth()
  const { tr } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  return (
    <main className="growa min-h-screen bg-page">
      {/* Hero — white framing, ink panel, photograph inside. */}
      <section className="p-3 lg:p-4">
        <div
          className="growa-inverse relative overflow-hidden bg-page min-h-[88vh] flex flex-col"
          style={{
            borderRadius: 'var(--radius-2xl)',
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <span aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--protect-full)' }} />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--protect-bottom)' }} />
          <Lattice color="rgba(238,244,201,.18)" step={34} size={3} style={{ top: '62%' }} />

          {/* Glass pill navigation, active voice in cream (p.72). */}
          <nav
            aria-label={tr('Platform access')}
            className="relative mx-auto mt-6 flex items-center gap-1 p-1 rounded-pill"
            style={{
              background: 'rgba(255,255,255,.10)',
              border: '1px solid rgba(238,244,201,.28)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            <Link
              href="/auth/login"
              className="inline-flex items-center h-9 px-5 rounded-pill bg-cream text-ink text-[14px] font-medium hover:bg-cream-300 transition-colors"
            >
              {tr('Access platform')}
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center h-9 px-5 rounded-pill text-cream text-[14px] hover:bg-white/10 transition-colors"
            >
              {tr('Request access')}
            </Link>
          </nav>

          {/* The mark, centred and bare. Its clear space is far exceeded by
              the empty field around it. */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
            <h1 className="sr-only">Growa Qatar</h1>
            <Logo className="w-[min(72vw,560px)] h-auto text-cream" title="Growa" />
            <p className="mt-10 text-[18px] leading-[1.45] text-cream/85 max-w-[40ch]">
              {tr(
                'Agricultural operations platform for Qatar. Real-time monitoring, analysis and management of the nation’s agricultural resources.'
              )}
            </p>
          </div>

          <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 lg:px-10 pb-7">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 text-[12px] text-cream rounded-pill"
              style={{
                background: 'rgba(255,255,255,.10)',
                border: '1px solid rgba(238,244,201,.28)',
                backdropFilter: 'var(--glass-blur)',
              }}
            >
              <StatusDot tone="var(--growa-sage-300)" size={6} pulse />
              {tr('System operational')}
            </span>
            <span className="text-[12px] text-cream/70">{tr('Doha, Qatar')}</span>
          </div>
        </div>
      </section>

      {/* Features — negative space, square-marked titles, dotted rules. */}
      <section className="mx-auto max-w-[1200px] px-6 lg:px-10 py-20 lg:py-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <SectionTitle as="h2">{tr(feature.title)}</SectionTitle>
              <DottedDivider className="my-4" />
              <p className="text-[14px] leading-[1.45] text-content-soft">{tr(feature.description)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-[1200px] px-6 lg:px-10 pb-10">
        <DottedDivider className="mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-content-soft">
          <span>{tr('Growa Qatar v0.1.0 · Sovereign platform')}</span>
          <span>{tr('Ministry of Municipality · State of Qatar')}</span>
        </div>
      </footer>
    </main>
  )
}
