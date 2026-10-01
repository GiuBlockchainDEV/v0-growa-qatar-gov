'use client'

import type { LucideIcon } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { CardHeader, ErrorState, LoadingState, PageHeader } from '@/components/brand/layout'
import { StatusDot } from '@/components/brand/ui'
import { cn } from '@/lib/utils'

interface IntelligenceWorkspaceRootProps {
  children: ReactNode
  layout?: 'scroll' | 'viewport'
}

export const IntelligenceWorkspaceRoot = forwardRef<HTMLDivElement, IntelligenceWorkspaceRootProps>(
  function IntelligenceWorkspaceRoot({ children, layout = 'scroll' }, ref) {
    if (layout === 'viewport') {
      return (
        <div
          ref={ref}
          className="growa flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-background p-6 text-content"
        >
          {children}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className="growa h-full overflow-y-auto overscroll-contain space-y-4 bg-background p-6 text-content"
      >
        {children}
      </div>
    )
  }
)

/* Header and body scroll together with the page, as on every other screen
   (weather, watchtower, the SaaS). They used to be two scroll areas: the
   header stayed pinned with its own capped scroll and only the body moved. */
export function IntelligenceWorkspaceHeader({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

interface IntelligenceWorkspaceBodyProps {
  children: ReactNode
  scrollable?: boolean
}

// `scrollable` is kept for compatibility: the page scrolls, never the body.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function IntelligenceWorkspaceBody({ children, scrollable }: IntelligenceWorkspaceBodyProps) {
  return <div className="flex min-w-0 flex-col">{children}</div>
}

interface IntelligenceWorkspaceCommandProps {
  children: ReactNode
  variant?: 'viewport' | 'stacked'
}

export function IntelligenceWorkspaceCommand({
  children,
  variant = 'viewport',
}: IntelligenceWorkspaceCommandProps) {
  return (
    <div
      className={
        variant === 'viewport'
          ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
          : 'flex min-w-0 flex-col gap-3'
      }
    >
      {children}
    </div>
  )
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

/* The module header in the SaaS page grammar: bracketed micro-label,
   Light title with the square, subtitle; the status items become
   label / value pairs on the end side, each with its square. */
export function IntelligenceHero({
  eyebrow,
  title,
  description,
  statusItems = [],
}: IntelligenceHeroProps) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      subtitle={description}
      className="!mb-2"
      actions={
        statusItems.length > 0 ? (
          <dl className="flex flex-wrap items-stretch gap-2">
            {statusItems.map((item) => (
              <div
                key={item.label}
                className="bg-card border border-line px-3 py-2 min-w-[96px]"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
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

interface IntelligenceKpiCardProps {
  label: string
  value: string
  icon?: LucideIcon
  accent?: boolean
  tone?: 'default' | 'sky' | 'amber'
}

/* KPI tile: white, one-pixel line, the figure LIGHT. `accent` and `tone`
   no longer tint the whole tile: they put the status square by the label. */
export function IntelligenceKpiCard({
  label,
  value,
  icon: Icon,
  accent = false,
  tone = 'default',
}: IntelligenceKpiCardProps) {
  const dot = tone === 'amber' ? 'warning' : accent ? 'good' : null
  const [number, ...unit] = String(value).split(' ')
  return (
    <div className="bg-card border border-line p-4" style={{ borderRadius: 'var(--radius-xl)' }}>
      <p className="flex items-center gap-1.5 text-[12px] text-content-soft">
        {dot ? <StatusDot tone={dot} size={6} /> : Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> : null}
        {label}
      </p>
      <p className="growa-figure mt-2 text-content" style={{ fontSize: 'clamp(20px, 1.8vw, 28px)', overflowWrap: 'anywhere' }}>
        {number}
        {unit.length > 0 && (
          <span className="ms-1 text-[12px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>{unit.join(' ')}</span>
        )}
      </p>
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
  fillHeight?: boolean
  scrollable?: boolean
}

/* A card of the monitoring family. `variant` used to tint the whole
   panel green or amber; now the frame stays white (the state never changes
   the frame) and the variant becomes the status square in the header. */
export function IntelligencePanel({
  title,
  subtitle,
  icon,
  children,
  className = '',
  variant = 'default',
  fillHeight = false,
  scrollable = false,
}: IntelligencePanelProps) {
  const useFlexLayout = fillHeight || scrollable
  return (
    <section
      data-famiglia="monitoraggio"
      className={cn('growa bg-card border border-line overflow-hidden', useFlexLayout && 'flex min-h-0 flex-col', className)}
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      <CardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={
          variant === 'default' ? null : (
            <StatusDot tone={variant === 'success' ? 'good' : 'warning'} size={7} />
          )
        }
      />
      <div className={cn('g-card-corpo p-4', useFlexLayout && 'flex min-h-0 flex-1 flex-col')}>
        {fillHeight ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : scrollable ? (
          <div className="min-h-0 max-h-[min(320px,38vh)] overflow-y-auto overscroll-contain pe-1 [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

interface IntelligenceCommandLayoutProps {
  main: ReactNode
  insights: ReactNode
  assistant: ReactNode
  mainScrollable?: boolean
  variant?: 'viewport' | 'stacked'
}

export function IntelligenceCommandLayout({
  main,
  insights,
  assistant,
  mainScrollable = true,
  variant = 'viewport',
}: IntelligenceCommandLayoutProps) {
  /* Container queries, not viewport breakpoints: this layout sits in a panel
     that is three quarters of the page, or half of a card. Three columns at
     `xl` squeezed the crop table and the assistant into 240px columns. Now:
     one column when narrow, the main table over two columns when there is
     room, three columns only in a genuinely wide container. */
  const three = '@6xl:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.75fr)_minmax(260px,0.9fr)]'
  const gridClass =
    variant === 'viewport'
      ? `grid grid-cols-1 gap-4 @3xl:grid-cols-2 ${three} @6xl:h-full @6xl:min-h-0 @6xl:flex-1 @6xl:items-stretch`
      : `grid grid-cols-1 gap-4 @3xl:grid-cols-2 ${three} @6xl:items-start`

  const mainClass =
    variant === 'viewport'
      ? mainScrollable
        ? 'min-w-0 @3xl:col-span-2 @6xl:col-span-1 @6xl:min-h-0 @6xl:overflow-y-auto @6xl:overscroll-contain @6xl:pe-1'
        : 'flex min-w-0 flex-col @3xl:col-span-2 @6xl:col-span-1 @6xl:min-h-0 @6xl:overflow-hidden @6xl:pe-1'
      : 'min-w-0 @3xl:col-span-2 @6xl:col-span-1'

  const insightsClass =
    variant === 'viewport'
      ? 'min-w-0 space-y-4 @6xl:min-h-0 @6xl:overflow-y-auto @6xl:overscroll-contain @6xl:pe-1'
      : 'min-w-0 space-y-4'

  const assistantClass =
    variant === 'viewport'
      ? 'flex min-h-[min(520px,62vh)] min-w-0 flex-col overflow-hidden @6xl:min-h-0 @6xl:h-full'
      : 'flex min-h-[min(420px,55vh)] min-w-0 flex-col'

  return (
    <div className="@container min-w-0 flex-1 min-h-0">
      <div className={gridClass}>
        <div className={mainClass}>{main}</div>
        {assistant ? (
          <>
            <div className={insightsClass}>{insights}</div>
            <div className={assistantClass}>{assistant}</div>
          </>
        ) : (
          /* No assistant here: the insight cards share the row instead of
             leaving an empty column beside them. */
          <div className="min-w-0 @3xl:col-span-2 grid gap-4 @3xl:grid-cols-2 items-start">{insights}</div>
        )}
      </div>
    </div>
  )
}

export function IntelligenceLoadingState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-line" style={{ borderRadius: 'var(--radius-xl)' }}>
      <LoadingState label={message} />
    </div>
  )
}

export function IntelligenceErrorState({ message }: { message: string }) {
  return <ErrorState message={message} />
}

interface IntelligenceProducerCardProps {
  rank: number
  name: string
  lines: string[]
  onClick?: () => void
  variant?: 'default' | 'success' | 'warning'
}

/* Ranked producer: a row, not a tinted box. The rank is a figure, the
   variant is the square. */
export function IntelligenceProducerCard({
  rank,
  name,
  lines,
  onClick,
  variant = 'default',
}: IntelligenceProducerCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 bg-card border border-line px-3.5 py-3 text-start transition-colors',
        onClick && 'cursor-pointer hover:border-line-strong'
      )}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <span className="growa-figure text-content-soft w-6 shrink-0 tabular-nums" style={{ fontSize: 18 }}>
        {String(rank).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14px] text-content" style={{ fontWeight: 500 }}>
          {variant !== 'default' && <StatusDot tone={variant === 'success' ? 'good' : 'warning'} size={6} />}
          {name}
        </span>
        {lines.map((line, lineIndex) => (
          <span key={`${rank}-${lineIndex}`} className="mt-1 block text-[12px] text-content-soft">
            {line}
          </span>
        ))}
      </span>
    </Tag>
  )
}

interface IntelligenceDataTableProps {
  children: ReactNode
  scrollable?: boolean
  maxHeightClass?: string
  fill?: boolean
}

export function IntelligenceDataTable({
  children,
  scrollable = true,
  maxHeightClass = 'max-h-[min(480px,55vh)]',
  fill = false,
}: IntelligenceDataTableProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-line bg-card',
        fill
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
          : scrollable
            ? `${maxHeightClass} overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]`
            : ''
      )}
    >
      <div
        className={
          fill
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]'
            : undefined
        }
      >
        <table className="g-table g-table--pad-sm min-w-full text-start text-[13px]">{children}</table>
      </div>
    </div>
  )
}

export function IntelligenceTableHead({ children }: { children: ReactNode }) {
  return (
    /* Header row as in `.g-table`: regular weight, caption size, secondary
       colour, dotted rule under it — no filled band. */
    <thead className="sticky top-0 z-10 bg-card text-[12px] text-content-soft [&_th]:font-normal [&_th]:border-b [&_th]:border-dotted [&_th]:border-line-strong">
      {children}
    </thead>
  )
}

export function IntelligenceTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line text-content">{children}</tbody>
}
