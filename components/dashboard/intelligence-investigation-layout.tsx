'use client'

import type { LucideIcon } from 'lucide-react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CardHeader, PageHeader } from '@/components/brand/layout'
import { StatusDot } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

interface IntelligenceInvestigationLayoutProps {
  contextHeader?: ReactNode
  currentCondition?: ReactNode
  whatChanged?: ReactNode
  primaryAnalysis?: ReactNode
  mapOrTimeseries?: ReactNode
  affectedEntities?: ReactNode
  signals?: ReactNode
  forecast?: ReactNode
  aiAnalysis?: ReactNode
  actions?: ReactNode
  className?: string
  sectionScrollable?: boolean
  /** The primary analysis is the module's main work surface: full row, no inner scroll. */
  wideAnalysis?: boolean
}

export function IntelligenceInvestigationLayout({
  contextHeader,
  currentCondition,
  whatChanged,
  primaryAnalysis,
  mapOrTimeseries,
  affectedEntities,
  signals,
  forecast,
  aiAnalysis,
  actions,
  className,
  sectionScrollable = true,
  wideAnalysis = false,
}: IntelligenceInvestigationLayoutProps) {
  const { tr } = useI18n()
  const sections = [
    { key: 'context', label: tr('Context'), content: contextHeader },
    { key: 'condition', label: tr('Current condition'), content: currentCondition },
    { key: 'changed', label: tr('What changed'), content: whatChanged },
    { key: 'analysis', label: tr('Primary analysis'), content: primaryAnalysis },
    { key: 'map', label: tr('Map / timeseries'), content: mapOrTimeseries },
    { key: 'entities', label: tr('Affected entities'), content: affectedEntities },
    { key: 'signals', label: tr('Signals'), content: signals },
    { key: 'forecast', label: tr('Forecast'), content: forecast },
    { key: 'ai', label: tr('AI analysis'), content: aiAnalysis },
    { key: 'actions', label: tr('Available actions'), content: actions },
  ].filter((section) => section.content)

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2', className)}>
      {sections.map((section) =>
        /* The assistant is already an AI-family card: wrapped in a section it
           became a card inside a card, and the chat scrolled inside a 300px
           box. It now takes the full row, at a height a conversation needs. */
        section.key === 'ai' ? (
          <div key={section.key} className="flex min-h-[460px] flex-col lg:col-span-2 [&>*]:flex-1">
            {section.content}
          </div>
        ) : (
        <InvestigationSection
          key={section.key}
          title={section.label}
          scrollable={
            sectionScrollable &&
            section.key !== 'actions' &&
            section.key !== 'context' &&
            !(wideAnalysis && section.key === 'analysis')
          }
          className={
            section.key === 'actions' || section.key === 'context' || (wideAnalysis && section.key === 'analysis')
              ? 'lg:col-span-2'
              : undefined
          }
        >
          {section.content}
        </InvestigationSection>
        )
      )}
    </div>
  )
}

/* A section is a monitoring card: white, dotted header rule. `priority`
   no longer tints the whole card amber; it adds the status square. */
export function InvestigationSection({
  title,
  children,
  compact = false,
  priority = 'default',
  scrollable = true,
  className,
}: {
  title: string
  children: ReactNode
  compact?: boolean
  priority?: 'default' | 'high'
  scrollable?: boolean
  className?: string
}) {
  return (
    <section
      data-famiglia="monitoraggio"
      className={cn('growa flex min-h-0 flex-col bg-card border border-line overflow-hidden', className)}
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      <CardHeader
        title={title}
        actions={priority === 'high' ? <StatusDot tone="warning" size={7} /> : null}
      />
      <div
        className={cn(
          'g-card-corpo',
          compact ? 'p-3' : 'p-4',
          scrollable &&
            'min-h-[120px] max-h-[min(300px,36vh)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]'
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function InvestigationContextHeader({
  eyebrow,
  title,
  description,
  meta = [],
}: {
  eyebrow: string
  title: string
  description?: string
  icon?: LucideIcon
  meta?: Array<{ label: string; value: string; accent?: boolean }>
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={description}
      className="!mb-2"
      actions={
        meta.length > 0 ? (
          <dl className="flex flex-wrap gap-2">
            {meta.map((item) => (
              <div key={item.label} className="bg-card border border-line px-3 py-2 min-w-[96px]" style={{ borderRadius: 'var(--radius-lg)' }}>
                <dt className="flex items-center gap-1.5 text-[11px] text-content-soft">
                  {item.accent && <StatusDot tone="good" size={6} />}
                  {item.label}
                </dt>
                <dd className="mt-0.5 text-[14px] text-content" style={{ fontWeight: 500 }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null
      }
    />
  )
}

export function InvestigationActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

/* Commands are pills: primary ink, the others outline / secondary. */
export function InvestigationActionButton({
  children,
  onClick,
  variant = 'default',
  href,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost'
  href?: string
}) {
  const className = cn(
    'g-btn',
    variant === 'primary' ? 'g-btn--primary' : variant === 'ghost' ? 'g-btn--outline' : 'g-btn--secondary'
  )
  const style = { height: 32, padding: '0 14px', fontSize: 13 }

  if (href) {
    return (
      <DashboardQueryLink href={href} className={className}>
        <span className="inline-flex items-center gap-2" style={style}>{children}</span>
      </DashboardQueryLink>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      <span className="inline-flex items-center gap-2">{children}</span>
    </button>
  )
}
