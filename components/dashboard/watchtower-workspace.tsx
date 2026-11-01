'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowUpRight, Bot, Building2, FlaskConical, Network, ShieldCheck, Wheat,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { WatchtowerFoodCommandCenter } from '@/components/dashboard/watchtower/food-command-center'
import { WatchtowerScenarioRoom } from '@/components/dashboard/watchtower/scenario-room'
import { WatchtowerOperationsPulse } from '@/components/dashboard/watchtower/operations-pulse'
import { WatchtowerAgentOperationsRoom } from '@/components/dashboard/watchtower/agent-operations-room'
import { PageHeader } from '@/components/brand/layout'

/**
 * NFII 2.0 Food Resilience Operating Picture.
 *
 * Information architecture is informed by the user's ICPS reference:
 * situation awareness -> purchasing triage -> supply network -> simulation.
 * All actual operational numbers remain sourced from reviewed organization data.
 * Missing external feeds are labelled not integrated, not assigned mock values.
 */
export function WatchtowerWorkspace() {
  const { locale } = useI18n()
  const { organization } = useOrganization()
  const ar = locale === 'ar'
  const tx = (english: string, arabic: string) => ar ? arabic : english

  type Section = 'food' | 'operations' | 'scenarios' | 'agents'
  const [activeSection, setActiveSection] = useState<Section>('food')
  useEffect(() => {
    function syncSectionFromHash() {
      const hash = window.location.hash
      if (hash === '#watchtower-operations') setActiveSection('operations')
      else if (hash === '#watchtower-scenarios') setActiveSection('scenarios')
      else if (hash === '#watchtower-agents') setActiveSection('agents')
      else if (hash === '#watchtower-response' || hash === '#watchtower-food')
        setActiveSection('food')
    }
    syncSectionFromHash()
    window.addEventListener('hashchange', syncSectionFromHash)
    return () => window.removeEventListener('hashchange', syncSectionFromHash)
  }, [])

  function selectSection(section: Section) {
    setActiveSection(section)
    const hash = section === 'food' ? '#watchtower-food'
      : section === 'operations' ? '#watchtower-operations'
      : section === 'agents' ? '#watchtower-agents' : '#watchtower-scenarios'
    window.history.replaceState(null, '', hash)
  }

  const sections = [
    { id: 'food' as const, name: tx('Food situation & risk', 'الوضع الغذائي والمخاطر'), icon: Wheat },
    { id: 'operations' as const, name: tx('Supply operations', 'عمليات الإمداد'), icon: Network },
    { id: 'scenarios' as const, name: tx('Scenario room', 'غرفة السيناريوهات'), icon: FlaskConical },
    { id: 'agents' as const, name: tx('Agent operations', 'عمليات الوكلاء'), icon: Bot },
  ] as const

  return (
    <main className="growa nfii-command-scope h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 pb-12 sm:p-6">
        <header className="space-y-3">
          <PageHeader
            eyebrow={tx('Food security intelligence', 'معلومات الأمن الغذائي')}
            title={tx('Food Security Watchtower', 'برج مراقبة الأمن الغذائي')}
            subtitle={tx(
              'Explore food balance, supply operations, scenarios and a read-only specialist-agent rehearsal. Verified and illustrative inputs remain clearly separated.',
              'استكشف الميزان الغذائي وعمليات الإمداد والسيناريوهات ومحاكاة الوكلاء المتخصصين. تُفصل المدخلات الموثقة عن التوضيحية بوضوح.'
            )}
            actions={
              <div className="flex flex-col items-start gap-1 text-[12px] md:items-end">
                <span className="inline-flex items-center gap-2 font-medium text-content">
                  <Building2 className="h-4 w-4 text-sage-700" aria-hidden="true" />
                  {organization?.name ?? tx('No organization selected', 'لم تُحدد المؤسسة')}
                </span>
                <span className="text-[11px] text-content-soft">
                  {tx('Organization data · Not national totals', 'بيانات المؤسسة · ليست إجماليات وطنية')}
                </span>
              </div>
            }
            className="!mb-1"
          />
          <nav aria-label={tx('Food security sections', 'أقسام الأمن الغذائي')}
            className="nfii-panel flex flex-wrap items-center gap-2 px-3 py-3">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  type="button"
                  data-active={activeSection === section.id}
                  aria-pressed={activeSection === section.id}
                  onClick={() => selectSection(section.id)}
                  className="nfii-rail-link inline-flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
                  {section.name}
                </button>
              )
            })}
            <span aria-hidden="true" className="mx-1 hidden h-5 border-s border-line lg:inline-block" />
            {[
              {href:'/dashboard/procurement',label:tx('Procurement','المشتريات')},
              {href:'/dashboard/logistics',label:tx('Logistics','الخدمات اللوجستية')},
              {href:'/dashboard/reserves',label:tx('Reserves','الاحتياطيات')},
            ].map(item=>(
              <Link key={item.href} href={item.href}
                className="nfii-rail-link inline-flex items-center gap-1.5">
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true"/>
              </Link>
            ))}
            <Link href="/dashboard?module=commodities"
              className="ms-auto inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-sage-700 hover:underline">
              {tx('Commodity intelligence', 'تحليل السلع')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true"/>
            </Link>
          </nav>
        </header>

        {activeSection === 'food' && <WatchtowerFoodCommandCenter />}
        {activeSection === 'operations' && <WatchtowerOperationsPulse />}
        {activeSection === 'scenarios' && <WatchtowerScenarioRoom />}
        {activeSection === 'agents' && <WatchtowerAgentOperationsRoom />}

        <footer className="flex flex-wrap items-start gap-2 border-t border-dotted border-line pt-3 text-[11px] text-content-soft">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p className="max-w-[115ch]">
            {tx(
              'Decision support only. Source review is not certification by Qatar authorities. Procurement, ports, warehouses and agency-level network feeds must be connected and authorized before they can inform operational execution. Simulation does not change live records.',
              'لدعم القرار فقط. مراجعة المصدر ليست اعتماداً من الجهات القطرية. يجب ربط مصادر المشتريات والموانئ والمستودعات والجهات المعنية والتحقق من صلاحياتها قبل أي تنفيذ. لا تغير المحاكاة السجلات الفعلية.'
            )}
          </p>
        </footer>
      </div>
    </main>
  )
}
