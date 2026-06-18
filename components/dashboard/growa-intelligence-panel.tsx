'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import type { GrowaAnalysisContext, GrowaModule } from '@/lib/ai/growa-types'
import { getGrowaModuleTitle, getGrowaPrompts } from '@/lib/ai/growa-prompts'

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
    <div className="rounded-xl border border-[#07f880]/25 bg-[#07f880]/[0.04] p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.08)]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#07f880]/80">Growa AI Assistant</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Bot className="h-5 w-5 text-[#07f880]" />
          Government Intelligence Briefing
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Select a briefing type for{' '}
          <span className="text-foreground">{getGrowaModuleTitle(module)}</span>. Growa responds in
          English using the live operational dataset on this page.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Suggested prompts</p>
        <div className="flex flex-wrap gap-2">
          {promptOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled || loading || !context}
              onClick={() => runAnalysis(option.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedPromptId === option.id
                  ? 'border-[#07f880]/40 bg-[#07f880]/15 text-[#07f880]'
                  : 'border-border bg-card/70 text-foreground hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-[220px] rounded-lg border border-border bg-card/80 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[#07f880]">AI Assistant</p>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-[#07f880]" />
            Growa is preparing your briefing...
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : analysis ? (
          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{analysis}</div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {context
              ? 'Choose a suggested prompt above to generate a government-ready analysis.'
              : 'Waiting for operational data...'}
          </p>
        )}
      </div>
    </div>
  )
}
