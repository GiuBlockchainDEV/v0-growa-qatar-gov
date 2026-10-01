'use client'

/**
 * Status and severity, said one way across the app: a pill tag with the
 * square data point inside, sentence-case label (Brand Book p.81 writes
 * "Good", "Critic", "In progress" — never CRITICAL in caps).
 *
 * The brand defines good / progress / critical. The console needs four
 * severity steps, so `high` and `attention` use the DERIVED terracotta and
 * ochre (see globals.css, "SEVERITY SCALE").
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { StatusDot } from './ui'
import { useI18n } from '@/lib/i18n'

export type Severity = 'critical' | 'high' | 'attention' | 'warning' | 'medium' | 'low' | 'info' | 'normal' | 'good' | 'unknown' | 'offline' | 'progress'

const SEVERITY: Record<Severity, { tone: string; en: string; ar: string }> = {
  critical: { tone: 'var(--status-critical)', en: 'Critical', ar: 'حرج' },
  high: { tone: 'var(--high)', en: 'High', ar: 'مرتفع' },
  attention: { tone: 'var(--warning)', en: 'Attention', ar: 'انتباه' },
  warning: { tone: 'var(--warning)', en: 'Warning', ar: 'تحذير' },
  medium: { tone: 'var(--warning)', en: 'Medium', ar: 'متوسط' },
  low: { tone: 'var(--status-progress)', en: 'Low', ar: 'منخفض' },
  info: { tone: 'var(--status-progress)', en: 'Info', ar: 'معلومة' },
  progress: { tone: 'var(--status-progress)', en: 'In progress', ar: 'قيد التنفيذ' },
  normal: { tone: 'var(--status-good)', en: 'Normal', ar: 'طبيعي' },
  good: { tone: 'var(--status-good)', en: 'Good', ar: 'جيد' },
  unknown: { tone: 'var(--status-neutral)', en: 'Unknown', ar: 'غير معروف' },
  offline: { tone: 'var(--status-neutral)', en: 'Offline', ar: 'غير متصل' },
}

export function severityTone(level: string | null | undefined): string {
  return SEVERITY[(level || 'unknown') as Severity]?.tone ?? 'var(--status-neutral)'
}

export function severityLabel(level: string | null | undefined, locale: string = 'en'): string {
  const s = SEVERITY[(level || 'unknown') as Severity]
  if (!s) {
    const raw = String(level || '').replace(/[_-]+/g, ' ').trim()
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  }
  return locale === 'ar' ? s.ar : s.en
}

/** Pill with the status square. `label` overrides the default wording. */
export function StatusTag({
  level,
  label,
  locale,
  size = 'sm',
  className = '',
  tone,
}: {
  level?: string | null
  label?: ReactNode
  locale?: string
  size?: 'sm' | 'md'
  className?: string
  /** Explicit colour for the square, when the level is not a severity. */
  tone?: string
}) {
  // The severity words follow the interface language unless a locale is forced.
  const { locale: uiLocale } = useI18n()
  return (
    <span
      className={cn('g-tag g-tag--outline-ink', className)}
      style={{
        height: size === 'sm' ? 22 : 28,
        padding: `0 ${size === 'sm' ? 9 : 12}px`,
        fontSize: size === 'sm' ? 11 : 'var(--text-caption)',
        gap: 6,
      }}
    >
      <StatusDot tone={tone ?? severityTone(level)} size={6} />
      {label ?? severityLabel(level, locale ?? uiLocale)}
    </span>
  )
}

/** Sentence case for enum-like strings coming from the API ("in_progress"). */
export function humanize(value: string | null | undefined): string {
  const raw = String(value || '').replace(/[_-]+/g, ' ').trim()
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : ''
}
