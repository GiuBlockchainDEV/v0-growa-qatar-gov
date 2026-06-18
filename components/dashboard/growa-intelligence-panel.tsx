'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, Sparkles } from 'lucide-react'
import type { GrowaAnalysisContext, GrowaModule } from '@/lib/ai/growa-types'
import { getGrowaPrompts } from '@/lib/ai/growa-prompts'
import { GrowaMarkdown } from '@/components/dashboard/growa-markdown'
import { IntelligencePanel } from '@/components/dashboard/intelligence-workspace-ui'

interface GrowaIntelligencePanelProps {
  module: GrowaModule
  context: GrowaAnalysisContext | null
  disabled?: boolean
}

export function GrowaIntelligencePanel({ module, context, disabled = false }: GrowaIntelligencePanelProps) {
  const promptOptions = useMemo(() => getGrowaPrompts(module, context), [module, context])
  const [selectedPromptId, setSelectedPromptId] = useState(promptOptions[0]?.id ?? '')
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedOption =
    promptOptions.find((option) => option.id === selectedPromptId) ?? promptOptions[0] ?? null

  useEffect(() => {
    if (!promptOptions.some((option) => option.id === selectedPromptId)) {
      setSelectedPromptId(promptOptions[0]?.id ?? '')
    }
  }, [promptOptions, selectedPromptId])

  async function runAnalysis() {
    if (!context || !selectedOption?.prompt.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/growa/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          module,
          prompt: selectedOption.prompt,
          context,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Growa analysis failed')
      }

      setAnalysis(typeof payload?.analysis === 'string' ? payload.analysis : '')
    } catch (analysisError) {
      setAnalysis('')
      setError(analysisError instanceof Error ? analysisError.message : 'Growa analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const canRun = Boolean(context && selectedOption?.prompt.trim() && !disabled && !loading)

  return (
    <IntelligencePanel
      title="Growa Assistant"
      subtitle="Government briefing powered by live dashboard data."
      icon={Bot}
      className="h-full"
    >
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Suggested prompts</p>
        <div className="flex flex-wrap gap-2">
          {promptOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled || loading}
              onClick={() => {
                setSelectedPromptId(option.id)
                setError(null)
              }}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedPromptId === option.id
                  ? 'border-primary/40 bg-primary/15 text-primary'
                  : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={runAnalysis}
          disabled={!canRun}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generating briefing...' : 'Run AI Analysis'}
        </button>
      </div>

      <div className="mt-4 min-h-[280px] rounded-lg border border-border/80 bg-background/40 p-4">
        {loading ? (
          <div className="flex h-full min-h-[220px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Preparing briefing...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : analysis ? (
          <GrowaMarkdown content={analysis} />
        ) : (
          <div className="flex h-full min-h-[220px] flex-col justify-center text-sm text-muted-foreground">
            <p>Select a briefing type, then run the AI analysis to generate a formatted government report.</p>
            {context ? (
              <p className="mt-2 text-xs">
                {context.headline.cropCount} crops • {context.headline.producerCount} producers •{' '}
                {context.headline.trackedPolygons} polygons
              </p>
            ) : (
              <p className="mt-2 text-xs">Waiting for operational data...</p>
            )}
          </div>
        )}
      </div>
    </IntelligencePanel>
  )
}
