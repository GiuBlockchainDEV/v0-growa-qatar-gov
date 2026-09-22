'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, Cpu, Play, RefreshCw, UserCheck } from 'lucide-react'
import type { AgentMission } from '@/lib/ai/agents/types'
import { AGENT_REGISTRY } from '@/lib/ai/agents/registry'
import { OperationalContextBanner } from '@/components/dashboard/operational-context-banner'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  queued: 'text-sky-300 bg-sky-500/10',
  running: 'text-[#07f880] bg-[#07f880]/10',
  waiting_for_human: 'text-amber-300 bg-amber-500/10',
  completed: 'text-white/70 bg-white/10',
  failed: 'text-red-300 bg-red-500/10',
}

export function AiMissionControlWorkspace() {
  const { t, locale } = useI18n()
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
      if (!res.ok) throw new Error(payload.error || 'Failed to start mission')
      if (payload.mission) {
        setMissions((current) => [payload.mission as AgentMission, ...current])
      }
      setObjective('')
      setUnavailable(Boolean(payload.unavailable))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start mission')
    } finally {
      setRunning(false)
    }
  }

  const active = missions.filter((m) => ['queued', 'running', 'waiting_for_agent'].includes(m.status))
  const waitingHuman = missions.filter((m) => m.status === 'waiting_for_human')
  const completed = missions.filter((m) => m.status === 'completed')

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050608] text-white">
      <header className="shrink-0 border-b border-white/10 px-5 py-4 pt-20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-[#07f880]" />
              <h1 className="text-lg font-semibold">
                {locale === 'ar' ? 'مركز مهام الذكاء الاصطناعي' : 'AI Mission Control'}
              </h1>
            </div>
            <p className="mt-1 text-xs text-white/45">
              {locale === 'ar'
                ? 'عمل مؤسسي محاكى بواسطة وكلاء متخصصين — يتطلب موافقة بشرية للإجراءات'
                : 'Simulated institutional work via specialist agents — human approval required for actions'}
            </p>
          </div>
          <button onClick={load} className="rounded border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
            <RefreshCw className={cn('h-3.5 w-3.5 inline', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="mt-3"><OperationalContextBanner /></div>
        {unavailable && (
          <p className="mt-2 text-xs text-amber-300">
            Migration 00029_agent_missions required for persistence.
          </p>
        )}
      </header>

      <div className="shrink-0 border-b border-white/10 px-5 py-3">
        <div className="flex gap-2">
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={locale === 'ar' ? 'مثال: تحقيق في ضغط الري في الشمال' : 'e.g. Investigate irrigation pressure in northern Qatar'}
            className="flex-1 rounded-lg border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#07f880]/40 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && startMission()}
          />
          <button
            onClick={startMission}
            disabled={running || !objective.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#07f880] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {locale === 'ar' ? 'بدء مهمة' : 'Start mission'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <Section title={locale === 'ar' ? 'مهام نشطة' : 'Active missions'} count={active.length}>
          {active.length === 0 ? (
            <Empty text={locale === 'ar' ? 'لا توجد مهام نشطة' : 'No active missions'} />
          ) : (
            active.map((m) => <MissionCard key={m.id} mission={m} />)
          )}
        </Section>

        <Section title={locale === 'ar' ? 'بانتظار المراجعة' : 'Waiting for human'} count={waitingHuman.length} icon={UserCheck}>
          {waitingHuman.length === 0 ? (
            <Empty text={locale === 'ar' ? 'لا توجد مراجعات معلقة' : 'No pending reviews'} />
          ) : (
            waitingHuman.map((m) => <MissionCard key={m.id} mission={m} showActions />)
          )}
        </Section>

        <Section title={locale === 'ar' ? 'مخرجات حديثة' : 'Recent outputs'} count={completed.length}>
          {missions.slice(0, 5).map((m) => (
            m.outputs.length > 0 ? (
              <div key={`out-${m.id}`} className="rounded-lg border border-white/10 bg-[#0a0d12] p-3">
                <p className="text-xs text-white/40">{m.objective}</p>
                {m.outputs.slice(-1).map((o) => (
                  <p key={o.id} className="mt-2 text-sm text-white/75">{o.title}</p>
                ))}
              </div>
            ) : null
          ))}
        </Section>

        <Section title={locale === 'ar' ? 'الوكلاء المتاحون' : 'Available agents'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(AGENT_REGISTRY)
              .filter((a) => a.type !== 'orchestrator')
              .map((agent) => (
                <div key={agent.type} className="rounded border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-[#07f880]" />
                    <span className="text-xs font-medium text-white">{agent.label}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/45">{agent.mission}</p>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, count, icon: Icon, children }: {
  title: string
  count?: number
  icon?: typeof Cpu
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}{count !== undefined ? ` (${count})` : ''}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-white/35 py-4 text-center rounded border border-dashed border-white/10">{text}</p>
}

function MissionCard({ mission, showActions }: { mission: AgentMission; showActions?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d12] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{mission.objective}</p>
        <span className={cn('rounded px-2 py-0.5 text-[9px] font-bold uppercase', STATUS_STYLE[mission.status] || STATUS_STYLE.queued)}>
          {mission.status.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-white/40">
        {AGENT_REGISTRY[mission.assignedAgent]?.label} · {mission.agentsInvolved.length} agents
      </p>

      {mission.events.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-3 space-y-1.5">
          {mission.events.slice(-5).map((evt) => (
            <div key={evt.id} className="flex gap-2 text-[10px] text-white/50">
              <span className="text-white/30 shrink-0">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-white/70">{evt.title}</span>
            </div>
          ))}
        </div>
      )}

      {showActions && mission.proposedActions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-300/80">AI recommends</p>
          {mission.proposedActions.map((action) => (
            <div key={action.id} className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="text-xs text-white/80">{action.type.replace(/_/g, ' ')}</p>
              <p className="text-[10px] text-white/50 mt-1">{action.reason}</p>
              <p className="text-[9px] text-white/35 mt-1">Requires human approval</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
