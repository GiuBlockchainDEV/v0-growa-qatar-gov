'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Construction,
  Layers,
  MapPin,
  Radio,
  Sparkles,
} from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { getModuleStatus } from '@/lib/navigation/module-status'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ModuleWorkspaceProps {
  moduleKey: string | null
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

function toSentenceCase(value: string) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const MODULE_PATHS: Record<string, string> = {
  watchtower: '/dashboard?module=watchtower',
  'live-map': '/dashboard?module=live-map',
  harvest: '/dashboard?module=harvest',
  'production-harvest': '/dashboard?module=harvest',
  weather: '/dashboard?module=weather',
  'water-intelligence': '/dashboard?module=water-intelligence',
  'energy-intelligence': '/dashboard?module=energy-intelligence',
  'data-analytics': '/dashboard?module=data-analytics',
  'rss-feed': '/dashboard?module=rss-feed',
  'supply-overview': '/dashboard/supply-overview',
  'farms-sites': '/dashboard/farms',
  'alerts-center': '/dashboard?module=alerts-center',
}

function resolveModulePath(moduleKey: string) {
  const normalized = normalizeKey(moduleKey)
  return MODULE_PATHS[normalized] || `/dashboard?module=${normalized}`
}

export function ModuleWorkspace({ moduleKey }: ModuleWorkspaceProps) {
  const { t } = useI18n()
  const { menuItems, effectiveRole, source } = useRoleNavigation()

  const activeModule = useMemo(() => {
    if (!moduleKey) return null
    const wanted = normalizeKey(moduleKey)
    return (
      menuItems.find((item) => normalizeKey(item.key) === wanted) ||
      menuItems.find((item) => item.path === `/dashboard?module=${moduleKey}`) ||
      null
    )
  }, [menuItems, moduleKey])

  const moduleLabel = activeModule?.label || (moduleKey ? toSentenceCase(moduleKey) : 'Module')
  const moduleStatus = moduleKey ? getModuleStatus(moduleKey) : null

  if (!moduleKey) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050608] p-6">
        <div className="rounded-xl border border-white/10 bg-[#0a0d12] p-6 text-sm text-white/60">
          No module selected.
        </div>
      </div>
    )
  }

  const relatedLinks = (moduleStatus?.relatedModules || ['watchtower', 'live-map'])
    .map((key) => ({
      key,
      label: toSentenceCase(key),
      path: resolveModulePath(key),
    }))
    .filter((link) => normalizeKey(link.key) !== normalizeKey(moduleKey))

  const statusBadge = {
    live: { label: 'Live', className: 'bg-[#07f880]/15 text-[#07f880]' },
    partial: { label: 'Partial', className: 'bg-amber-500/15 text-amber-300' },
    upcoming: { label: 'Upcoming', className: 'bg-white/10 text-white/50' },
  }[moduleStatus?.status || 'upcoming']

  return (
    <div className="h-full overflow-y-auto bg-[#050608] text-white">
      <div className="mx-auto max-w-4xl space-y-5 p-6 pt-20">
        <OperationalContextBanner />

        <div className="rounded-xl border border-white/10 bg-[#0a0d12] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#07f880]" />
                <h1 className="text-xl font-semibold">{moduleLabel}</h1>
                <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold uppercase', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/55">
                {activeModule?.purpose || moduleStatus?.description || t('watchtower.upcoming_description')}
              </p>
            </div>
            {moduleStatus?.status === 'upcoming' && (
              <Construction className="h-8 w-8 text-white/15 shrink-0" />
            )}
          </div>

          <p className="mt-3 text-[11px] text-white/35">
            Role: <span className="capitalize text-white/55">{effectiveRole?.replace(/_/g, ' ') || 'unassigned'}</span>
            {' · '}
            Nav source: <span className="text-white/55">{source}</span>
          </p>
        </div>

        {moduleStatus?.status === 'upcoming' ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-amber-200">{t('watchtower.upcoming_module')}</h2>
                <p className="mt-1 text-sm text-amber-100/80">{t('watchtower.upcoming_description')}</p>
                <p className="mt-3 text-xs text-white/45 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  This module is in the platform roadmap. No operational metrics are shown until backend integration is complete.
                </p>
              </div>
            </div>
          </div>
        ) : moduleStatus?.status === 'partial' ? (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-sky-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-sky-200">Partial integration</h2>
                <p className="mt-1 text-sm text-sky-100/80">
                  Core functionality is available. Some workflows and data linkages are still being connected to the national platform.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-[#0a0d12] p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
            {t('module.investigate_via')}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.key}
                href={link.path}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white/75 hover:border-[#07f880]/30 hover:text-[#07f880] transition-colors"
              >
                <span className="flex items-center gap-2">
                  {link.key === 'watchtower' ? (
                    <Radio className="h-4 w-4" />
                  ) : link.key === 'live-map' ? (
                    <MapPin className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {link.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
          <p>
            Platform journey: <span className="text-white/60">Observe → Detect → Understand → Investigate → Decide → Act → Monitor → Verify</span>
          </p>
          <p className="mt-2">
            Start from the{' '}
            <Link href="/dashboard?module=watchtower" className="text-[#07f880] hover:underline">
              National Watchtower
            </Link>{' '}
            for live situational awareness, then navigate to domain modules with preserved context.
          </p>
        </div>
      </div>
    </div>
  )
}
