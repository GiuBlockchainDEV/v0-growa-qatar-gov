'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, Sparkles } from 'lucide-react'
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
  const [customPrompt, setCustomPrompt] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedOption =
    promptOptions.find((option) => option.id === selectedPromptId) ?? promptOptions[0] ?? null

  const activePrompt = customPrompt.trim() || selectedOption?.prompt || ''

  useEffect(() => {
    if (!promptOptions.some((option) => option.id === selectedPromptId)) {
      setSelectedPromptId(promptOptions[0]?.id ?? '')
    }
  }, [promptOptions, selectedPromptId])

  async function runAnalysis() {
    if (!context || !activePrompt.trim()) return

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
          prompt: activePrompt,
          context,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Growa analysis failed')
      }

      setAnalysis(typeof payload?.analysis === 'string' ? payload.analysis : '')
      setModel(typeof payload?.model === 'string' ? payload.model : '')
    } catch (analysisError) {
      setAnalysis('')
      setModel('')
      setError(analysisError instanceof Error ? analysisError.message : 'Growa analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#07f880]/25 bg-[#07f880]/[0.04] p-5 shadow-[inset_0_0_0_1px_rgba(7,248,128,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#07f880]/80">Growa AI Analyst</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Bot className="h-5 w-5 text-[#07f880]" />
            Government Intelligence Briefing
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Ask Growa to generate an English-language government analysis for{' '}
            <span className="text-foreground">{getGrowaModuleTitle(module)}</span> using the live
            operational dataset displayed on this page. Suggested prompts are pre-filled with current
            metrics from your dashboard.
          </p>
        </div>
        <div className="rounded-md border border-[#07f880]/30 bg-[#07f880]/10 px-3 py-1.5 text-xs text-[#07f880]">
          Powered by Gemini 2.5
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Suggested prompts</p>
        <div className="flex flex-wrap gap-2">
          {promptOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled || loading}
              onClick={() => {
                setSelectedPromptId(option.id)
                setCustomPrompt('')
              }}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                selectedPromptId === option.id && !customPrompt.trim()
                  ? 'border-[#07f880]/40 bg-[#07f880]/15 text-[#07f880]'
                  : 'border-border bg-card/70 text-foreground hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`growa-prompt-${module}`} className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Analysis prompt
        </label>
        <textarea
          id={`growa-prompt-${module}`}
          value={customPrompt || activePrompt}
          onChange={(event) => setCustomPrompt(event.target.value)}
          disabled={disabled || loading}
          rows={4}
          placeholder="Select a suggested prompt or write a custom government analysis request..."
          className="mt-2 w-full rounded-lg border border-border bg-card/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#07f880]/50 focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={disabled || loading || !context || !activePrompt.trim()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#07f880]/35 bg-[#07f880]/15 px-4 py-2 text-sm font-medium text-[#07f880] transition-colors hover:bg-[#07f880]/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Growa is analyzing...' : 'Run Growa Analysis'}
        </button>
        {context ? (
          <p className="text-xs text-muted-foreground">
            Dataset snapshot: {context.headline.cropCount} crops, {context.headline.producerCount} producers,{' '}
            {context.headline.trackedPolygons} polygons • top crop {context.headline.topCropByProduction || 'n/a'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Waiting for operational data...</p>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {analysis ? (
        <div className="mt-4 rounded-lg border border-border bg-card/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[#07f880]">Growa briefing</p>
            {model ? <p className="text-xs text-muted-foreground">Model: {model}</p> : null}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{analysis}</div>
        </div>
      ) : null}
    </div>
  )
}
