'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MapPin, ArrowLeft } from 'lucide-react'
import { FarmIntelligencePanel } from '@/components/dashboard/farm-intelligence-panel'
import { navigateToFarm } from '@/lib/dashboard/operational-navigation'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const TABS = [
  'overview',
  'production',
  'satellite',
  'weather',
  'water',
  'energy',
  'monitoring',
  'alerts',
  'inspections',
  'compliance',
  'data-quality',
] as const

type FarmTab = (typeof TABS)[number]

export default function FarmWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: farmId } = use(params)
  const { locale } = useI18n()
  const [tab, setTab] = useState<FarmTab>('overview')

  const moduleLink = (module: string) => navigateToFarm(new URLSearchParams(), farmId, module, 14)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <Link href="/dashboard/farms" className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-[#07f880] mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          {locale === 'ar' ? 'جميع المزارع' : 'All farms'}
        </Link>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#07f880]" />
          <h1 className="text-lg font-semibold">{locale === 'ar' ? 'مساحة عمل المزرعة' : 'Farm Workspace'}</h1>
        </div>
        <p className="text-[10px] text-white/35 mt-1 font-mono">{farmId}</p>

        <div className="mt-4 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide',
                tab === t ? 'bg-[#07f880] text-black' : 'text-white/45 hover:text-white/75 border border-white/10'
              )}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview' && <FarmIntelligencePanel farmId={farmId} />}

        {tab === 'production' && (
          <TabPanel title="Production" links={[
            { label: 'Harvest Intelligence', href: moduleLink('harvest') },
            { label: 'Crop & Production Analytics', href: moduleLink('data-analytics') },
          ]} />
        )}
        {tab === 'satellite' && (
          <TabPanel title="Satellite & Harvest" links={[{ label: 'Open Harvest Module', href: moduleLink('harvest') }]} />
        )}
        {tab === 'weather' && (
          <TabPanel title="Weather" links={[{ label: 'Weather Intelligence', href: moduleLink('weather') }]} />
        )}
        {tab === 'water' && (
          <TabPanel title="Water" links={[{ label: 'Water Intelligence', href: moduleLink('water-intelligence') }]} />
        )}
        {tab === 'energy' && (
          <TabPanel title="Energy" links={[{ label: 'Energy Intelligence', href: moduleLink('energy-intelligence') }]} />
        )}
        {tab === 'monitoring' && (
          <UpcomingPanel title="Monitoring" note="Sensor and IoT monitoring integration upcoming." />
        )}
        {tab === 'alerts' && (
          <TabPanel title="Alerts" links={[{ label: 'Signals & Alerts Center', href: moduleLink('alerts-center') }]} />
        )}
        {tab === 'inspections' && (
          <UpcomingPanel title="Inspections" note="Inspection workflow connected to farm context — implementation in progress." />
        )}
        {tab === 'compliance' && (
          <UpcomingPanel title="Compliance" note="Compliance cases and corrective actions — upcoming." />
        )}
        {tab === 'data-quality' && (
          <TabPanel title="Data Quality" links={[{ label: 'Platform Data Health', href: '/dashboard?module=data-health' }]} />
        )}
      </div>
    </div>
  )
}

function TabPanel({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-4">
      <h2 className="text-sm font-medium text-white mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded border border-[#07f880]/25 bg-[#07f880]/10 px-3 py-1.5 text-xs text-[#07f880] hover:bg-[#07f880]/20">
            {link.label} →
          </Link>
        ))}
      </div>
    </div>
  )
}

function UpcomingPanel({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
      <h2 className="text-sm font-medium text-amber-200">{title}</h2>
      <p className="mt-2 text-xs text-amber-100/70">{note}</p>
    </div>
  )
}
