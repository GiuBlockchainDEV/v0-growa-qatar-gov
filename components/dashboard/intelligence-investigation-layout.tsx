'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
}: IntelligenceInvestigationLayoutProps) {
  const sections = [
    { key: 'context', label: 'Context', content: contextHeader },
    { key: 'condition', label: 'Current condition', content: currentCondition },
    { key: 'changed', label: 'What changed', content: whatChanged },
    { key: 'analysis', label: 'Primary analysis', content: primaryAnalysis },
    { key: 'map', label: 'Map / timeseries', content: mapOrTimeseries },
    { key: 'entities', label: 'Affected entities', content: affectedEntities },
    { key: 'signals', label: 'Signals', content: signals },
    { key: 'forecast', label: 'Forecast', content: forecast },
    { key: 'ai', label: 'AI analysis', content: aiAnalysis },
    { key: 'actions', label: 'Available actions', content: actions },
  ].filter((section) => section.content)

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}>
      {sections.map((section) => (
        <InvestigationSection
          key={section.key}
          title={section.label}
          scrollable={section.key !== 'actions' && section.key !== 'context'}
          className={section.key === 'actions' || section.key === 'context' ? 'lg:col-span-2' : undefined}
        >
          {section.content}
        </InvestigationSection>
      ))}
    </div>
  )
}

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
      className={cn(
        'flex min-h-0 flex-col rounded-xl border',
        priority === 'high'
          ? 'border-amber-500/25 bg-amber-500/[0.04]'
          : 'border-white/10 bg-[#0a0d12]/80',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <h2 className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-white/45">{title}</h2>
      <div
        className={cn(
          compact ? 'mt-2' : 'mt-3',
          scrollable &&
            'min-h-[120px] max-h-[min(260px,32vh)] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]'
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
  icon: Icon,
  meta = [],
}: {
  eyebrow: string
  title: string
  description?: string
  icon?: LucideIcon
  meta?: Array<{ label: string; value: string; accent?: boolean }>
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[10px] uppercase tracking-widest text-[#07f880]/80">{eyebrow}</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-white">
          {Icon ? <Icon className="h-5 w-5 text-[#07f880]" /> : null}
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-white/55">{description}</p> : null}
      </div>
      {meta.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[220px]">
          {meta.map((item) => (
            <div
              key={item.label}
              className={cn(
                'rounded-lg border px-3 py-2',
                item.accent ? 'border-[#07f880]/30 bg-[#07f880]/10 text-[#07f880]' : 'border-white/10 bg-white/[0.03] text-white/80'
              )}
            >
              <p className="text-[9px] uppercase tracking-wider opacity-70">{item.label}</p>
              <p className="mt-0.5 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function InvestigationActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

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
    'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
    variant === 'primary' && 'bg-[#07f880] text-black hover:bg-[#07f880]/90',
    variant === 'ghost' && 'border border-white/10 text-white/70 hover:text-white hover:border-white/20',
    variant === 'default' && 'bg-white/10 text-white hover:bg-white/15'
  )

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}
