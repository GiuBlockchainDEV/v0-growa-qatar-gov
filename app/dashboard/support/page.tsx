'use client'

import { useI18n } from '@/lib/i18n'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { HelpCircle, LifeBuoy, BookOpen, Ticket, Wrench, AlertTriangle } from 'lucide-react'
import { Card, Notice, PageBody, PageHeader } from '@/components/brand/layout'
import { Tag } from '@/components/brand/ui'

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  'help-center': HelpCircle,
  help: HelpCircle,
  tickets: Ticket,
  'technical-issues': Wrench,
  'case-support': AlertTriangle,
  'knowledge-base': BookOpen,
  'contact-support': LifeBuoy,
}

const DEFAULT_SUPPORT_SECTIONS = [
  { key: 'help-center', label: 'Help center' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'knowledge-base', label: 'Knowledge base' },
  { key: 'contact-support', label: 'Contact support' },
]

export default function SupportPage() {
  const { tr } = useI18n()
  const { roleProfile } = useSharedRoleNavigation()
  const supportSections = DEFAULT_SUPPORT_SECTIONS

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Platform')}
          title={tr('Support')}
          subtitle={tr('Access help resources, support workflows and role-specific assistance.')}
          actions={<Tag variant="outline-ink">{roleProfile ? roleProfile.replace(/_/g, ' ') : tr('Default profile')}</Tag>}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {supportSections.map((section) => (
            <Card key={section.key} icon={ICONS[section.key] || HelpCircle} title={tr(section.label)}>
              <p className="text-[14px] text-content-soft leading-[1.45]">
                {tr('Role-aware support workspace section for {section}.', { section: tr(section.label).toLowerCase() })}
              </p>
            </Card>
          ))}
        </div>

        <Notice tone="info" title={tr('How this support workspace works')} className="mt-4">
          {tr(
            'Each section opens role-aware support flows. If your organisation does not yet have dedicated support workflows configured, these default sections are shown to keep Support operational.'
          )}
        </Notice>
      </PageBody>
    </div>
  )
}
