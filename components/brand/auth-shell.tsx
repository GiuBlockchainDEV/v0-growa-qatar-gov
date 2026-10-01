'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import type { ReactNode } from 'react'
import { Logo } from './logo'
import { Eyebrow, Lattice } from './ui'

/**
 * Frame for the access screens (sign in, request access, confirmations).
 * Same composition as the Growa SaaS `AuthShell`, so the two products'
 * front doors look like one company.
 *
 * COMPOSITION comes from the brand rules: the system allows three
 * background treatments — flat white, rounded ink panels held away from
 * the edge so the white frames them, and full-bleed photography. All three
 * are here: white page, ink panel, photograph inside the panel.
 *
 * Cream is the brand's voice ON DARK, not a colour for white; giving it the
 * dark soil under an ink veil makes contrast a property of the system
 * rather than something to fix. Text over the photo is protected as the
 * brand prescribes — a flat veil (`--protect-full`) plus a bottom gradient
 * (`--protect-bottom`) under the long text: the only gradients allowed.
 *
 * Without the image the panel stays solid ink and everything still reads.
 */
export function AuthShell({
  children,
  claim = 'Grow Beyond Average.',
  intro = 'Agricultural operations platform for Qatar: real-time monitoring and analysis of the nation’s farms, water and supply.',
  image = '/brand/auth-soil.jpg',
}: {
  children: ReactNode
  claim?: string
  intro?: string
  image?: string | null
}) {
  const { tr } = useI18n()
  return (
    <div className="growa min-h-screen bg-page flex flex-col lg:flex-row">
      {/* `p-3` is the white framing the brand requires: the panel never
          touches the page edge. */}
      <aside className="lg:w-[46%] lg:max-w-[720px] p-3 lg:p-4">
        <div
          className="growa-inverse relative h-full overflow-hidden bg-page
                     min-h-[220px] lg:min-h-[560px]
                     px-7 py-8 lg:px-12 lg:py-11 flex flex-col justify-between gap-10"
          style={{
            borderRadius: 'var(--radius-2xl)',
            backgroundImage: image ? `url(${image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <span aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--protect-full)' }} />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--protect-bottom)' }} />
          {/* The lattice starts BELOW the mark: the clear space (p.21) must
              stay "free from text, graphics, and photographic elements". */}
          <Lattice color="rgba(238,244,201,.20)" step={34} size={3} style={{ top: '30%' }} />

          {/* Bare mark — no tile, no pill (p.22, forbidden use no. 6). */}
          <Link href="/" className="relative inline-block w-fit" aria-label={tr('Growa — home')}>
            <Logo className="h-6 lg:h-7 w-auto text-cream" />
          </Link>

          <div className="relative">
            <Eyebrow brackets className="!text-cream/75">
              {tr('Agricultural intelligence')}
            </Eyebrow>
            {/* Display lines are LIGHT, never bold. */}
            <p className="growa-figure text-cream mt-5" style={{ fontSize: 'var(--text-display-3)' }}>
              {claim}
            </p>
            <p className="mt-5 text-[16px] leading-[1.45] text-cream/80 max-w-[46ch]">{tr(intro)}</p>
          </div>

          {/* A short label over a photograph goes in a capsule (glass). */}
          <span
            className="relative w-fit px-3 py-1 text-[12px] text-cream rounded-pill"
            style={{
              background: 'rgba(255,255,255,.10)',
              border: '1px solid rgba(238,244,201,.28)',
              backdropFilter: 'var(--glass-blur)',
            }}
          >
            {tr('Doha, Qatar')}
          </span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-16">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <footer className="px-6 pb-8">
          <div className="max-w-[400px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-content-soft">
            <span>{tr('Ministry of Municipality · State of Qatar')}</span>
            <span>© {new Date().getFullYear()} Growa</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
