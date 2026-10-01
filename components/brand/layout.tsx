'use client'

/**
 * Page and card anatomy — the same grammar as the Growa SaaS, so screens
 * in the two products read as one system.
 *
 *   <PageHeader eyebrow="Storage" title="Silos" subtitle="…" actions={…} />
 *
 *   <Card family="monitoraggio" icon={Droplets} title="Water" subtitle="…"
 *         actions={<CardAction …/>}>
 *     …body…
 *   </Card>
 *
 * SaaS references: page header in `silos/SilosPage.jsx`; card frame in
 * `dashboard/cards/WeatherStationCard.jsx`; families and body rules in
 * `globals.css` (`.g-card-testata`, `.g-card-icona`, `.g-card-corpo`).
 */

import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { Button, EmptyMark, Eyebrow, LatticeLoader } from './ui'

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>

/* ------------------------------------------------------------------ *
 * Page header: bracketed micro-label, a LIGHT display title with the
 * filled square before it, a short subtitle, actions on the end side.
 * ------------------------------------------------------------------ */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  size = 'display',
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** `display` for full pages; `compact` for the side panel of a map workspace. */
  size?: 'display' | 'compact'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', size === 'display' ? 'mb-8' : 'mb-6', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow brackets>{eyebrow}</Eyebrow>}
        <h1
          className={cn('flex items-center gap-2.5 text-content', eyebrow && 'mt-3')}
          style={{
            fontSize: size === 'display' ? 'var(--text-display-3)' : 'var(--text-title)',
            fontWeight: 300,
            letterSpacing: 'var(--ls-display)',
            lineHeight: 'var(--lh-tight)',
          }}
        >
          <span aria-hidden="true" className="w-2 h-2 bg-ink shrink-0" style={{ borderRadius: 1 }} />
          {title}
        </h1>
        {subtitle && <p className="text-[14px] text-content-soft mt-3 max-w-[58ch] leading-[1.45]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* Standard page container, as `max-w-7xl mx-auto p-6` in the SaaS. */
export function PageBody({ children, className = '', wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('growa mx-auto p-6', wide ? 'max-w-[1600px]' : 'max-w-7xl', className)}>{children}</div>
}

/* ------------------------------------------------------------------ *
 * Card: white, 1px line, radius xl, header by family, body always white.
 * ------------------------------------------------------------------ */
export type CardFamily = 'monitoraggio' | 'comando' | 'ai'

export function Card({
  family = 'monitoraggio',
  icon,
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  style,
  headerExtra,
  as: Tag = 'section',
  flush = false,
}: {
  family?: CardFamily
  icon?: IconType
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  style?: CSSProperties
  /** Row under the title inside the header (tabs, filters). */
  headerExtra?: ReactNode
  as?: 'section' | 'div' | 'article'
  /** Body without padding (maps, tables that run edge to edge). */
  flush?: boolean
}) {
  return (
    <Tag
      data-famiglia={family}
      className={cn('growa bg-card border border-line overflow-hidden flex flex-col', className)}
      style={{ borderRadius: 'var(--radius-xl)', ...style }}
    >
      {(title || actions) && (
        <CardHeader icon={icon} title={title} subtitle={subtitle} actions={actions} extra={headerExtra} />
      )}
      <div className={cn('g-card-corpo flex-1 min-h-0', !flush && 'p-4 space-y-3', bodyClassName)}>{children}</div>
    </Tag>
  )
}

export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  extra,
}: {
  icon?: IconType
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="px-4 py-3 g-card-testata shrink-0">
      {/* Wraps on narrow cards: the actions drop under the title instead of
          squeezing it to two letters. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        {/* SaaS cards always carry a subtitle; without one, centre the
            title on the icon tile instead of hanging it from the top. */}
        <div className={cn('flex gap-2.5 min-w-[10rem] flex-1', subtitle ? 'items-start' : 'items-center')}>
          {Icon && (
            <span
              className="shrink-0 w-8 h-8 inline-flex items-center justify-center g-card-icona"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-[14px] text-content leading-tight" style={{ fontWeight: 500 }}>
              {title}
            </h3>
            {subtitle && <p className="text-[12px] text-content-soft mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  )
}

/* Round secondary command in a card header (refresh, expand…). */
export function CardAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  spinning = false,
  active = false,
}: {
  icon: IconType
  label: string
  onClick?: () => void
  disabled?: boolean
  spinning?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        'w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-pill transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        active ? 'bg-ink text-white' : 'bg-card text-content-soft hover:text-content',
      )}
    >
      <Icon className={cn('w-4 h-4', spinning && 'animate-spin')} strokeWidth={1.5} />
    </button>
  )
}

/* A framed tile inside a card body (kept framed when it sits in a grid). */
export function Tile({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('bg-card border border-line p-3.5', className)} style={{ borderRadius: 'var(--radius-lg)', ...style }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * States: empty, error, loading — one look for every screen.
 * ------------------------------------------------------------------ */
export function EmptyState({
  title,
  description,
  action,
  className = '',
  compact = false,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('text-center', compact ? 'py-8' : 'py-16', className)}>
      <EmptyMark />
      <p className="text-content" style={{ fontSize: compact ? 'var(--text-body-sm)' : 'var(--text-subheading)', fontWeight: 500 }}>
        {title}
      </p>
      {description && (
        <p className="text-[14px] text-content-soft mt-2 max-w-[58ch] mx-auto leading-[1.45]">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: {
  message: ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  const { tr } = useI18n()
  return (
    <div
      role="alert"
      className={cn('bg-card border border-line p-4 flex flex-col items-center text-center gap-2.5', className)}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      <AlertTriangle className="w-5 h-5 text-critical" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-[13px] text-content">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {tr(retryLabel)}
        </Button>
      )}
    </div>
  )
}

export function LoadingState({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  const { tr } = useI18n()
  const text = tr(label)
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12 text-ink', className)}>
      <LatticeLoader label={text} />
      <span className="text-[14px] text-content-soft">{text}</span>
    </div>
  )
}

/* Notice: an inline informational / warning / critical strip — a tinted
   panel with the status square, never a coloured neon box. */
export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: 'info' | 'warning' | 'critical' | 'good'
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const palette = {
    info: { bg: 'var(--growa-stone-50)', border: 'var(--border-subtle)', dot: 'var(--status-progress)' },
    good: { bg: 'var(--growa-cream-50)', border: 'var(--growa-sage-300)', dot: 'var(--status-good)' },
    warning: { bg: 'var(--warning-soft)', border: 'var(--warning-line)', dot: 'var(--warning)' },
    critical: { bg: 'color-mix(in srgb, var(--status-critical) 7%, white)', border: 'color-mix(in srgb, var(--status-critical) 30%, white)', dot: 'var(--status-critical)' },
  }[tone]
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 px-4 py-3 border text-[13px] leading-[1.45]', className)}
      style={{ background: palette.bg, borderColor: palette.border, borderRadius: 'var(--radius-lg)' }}
    >
      <span aria-hidden="true" className="mt-1.5 w-[7px] h-[7px] shrink-0" style={{ background: palette.dot, borderRadius: 1 }} />
      <div className="min-w-0 text-content">
        {title && <p style={{ fontWeight: 500 }}>{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-content-soft')}>{children}</div>}
      </div>
    </div>
  )
}
