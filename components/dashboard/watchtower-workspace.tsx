'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight, Bot, FlaskConical, Globe2, Network, Wheat } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { GlobalWatchtower } from '@/components/dashboard/watchtower/global-watchtower'
import { WatchtowerFoodCommandCenter } from '@/components/dashboard/watchtower/food-command-center'
import { WatchtowerScenarioRoom } from '@/components/dashboard/watchtower/scenario-room'
import { WatchtowerOperationsPulse } from '@/components/dashboard/watchtower/operations-pulse'
import { WatchtowerAgentOperationsRoom } from '@/components/dashboard/watchtower/agent-operations-room'
type Section = 'map' | 'food' | 'operations' | 'scenarios' | 'agents'
/** Map-first entry point. Existing workspaces and deep links are preserved. */
export function WatchtowerWorkspace() {
  const { locale } = useI18n()
  const tx = (en: string, arabic: string) => locale === 'ar' ? arabic : en
  const [activeSection, setActiveSection] = useState<Section>('map')
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash
      if (hash === '#watchtower-operations') setActiveSection('operations')
      else if (hash === '#watchtower-scenarios') setActiveSection('scenarios')
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
    { id: 'food' as const, label: tx('Food situation & risk', '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u063a\u0630\u0627\u0626\u064a \u0648\u0627\u0644\u0645\u062e\u0627\u0637\u0631'), icon: Wheat },
    { id: 'operations' as const, label: tx('Supply operations', '\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0625\u0645\u062f\u0627\u062f'), icon: Network },
    { id: 'scenarios' as const, label: tx('Scenario room', '\u063a\u0631\u0641\u0629 \u0627\u0644\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a'), icon: FlaskConical },
    { id: 'agents' as const, label: tx('Agent operations', '\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0648\u0643\u0644\u0627\u0621'), icon: Bot },
  ]
  return <main className="growa nfii-command-scope flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-content">
    <nav aria-label="Watchtower sections" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-700/60 bg-[#091522] px-3 py-1.5">
      {sections.map(section => <button key={section.id} type="button" aria-pressed={section.id === activeSection} onClick={() => selectSection(section.id)}
        className={'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-[11px] transition-colors ' + (section.id === activeSection ? 'bg-slate-700/70 text-cyan-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}><section.icon size={13} />{section.label}</button>)}
      <div className="ms-auto flex shrink-0 gap-1 ps-4">{[['/dashboard/procurement', 'Procurement'], ['/dashboard/logistics', 'Logistics'], ['/dashboard/reserves', 'Reserves'], ['/dashboard?module=commodities', 'Commodities']].map(([href, label]) =>
        <Link key={href} href={href} className="inline-flex items-center gap-1 px-2 py-2 text-[10px] text-slate-400 hover:text-cyan-200">{label}<ArrowUpRight size={11} /></Link>)}</div>
    </nav>
    {activeSection === 'map' ? <div className="min-h-0 flex-1"><GlobalWatchtower /></div> :
      <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1600px] space-y-4 p-4 pb-12 sm:p-6">
        {activeSection === 'food' && <WatchtowerFoodCommandCenter />}
        {activeSection === 'operations' && <WatchtowerOperationsPulse />}
        {activeSection === 'scenarios' && <WatchtowerScenarioRoom />}
        {activeSection === 'agents' && <WatchtowerAgentOperationsRoom />}
      </div></div>}
  </main>
}
