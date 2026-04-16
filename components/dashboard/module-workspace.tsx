'use client'

import { useMemo } from 'react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import {
  AlertTriangle,
  Compass,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

function normalizeKey(value: string | null | undefined) {
  if (!value) return ''
  return value.trim().toLowerCase().replace(/_/g, '-')
}

function resolveItemKey(item: Record<string, unknown>) {
  const keyCandidate =
    (typeof item.key === 'string' && item.key) ||
    (typeof item.id === 'string' && item.id) ||
    (typeof item.label === 'string' && item.label) ||
    ''

  return normalizeKey(keyCandidate)
}

interface ModuleWorkspaceProps {
  moduleKey: string | null
}

function toSentenceCase(value: string) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getSeed(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  return hash
}

export function ModuleWorkspace({ moduleKey }: ModuleWorkspaceProps) {
  const { menuItems, effectiveRole, source } = useRoleNavigation()

  const activeModule = useMemo(() => {
    if (!moduleKey) return null
    const wanted = normalizeKey(moduleKey)

    return (
      menuItems.find((item) => resolveItemKey(item as unknown as Record<string, unknown>) === wanted) ||
      menuItems.find((item) => item.path === `/dashboard?module=${moduleKey}`) ||
      null
    )
  }, [menuItems, moduleKey])

  const virtualModule = useMemo(() => {
    if (activeModule || !moduleKey) return activeModule

    return {
      key: moduleKey,
      label: toSentenceCase(moduleKey),
      path: `/dashboard?module=${moduleKey}`,
      icon: 'Layers',
      section: 'primary' as const,
      purpose: `Operational workspace for ${toSentenceCase(moduleKey)}.`,
      defaultContent: `This workspace structures ${toSentenceCase(moduleKey)} operations, monitoring, and execution controls.`,
      allowedActions: ['Review dashboard', 'Update execution status', 'Export current view'],
      submenu: [
        { key: `${moduleKey}-overview`, label: 'Overview' },
        { key: `${moduleKey}-queue`, label: 'Work Queue' },
        { key: `${moduleKey}-analysis`, label: 'Analysis' },
      ],
    }
  }, [activeModule, moduleKey])

  const friendlyRole = useMemo(() => {
    if (!effectiveRole) return 'unassigned'
    return effectiveRole.replace(/_/g, ' ')
  }, [effectiveRole])

  if (!moduleKey) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/70">
          No module selected.
        </div>
      </div>
    )
  }

  if (!virtualModule) {
    return (
      <div className="space-y-4 p-6 pt-20">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h1 className="text-xl font-semibold text-amber-200">Module not registered</h1>
          <p className="mt-1 text-sm text-amber-100/80">
            The selected module <span className="font-mono">{moduleKey}</span> is not available for your
            current role context.
          </p>
        </div>
      </div>
    )
  }

  const submenu = Array.isArray(virtualModule.submenu) ? virtualModule.submenu : []
  const allowedActions = Array.isArray(virtualModule.allowedActions)
    ? virtualModule.allowedActions
    : []
  const moduleSeed = getSeed(virtualModule.key)
  const kpis = [
    {
      label: 'Open Workstreams',
      value: String((moduleSeed % 12) + 4),
      delta: `+${(moduleSeed % 5) + 1}`,
      tone: 'text-[#07f880]',
    },
    {
      label: 'Pending Reviews',
      value: String((moduleSeed % 9) + 2),
      delta: `-${moduleSeed % 3}`,
      tone: 'text-sky-300',
    },
    {
      label: 'Escalations',
      value: String(moduleSeed % 4),
      delta: `${moduleSeed % 2 === 0 ? '+' : '-'}${(moduleSeed % 3) + 1}`,
      tone: 'text-amber-300',
    },
    {
      label: 'Service Level',
      value: `${95 + (moduleSeed % 4)}%`,
      delta: '+0.6%',
      tone: 'text-violet-300',
    },
  ]
  const moduleSections =
    submenu.length > 0
      ? submenu
      : [{ key: `${virtualModule.key}-overview`, label: 'Overview' }]
  const operationalRows = moduleSections.map((section, index) => ({
    id: `${virtualModule.key}-${index + 1}`,
    stream: section.label,
    owner: index % 2 === 0 ? 'Operations Desk' : 'Regional Unit',
    status: index % 3 === 0 ? 'on-track' : index % 3 === 1 ? 'watch' : 'attention',
    eta: `T+${index + 1}d`,
  }))

  return (
    <div className="space-y-5 p-6 pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-2xl font-semibold text-foreground">{virtualModule.label}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {virtualModule.purpose || virtualModule.defaultContent || 'Operational module workspace'}
        </p>
        <p className="mt-2 text-xs text-white/50">
          Role: <span className="capitalize text-white/70">{friendlyRole}</span> • Source:{' '}
          <span className="text-white/70">{source}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{kpi.value}</p>
            <p className={`mt-1 text-xs ${kpi.tone}`}>{kpi.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Functional Sections</h2>
            <span className="text-xs text-white/50">Role-aware structure</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {moduleSections.map((section, index) => (
              <div
                key={section.key}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-3 hover:border-[#07f880]/25 transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-white/45">Section {index + 1}</p>
                <p className="mt-1 text-sm font-medium text-white">{section.label}</p>
                <p className="mt-2 text-xs text-white/55">
                  Structured workspace block for {section.label.toLowerCase()} execution and review.
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[#07f880]" />
              <h3 className="text-sm font-semibold text-white">Action Queue</h3>
            </div>
            <ul className="space-y-1.5 text-sm text-white/75">
              {allowedActions.length > 0 ? (
                allowedActions.map((action) => <li key={action}>• {action}</li>)
              ) : (
                <li>• Actions will be configured for this module.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
              <h3 className="text-sm font-semibold text-white">Control Scope</h3>
            </div>
            <p className="text-sm text-white/70">
              This module is rendered according to role permissions, visibility scope, and workspace
              source ({source}).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 xl:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-semibold text-white">Operational Register</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">ID</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Stream</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Owner</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">ETA</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/45">Status</th>
                </tr>
              </thead>
              <tbody>
                {operationalRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/85">{row.id}</td>
                    <td className="px-3 py-2 text-white">{row.stream}</td>
                    <td className="px-3 py-2 text-white/70">{row.owner}</td>
                    <td className="px-3 py-2 text-white/70">{row.eta}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${
                          row.status === 'on-track'
                            ? 'bg-[#07f880]/15 text-[#07f880]'
                            : row.status === 'watch'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#07f880]" />
            <h2 className="text-sm font-semibold text-white">Default Content</h2>
          </div>
          <p className="text-sm text-white/70">
            {virtualModule.defaultContent || 'Module content structure is ready for integration.'}
          </p>
          <div className="mt-4 mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-white">Implementation Note</h2>
          </div>
          <p className="text-sm text-white/65">
            Use this module shell as the operational baseline. Connect API feeds progressively per section.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ensure KPI definitions are validated with business owners before go-live.
          </div>
        </div>
      </div>
    </div>
  )
}

