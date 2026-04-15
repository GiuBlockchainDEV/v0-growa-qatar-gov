'use client'

import { useMemo } from 'react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'
import { Compass, Layers, ListChecks } from 'lucide-react'

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

interface ModuleWorkspaceProps {
  moduleKey: string | null
}

export function ModuleWorkspace({ moduleKey }: ModuleWorkspaceProps) {
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

  if (!activeModule) {
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

  const submenu = activeModule.submenu || []
  const allowedActions = activeModule.allowedActions || []

  return (
    <div className="space-y-5 p-6 pt-20">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-2xl font-semibold text-foreground">{activeModule.label}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {activeModule.purpose || activeModule.defaultContent || 'Operational module workspace'}
        </p>
        <p className="mt-2 text-xs text-white/50">
          Role: <span className="capitalize text-white/70">{friendlyRole}</span> • Source:{' '}
          <span className="text-white/70">{source}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#07f880]" />
            <h2 className="text-sm font-semibold text-white">Default Content</h2>
          </div>
          <p className="text-sm text-white/70">
            {activeModule.defaultContent || 'Module content structure is ready for integration.'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold text-white">Allowed Actions</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-white/70">
            {allowedActions.length > 0 ? (
              allowedActions.map((action) => <li key={action}>• {action}</li>)
            ) : (
              <li>• Actions will be configured for this module.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-semibold text-white">Subsections</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {submenu.length > 0 ? (
              submenu.map((section) => (
                <span
                  key={section.key}
                  className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
                >
                  {section.label}
                </span>
              ))
            ) : (
              <span className="text-sm text-white/60">No subsection metadata available.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

