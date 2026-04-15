'use client'

import { useMemo } from 'react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { HelpCircle, LifeBuoy, BookOpen, Ticket, Wrench, AlertTriangle } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'help-center': HelpCircle,
  help: HelpCircle,
  tickets: Ticket,
  'technical-issues': Wrench,
  'case-support': AlertTriangle,
  'knowledge-base': BookOpen,
  'contact-support': LifeBuoy,
}

export default function SupportPage() {
  const { menuItems, roleProfile } = useRoleNavigation()

  const supportModule = useMemo(
    () => menuItems.find((item) => item.key === 'support'),
    [menuItems]
  )

  const supportSections = supportModule?.submenu || []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {supportModule?.label || 'Support'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {supportModule?.defaultContent ||
              'Access help resources, support workflows, and role-specific assistance.'}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          {roleProfile ? roleProfile.replace(/_/g, ' ') : 'default profile'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {supportSections.map((section) => {
          const Icon = ICONS[section.key] || HelpCircle
          return (
            <div
              key={section.key}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-[#07f880]/30 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-[#07f880]" />
                <h3 className="font-semibold text-foreground">{section.label}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Role-aware support workspace section for {section.label.toLowerCase()}.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
