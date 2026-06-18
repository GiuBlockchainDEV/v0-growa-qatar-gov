'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface IntelligenceWorkspaceRootProps {
  children: ReactNode
}

export function IntelligenceWorkspaceRoot({ children }: IntelligenceWorkspaceRootProps) {
  return <div className="space-y-5 p-6 pt-20 text-foreground">{children}</div>
}

interface IntelligenceStatusItem {
  label: string
  value: string
  accent?: boolean
}

interface IntelligenceHeroProps {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  statusItems?: IntelligenceStatusItem[]
}

export function IntelligenceHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  statusItems = [],
}: IntelligenceHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_0_0_1px_rgba(7,248,128,0.08),0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(7,248,128,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(7,248,128,0.06),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground">
            <Icon className="h-7 w-7 text-primary" />
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {statusItems.length > 0 ? (
          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs sm:text-sm">
            {statusItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-lg border px-3 py-2 ${
                  item.accent
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-secondary/40 text-foreground'
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">{item.label}</p>
                <p className="mt-0.5 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface IntelligenceKpiCardProps {
  label: string
  value: string
  icon?: LucideIcon
  accent?: boolean
  tone?: 'default' | 'sky' | 'amber'
}

export function IntelligenceKpiCard({
  label,
  value,
  icon: Icon,
  accent = false,
  tone = 'default',
}: IntelligenceKpiCardProps) {
  const toneClass =
    tone === 'sky'
      ? 'text-sky-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : accent
          ? 'text-primary'
          : 'text-foreground'

  return (
    <div
      className={`rounded-xl border p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)] ${
        accent ? 'border-primary/30 bg-primary/10' : 'border-border bg-card/80'
      }`}
    >
      <p
        className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] ${
          accent ? 'text-primary/90' : 'text-muted-foreground'
        }`}
      >
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

interface IntelligencePanelProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning'
}

export function IntelligencePanel({
  title,
  subtitle,
  icon: Icon,
  children,
  className = '',
  variant = 'default',
}: IntelligencePanelProps) {
  const variantClass =
    variant === 'success'
      ? 'border-primary/30 bg-primary/10'
      : variant === 'warning'
        ? 'border-amber-400/30 bg-amber-500/10'
        : 'border-border bg-card'

  return (
    <section
      className={`rounded-xl border p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.05)] ${variantClass} ${className}`}
    >
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

interface IntelligenceCommandLayoutProps {
  main: ReactNode
  insights: ReactNode
  assistant: ReactNode
}

export function IntelligenceCommandLayout({ main, insights, assistant }: IntelligenceCommandLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.8fr)_minmax(280px,0.85fr)]">
      <div className="min-w-0">{main}</div>
      <div className="space-y-4">{insights}</div>
      <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">{assistant}</div>
    </div>
  )
}

export function IntelligenceLoadingState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function IntelligenceErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{message}</div>
  )
}

interface IntelligenceProducerCardProps {
  rank: number
  name: string
  lines: string[]
  onClick?: () => void
  variant?: 'default' | 'success' | 'warning'
}

export function IntelligenceProducerCard({
  rank,
  name,
  lines,
  onClick,
  variant = 'default',
}: IntelligenceProducerCardProps) {
  const variantClass =
    variant === 'success'
      ? 'border-primary/30 bg-card/70 hover:bg-primary/10'
      : variant === 'warning'
        ? 'border-amber-400/30 bg-card/70 hover:bg-amber-500/10'
        : 'border-border bg-card/70 hover:bg-white/5'

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${variantClass} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <p className="text-sm font-medium text-foreground">
        #{rank} {name}
      </p>
      {lines.map((line, lineIndex) => (
        <p key={`${rank}-${lineIndex}`} className="mt-1 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </Tag>
  )
}

export function IntelligenceDataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-left">{children}</table>
    </div>
  )
}

export function IntelligenceTableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-secondary/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">{children}</thead>
}

export function IntelligenceTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border/70">{children}</tbody>
}
