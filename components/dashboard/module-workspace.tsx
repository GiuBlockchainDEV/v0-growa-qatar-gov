'use client'

import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { ArrowRight, Clock, Layers, MapPin, Radio } from 'lucide-react'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { getModuleStatus } from '@/lib/navigation/module-status'
import { useI18n } from '@/lib/i18n'
import { getNavItem, navItemLabel } from '@/lib/navigation/registry'
import { Card, EmptyState, Notice, PageHeader } from '@/components/brand/layout'
import { StatusTag } from '@/components/brand/status'

interface ModuleWorkspaceProps {
  moduleKey: string | null
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

function toSentenceCase(value: string) {
  const words = value.replace(/[-_]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
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
  const { t, tr, locale } = useI18n()
  const { effectiveRole } = useSharedRoleNavigation()

  // Title in the interface language, from the navigation registry.
  const navEntry = moduleKey ? getNavItem(moduleKey) : undefined
  const moduleLabel = navEntry ? navItemLabel(navEntry, locale) : moduleKey ? toSentenceCase(moduleKey) : tr('Module')
  const moduleStatus = moduleKey ? getModuleStatus(moduleKey) : null

  if (!moduleKey) {
    return (
      <div className="growa flex h-full items-center justify-center bg-background p-6">
        <EmptyState title={tr('No module selected')} />
      </div>
    )
  }

  const relatedLinks = (moduleStatus?.relatedModules || ['watchtower', 'live-map'])
    .map((key) => ({
      key,
      label: (() => {
        const entry = getNavItem(key)
        return entry ? navItemLabel(entry, locale) : toSentenceCase(key)
      })(),
      path: resolveModulePath(key),
    }))
    .filter((link) => normalizeKey(link.key) !== normalizeKey(moduleKey))

  const statusBadge = {
    live: { label: 'Live', level: 'good' },
    partial: { label: 'Partial', level: 'attention' },
    upcoming: { label: 'Upcoming', level: 'unknown' },
  }[moduleStatus?.status || 'upcoming']

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <PageHeader
          eyebrow={tr('Module')}
          title={moduleLabel}
          subtitle={moduleStatus?.description ? tr(moduleStatus.description) : t('watchtower.upcoming_description')}
          actions={<StatusTag level={statusBadge.level} label={tr(statusBadge.label)} size="md" />}
          className="!mb-2"
        />
        <OperationalContextBanner />

        {moduleStatus?.status === 'upcoming' ? (
          <Notice tone="warning" title={t('watchtower.upcoming_module')}>
            {t('watchtower.upcoming_description')}
            <span className="mt-2 flex items-center gap-1.5 text-[12px]">
              <Clock strokeWidth={1.5} className="h-3.5 w-3.5" />
              {tr('This module is in the platform roadmap. No operational metrics are shown until backend integration is complete.')}
            </span>
          </Notice>
        ) : moduleStatus?.status === 'partial' ? (
          <Notice tone="info" title={tr('Partial integration')}>
            {tr('Core functionality is available. Some workflows and data linkages are still being connected to the national platform.')}
          </Notice>
        ) : null}

        <Card icon={Layers} title={t('module.investigate_via')} subtitle={`${tr('Role')}: ${effectiveRole?.replace(/_/g, ' ') || tr('unassigned')}`}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {relatedLinks.map((link) => (
              <DashboardQueryLink
                key={link.key}
                href={link.path}
                className="group flex items-center justify-between rounded-lg bg-card border border-line px-4 py-3 text-[14px] text-content hover:border-line-strong transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  {link.key === 'watchtower' ? (
                    <Radio strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
                  ) : link.key === 'live-map' ? (
                    <MapPin strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
                  ) : (
                    <ArrowRight strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
                  )}
                  {link.label}
                </span>
                <ArrowRight strokeWidth={1.5} className="h-4 w-4 text-stone-300 group-hover:text-ink transition-colors rtl:-scale-x-100" />
              </DashboardQueryLink>
            ))}
          </div>
        </Card>

        <Notice tone="info" title={tr('Platform journey')}>
          {tr('Observe → detect → understand → investigate → decide → act → monitor → verify. Start from the')}{' '}
          <DashboardQueryLink href="/dashboard?module=watchtower" className="text-sage-700 hover:text-ink">
            {tr('National watchtower')}
          </DashboardQueryLink>{' '}
          {tr('for live situational awareness, then navigate to domain modules with preserved context.')}
        </Notice>
      </div>
    </div>
  )
}
