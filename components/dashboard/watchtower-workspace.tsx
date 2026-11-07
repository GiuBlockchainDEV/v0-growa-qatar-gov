'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight, Bot, Globe2, Network, Wheat, ChartCandlestick } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { GlobalWatchtower } from '@/components/dashboard/watchtower/global-watchtower'
import { CommodityMarkets } from '@/components/dashboard/watchtower/commodity-markets'
import { WatchtowerFoodCommandCenter } from '@/components/dashboard/watchtower/food-command-center'
import { WatchtowerOperationsPulse } from '@/components/dashboard/watchtower/operations-pulse'
import { WatchtowerAgentOperationsRoom } from '@/components/dashboard/watchtower/agent-operations-room'
type Section = 'map' | 'markets' | 'food' | 'operations' | 'agents'
/** Map-first entry point. Existing workspaces and deep links are preserved. */
export function WatchtowerWorkspace() {
  const { locale } = useI18n()
  const tx = (en: string, arabic: string) => locale === 'ar' ? arabic : en
  const [activeSection, setActiveSection] = useState<Section>('map')
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash
      if (hash === '#watchtower-markets') setActiveSection('markets')
      else if (hash === '#watchtower-operations') setActiveSection('operations')
      else if (hash === '#watchtower-scenarios') setActiveSection('agents') // Retired deep link
      else if (hash === '#watchtower-agents') setActiveSection('agents')
      else if (hash === '#watchtower-response' || hash === '#watchtower-food') setActiveSection('food')
      else setActiveSection('map')
    }
    sync(); window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  function selectSection(section: Section) {
    setActiveSection(section)
    window.history.replaceState(window.history.state, '', '#watchtower-' + section)
  }
  const sections = [
    { id: 'map' as const, label: tx('Global map', '\u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629'), icon: Globe2 },
    { id: 'markets' as const, label: tx('Commodity markets', '\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0633\u0644\u0639'), icon: ChartCandlestick },
    { id: 'food' as const, label: tx('Food situation & risk', '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u063a\u0630\u0627\u0626\u064a \u0648\u0627\u0644\u0645\u062e\u0627\u0637\u0631'), icon: Wheat },
    { id: 'operations' as const, label: tx('Supply operations', '\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0625\u0645\u062f\u0627\u062f'), icon: Network },
    { id: 'agents' as const, label: tx('Agent operations', '\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0648\u0643\u0644\u0627\u0621'), icon: Bot },
  ]
  return <main className="growa nfii-command-scope flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-content">
    <nav aria-label="Watchtower mobile sections" className="flex shrink-0 items-center gap-2 border-b border-line bg-card px-2 py-2 lg:hidden">
      <select aria-label="Watchtower section" value={activeSection}
        onChange={event=>selectSection(event.target.value as Section)}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm font-medium text-content">
        {sections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}
      </select>
      <Link href="/dashboard/procurement" className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-semibold text-sage-700">Suppliers</Link>
      <Link href="/dashboard/logistics" className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-xs font-semibold text-sage-700">Routes</Link>
    </nav>
    <nav aria-label="Watchtower sections" className="hidden shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-card px-3 py-2 lg:flex">
      {sections.map(section => <button key={section.id} type="button" aria-pressed={section.id === activeSection} onClick={() => selectSection(section.id)}
        className={'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors ' + (section.id === activeSection ? 'border-line-accent bg-cream-100 text-sage-700' : 'border-transparent text-content-soft hover:bg-muted hover:text-content')}><section.icon size={13} />{section.label}</button>)}
      <div className="ms-auto flex shrink-0 gap-1 ps-4">{[['/dashboard/procurement', 'Procurement'], ['/dashboard/logistics', 'Logistics'], ['/dashboard?module=commodities', 'Commodities']].map(([href, label]) =>
        <Link key={href} href={href} className="inline-flex items-center gap-1 rounded-pill px-3 py-2 text-[11px] text-content-soft transition-colors hover:bg-cream-100 hover:text-sage-700">{label}<ArrowUpRight size={11} /></Link>)}</div>
    </nav>
    {activeSection === 'map' ? <div className="min-h-0 flex-1"><GlobalWatchtower /></div> :
      <div data-watchtower-flow-scroll className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1600px] space-y-4 p-4 pb-12 sm:p-6">
        {activeSection === 'markets' && <CommodityMarkets />}
        {activeSection === 'food' && <WatchtowerFoodCommandCenter />}
        {activeSection === 'operations' && <WatchtowerOperationsPulse />}
        {activeSection === 'agents' && <WatchtowerAgentOperationsRoom />}
      </div></div>}
  </main>
}
