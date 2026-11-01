'use client'

import { useEffect, useState } from 'react'
import { DashboardQueryLink } from '@/components/dashboard/dashboard-query-link'
import { Bell } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useActiveOrganization } from '@/contexts/active-organization-context'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'

export function PlatformShellControls() {
  const { tr } = useI18n()
  const {
    activeOrganization: organization,
    organizations,
    activeOrganizationId,
    switchOrganization,
    requiresOrganizationSelection,
  } = useActiveOrganization()
  const { effectiveRole, roleProfile } = useSharedRoleNavigation()
  const opCtx = useOperationalContextOptional()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/alerts?status=new&limit=20', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (!cancelled) {
          setAlertCount(Array.isArray(payload.alerts) ? payload.alerts.length : 0)
        }
      })
      .catch(() => { if (!cancelled) setAlertCount(0) })
    return () => { cancelled = true }
  }, [])

  // Sentence case (brand rule): "Farm manager", not "Farm Manager".
  const roleSpaced = (roleProfile || effectiveRole || 'viewer').replace(/_/g, ' ')
  const roleLabel = roleSpaced.charAt(0).toUpperCase() + roleSpaced.slice(1)

  const scopeLabel = opCtx?.context.farmId
    ? tr('Farm · {id}…', { id: opCtx.context.farmId.slice(0, 8) })
    : tr('National scope')

  return (
    /* Context, not chrome: organisation and scope read as two small label /
       value pairs separated by a dotted rule (the brand never uses a solid
       divider inside a bar). Labels are sentence case, not tracked caps. */
    <div className="hidden lg:flex items-center gap-4 shrink-0 me-3">
      <div className="min-w-0 max-w-[160px]">
        <p className="text-[11px] text-content-soft truncate leading-tight">
          {tr('Organisation')}
        </p>
        {/* A lone dash read as a loading glitch: say it plainly. */}
        {organizations.length > 1 ? (
          <select
            aria-label={tr('Active organisation')}
            className="mt-0.5 max-w-full truncate rounded-md border border-line bg-card px-2 py-1 text-[13px] text-content"
            value={activeOrganizationId || ''}
            onChange={(e) => {
              const next = e.target.value
              if (next) void switchOrganization(next)
            }}
          >
            {!activeOrganizationId && (
              <option value="">{requiresOrganizationSelection ? tr('Select organisation') : tr('Not assigned')}</option>
            )}
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : (
          <p
            className={`text-[13px] truncate leading-tight ${organization?.name ? 'text-content' : 'text-content-soft'}`}
            style={{ fontWeight: organization?.name ? 500 : 400 }}
          >
            {organization?.name || tr('Not assigned')}
          </p>
        )}
      </div>

      <div className="border-s border-dotted border-line-strong ps-4 min-w-0 max-w-[140px]">
        <p className="text-[11px] text-content-soft leading-tight">{tr('Scope')}</p>
        <p className="text-[13px] text-content truncate leading-tight">{scopeLabel}</p>
      </div>

      <span className="hidden 2xl:inline text-[12px] text-content-soft border-s border-dotted border-line-strong ps-4">{tr(roleLabel)}</span>

      <DashboardQueryLink
        href="/dashboard?module=alerts-center"
        aria-label={alertCount > 0 ? tr('Alerts ({count} new)', { count: alertCount }) : tr('Alerts')}
        className="relative flex items-center justify-center h-9 w-9 text-stone-600 hover:text-ink transition-colors"
      >
        <Bell strokeWidth={1.5} className="h-5 w-5" aria-hidden="true" />
        {alertCount > 0 && (
          /* New alerts are something to act on: the system red, as a small
             count pill — a count is a label, and short labels are pills. */
          <span
            aria-hidden="true"
            className="absolute top-0 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-critical px-1 text-[10px] font-medium text-white"
          >
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </DashboardQueryLink>
    </div>
  )
}
