'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Cpu, Play, RefreshCw, UserCheck } from 'lucide-react'
import type { AgentMission } from '@/lib/ai/agents/types'
import { AGENT_REGISTRY } from '@/lib/ai/agents/registry'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/brand/feedback'
import { Card, CardAction, EmptyState, Notice, PageHeader, Tile } from '@/components/brand/layout'
import { Button, Field, LatticeLoader } from '@/components/brand/ui'
import { StatusTag, humanize } from '@/components/brand/status'
import { Archive, Sparkles, Users } from 'lucide-react'

/* Mission status → the system's status squares. */
const STATUS_LEVEL: Record<string, string> = {
  queued: 'unknown',
  running: 'progress',
  waiting_for_agent: 'progress',
  waiting_for_human: 'attention',
  completed: 'good',
  failed: 'critical',
}

/* English labels; translated at render with tr(). */
const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  waiting_for_agent: 'Waiting for agent',
  waiting_for_human: 'Waiting for human',
  completed: 'Completed',
  failed: 'Failed',
}

export function AiMissionControlWorkspace() {
  const showToast = useToast()
  const { tr } = useI18n()
  const [missions, setMissions] = useState<AgentMission[]>([])
  const [loading, setLoading] = useState(true)
  const [objective, setObjective] = useState('')
  const [running, setRunning] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/ai/missions', { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to load missions')
      setUnavailable(Boolean(payload.unavailable))
      setMissions(Array.isArray(payload.missions) ? payload.missions : [])
    } catch (e) {
      console.error(e)
      setMissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startMission = async () => {
    const text = objective.trim()
    if (!text) return
    try {
      setRunning(true)
      const res = await fetch('/api/ai/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: text, taskType: 'investigation' }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || tr('Failed to start mission'))
      if (payload.mission) {
        setMissions((current) => [payload.mission as AgentMission, ...current])
      }
      setObjective('')
      setUnavailable(Boolean(payload.unavailable))
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr('Failed to start mission'), 'error')
    } finally {
      setRunning(false)
    }
  }

  const active = missions.filter((m) => ['queued', 'running', 'waiting_for_agent'].includes(m.status))
  const waitingHuman = missions.filter((m) => m.status === 'waiting_for_human')
  const completed = missions.filter((m) => m.status === 'completed')

  return (
    <div className="growa h-full overflow-y-auto bg-background text-content">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <PageHeader
          eyebrow={tr('Artificial intelligence')}
          title={tr('AI mission control')}
          subtitle={tr('Simulated institutional work via specialist agents — human approval required for actions.')}
          actions={<CardAction icon={RefreshCw} label={tr('Refresh')} onClick={load} spinning={loading} />}
          className="!mb-2"
        />
        <OperationalContextBanner />
        {unavailable && <Notice tone="warning">{tr('Migration {migration} required for persistence.', { migration: '00029_agent_missions' })}</Notice>}

        {/* Starting a mission is an AI command: the ink AI card. */}
        <Card family="ai" icon={Sparkles} title={tr('New mission')} subtitle={tr('Describe the objective; the orchestrator assigns it to the agents.')}>
          <div className="flex flex-col sm:flex-row gap-2">
            <Field
              className="flex-1"
              aria-label={tr('Mission objective')}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={tr('e.g. Investigate irrigation pressure in northern Qatar')}
              onKeyDown={(e) => e.key === 'Enter' && startMission()}
            />
            <Button onClick={startMission} disabled={running || !objective.trim()}>
              {running ? (
                <span role="status" className="inline-flex"><LatticeLoader className="text-cream scale-50" label={tr('Starting')} /></span>
              ) : (
                <Play strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
              )}
              {tr('Start mission')}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card icon={Cpu} title={tr('Active missions')} actions={<StatusTag level="progress" label={String(active.length)} />}>
            {active.length === 0 ? (
              <EmptyState compact title={tr('No active missions')} />
            ) : (
              active.map((m) => <MissionCard key={m.id} mission={m} />)
            )}
          </Card>

          <Card family="comando" icon={UserCheck} title={tr('Waiting for human')} actions={<StatusTag level="attention" label={String(waitingHuman.length)} />}>
            {waitingHuman.length === 0 ? (
              <EmptyState compact title={tr('No pending reviews')} />
            ) : (
              waitingHuman.map((m) => <MissionCard key={m.id} mission={m} showActions />)
            )}
          </Card>
        </div>

        <Card icon={Archive} title={tr('Recent outputs')} actions={<StatusTag level="good" label={String(completed.length)} />}>
          {missions.filter((m) => m.outputs.length > 0).length === 0 ? (
            <EmptyState compact title={tr('No outputs yet')} />
          ) : (
            missions.slice(0, 5).map((m) =>
              m.outputs.length > 0 ? (
                <div key={`out-${m.id}`} className="bg-card border border-line p-3.5" style={{ borderRadius: 'var(--radius-lg)' }}>
                  <p className="text-[12px] text-content-soft">{m.objective}</p>
                  {m.outputs.slice(-1).map((o) => (
                    <p key={o.id} className="mt-1.5 text-[14px] text-content">{o.title}</p>
                  ))}
                </div>
              ) : null
            )
          )}
        </Card>

        <Card icon={Users} title={tr('Available agents')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.values(AGENT_REGISTRY)
              .filter((a) => a.type !== 'orchestrator')
              .map((agent) => (
                <Tile key={agent.type}>
                  <div className="flex items-center gap-2">
                    <Bot strokeWidth={1.5} className="h-4 w-4 text-content-soft" />
                    <span className="text-[13px] text-content" style={{ fontWeight: 500 }}>{tr(agent.label)}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-content-soft leading-snug">{tr(agent.mission)}</p>
                </Tile>
              ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function MissionCard({ mission, showActions }: { mission: AgentMission; showActions?: boolean }) {
  const { tr, locale } = useI18n()
  const agentLabel = AGENT_REGISTRY[mission.assignedAgent]?.label
  return (
    <div className="bg-card border border-line p-4" style={{ borderRadius: 'var(--radius-lg)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[14px] text-content" style={{ fontWeight: 500 }}>{mission.objective}</p>
        <StatusTag level={STATUS_LEVEL[mission.status] || 'unknown'} label={tr(STATUS_LABEL[mission.status] ?? humanize(mission.status))} />
      </div>
      <p className="mt-1 text-[12px] text-content-soft">
        {agentLabel ? tr(agentLabel) : ''} · {tr('{count} agents', { count: mission.agentsInvolved.length })}
      </p>

      {mission.events.length > 0 && (
        <ol className="mt-3 border-t border-dotted border-line-strong pt-3 space-y-1.5">
          {mission.events.slice(-5).map((evt) => (
            <li key={evt.id} className="flex gap-3 text-[12px]">
              <span className="text-content-soft shrink-0 tabular-nums">{new Date(evt.timestamp).toLocaleTimeString(locale === 'ar' ? 'ar-QA' : [], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-content">{evt.title}</span>
            </li>
          ))}
        </ol>
      )}

      {showActions && mission.proposedActions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-content-soft">{tr('AI recommends')}</p>
          {mission.proposedActions.map((action) => (
            <Notice key={action.id} tone="warning" title={humanize(action.type)}>
              {action.reason}
              <span className="block mt-1 text-[11px]">{tr('Requires human approval')}</span>
            </Notice>
          ))}
        </div>
      )}
    </div>
  )
}
