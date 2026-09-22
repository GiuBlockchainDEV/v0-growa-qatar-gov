'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Clock } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { useSharedRoleNavigation } from '@/contexts/role-navigation-context'
import { useOperationalContextOptional } from '@/contexts/operational-context-provider'
import { WATCHTOWER_TIMEFRAMES, timeframeLabel } from '@/lib/domain/timeframes'
import { cn } from '@/lib/utils'

export function PlatformShellControls() {
  const { locale } = useI18n()
  const { organization } = useOrganization()
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

  const roleLabel = (roleProfile || effectiveRole || 'viewer')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const scopeLabel = opCtx?.context.farmId
    ? `Farm · ${opCtx.context.farmId.slice(0, 8)}…`
    : locale === 'ar' ? 'نطاق وطني' : 'National scope'

  return (
    <div className="hidden lg:flex items-center gap-3 shrink-0">
      <div className="min-w-0 max-w-[140px]">
        <p className="text-[9px] uppercase tracking-wider text-white/30 truncate">
          {locale === 'ar' ? 'المنظمة' : 'Org'}
        </p>
        <p className="text-[11px] font-medium text-white/80 truncate">
          {organization?.name || '—'}
        </p>
      </div>

      <div className="border-l border-white/10 pl-3 min-w-0 max-w-[120px]">
        <p className="text-[9px] uppercase tracking-wider text-white/30">{locale === 'ar' ? 'النطاق' : 'Scope'}</p>
        <p className="text-[11px] text-white/60 truncate">{scopeLabel}</p>
      </div>

      {opCtx && (
        <div className="hidden xl:flex items-center gap-1 border-l border-white/10 pl-3">
          <Clock className="h-3 w-3 text-white/30" />
          <div className="flex rounded border border-white/10 p-0.5">
            {WATCHTOWER_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => opCtx.setTimeframe(tf)}
                className={cn(
                  'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                  opCtx.timeframe === tf ? 'bg-[#07f880] text-black' : 'text-white/40 hover:text-white/65'
                )}
              >
                {timeframeLabel(tf)}
              </button>
            ))}
          </div>
        </div>
      )}

      <span className="hidden 2xl:inline text-[10px] text-white/35 border-l border-white/10 pl-3">{roleLabel}</span>

      <Link
        href="/dashboard?module=alerts-center"
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/55 hover:text-[#07f880] hover:border-[#07f880]/25"
      >
        <Bell className="h-4 w-4" />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold text-black">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </Link>
    </div>
  )
}
