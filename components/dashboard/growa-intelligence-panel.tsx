'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import type { GrowaAnalysisContext, GrowaModule } from '@/lib/ai/growa-types'
import { getGrowaPrompts } from '@/lib/ai/growa-prompts'
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

  useEffect(() => {
    if (!promptOptions.some((option) => option.id === selectedPromptId)) {
      setSelectedPromptId(promptOptions[0]?.id ?? '')
    }
  }, [promptOptions, selectedPromptId])

  async function runAnalysis(promptId: string) {
    const option = promptOptions.find((entry) => entry.id === promptId)
    if (!context || !option?.prompt.trim()) return

    setSelectedPromptId(promptId)
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
          prompt: option.prompt,
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

  return (
    <IntelligencePanel
      title="Growa Assistant"
      subtitle="Government briefing powered by live dashboard data."
      icon={Bot}
      className="h-full"
    >
      <div className="flex flex-wrap gap-2">
        {promptOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled || loading || !context}
            onClick={() => runAnalysis(option.id)}
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

      <div className="mt-4 min-h-[280px] rounded-lg border border-border/80 bg-background/40 p-4">
        {loading ? (
          <div className="flex h-full min-h-[220px] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Preparing briefing...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : analysis ? (
          <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{analysis}</div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col justify-center text-sm text-muted-foreground">
            <p>Select a briefing type to generate an English government analysis from the metrics on this page.</p>
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
