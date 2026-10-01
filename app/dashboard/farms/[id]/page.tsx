'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { MapPin, ArrowLeft } from 'lucide-react'
import { FarmIntelligencePanel } from '@/components/dashboard/farm-intelligence-panel'
import { navigateToFarm } from '@/lib/dashboard/operational-navigation'
import { useI18n } from '@/lib/i18n'
import { Card, Notice, PageHeader } from '@/components/brand/layout'
import { SegmentedToggle } from '@/components/brand/ui'
import { humanize } from '@/components/brand/status'

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
  const { tr } = useI18n()
  const [tab, setTab] = useState<FarmTab>('overview')

  const moduleLink = (module: string) => navigateToFarm(new URLSearchParams(), farmId, module, 14)

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6">
        <Link href="/dashboard/farms" className="inline-flex items-center gap-1.5 text-[13px] text-content-soft hover:text-content transition-colors mb-4">
          <ArrowLeft strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
          {tr('All farms')}
        </Link>
        <PageHeader
          eyebrow={tr('Farm')}
          title={tr('Farm workspace')}
          subtitle={<span className="font-mono text-[12px]">{farmId}</span>}
          className="!mb-5"
        />
        {/* Tabs are the brand's pill switch, never underlined tabs. */}
        <div className="mb-5 overflow-x-auto scrollbar-none">
          <SegmentedToggle
            size="sm"
            ariaLabel={tr('Farm sections')}
            value={tab}
            onChange={(v) => setTab(v as FarmTab)}
            options={TABS.map((t) => ({ value: t, label: tr(humanize(t)) }))}
          />
        </div>
        <div>
        {tab === 'overview' && <FarmIntelligencePanel farmId={farmId} />}

        {tab === 'production' && (
          <TabPanel title="Production" links={[
            { label: 'Harvest intelligence', href: moduleLink('harvest') },
            { label: 'Crop & production analytics', href: moduleLink('data-analytics') },
          ]} />
        )}
        {tab === 'satellite' && (
          <TabPanel title="Satellite & harvest" links={[{ label: 'Open harvest module', href: moduleLink('harvest') }]} />
        )}
        {tab === 'weather' && (
          <TabPanel title="Weather" links={[{ label: 'Weather intelligence', href: moduleLink('weather') }]} />
        )}
        {tab === 'water' && (
          <TabPanel title="Water" links={[{ label: 'Water intelligence', href: moduleLink('water-intelligence') }]} />
        )}
        {tab === 'energy' && (
          <TabPanel title="Energy" links={[{ label: 'Energy intelligence', href: moduleLink('energy-intelligence') }]} />
        )}
        {tab === 'monitoring' && (
          <UpcomingPanel title="Monitoring" note="Sensor and IoT monitoring integration upcoming." />
        )}
        {tab === 'alerts' && (
          <TabPanel title="Alerts" links={[{ label: 'Signals & alerts center', href: moduleLink('alerts-center') }]} />
        )}
        {tab === 'inspections' && (
          <UpcomingPanel title="Inspections" note="Inspection workflow connected to farm context — implementation in progress." />
        )}
        {tab === 'compliance' && (
          <UpcomingPanel title="Compliance" note="Compliance cases and corrective actions — upcoming." />
        )}
        {tab === 'data-quality' && (
          <TabPanel title="Data quality" links={[{ label: 'Platform data health', href: '/dashboard?module=data-health' }]} />
        )}
        </div>
      </div>
    </div>
  )
}

function TabPanel({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  const { tr } = useI18n()
  return (
    <Card icon={MapPin} title={tr(title)}>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="g-btn g-btn--outline" style={{ height: 32, padding: '0 14px', fontSize: 13 }}>
            {tr(link.label)} →
          </Link>
        ))}
      </div>
    </Card>
  )
}

function UpcomingPanel({ title, note }: { title: string; note: string }) {
  const { tr } = useI18n()
  return (
    <Notice tone="warning" title={tr(title)}>{tr(note)}</Notice>
  )
}
