'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, Trash2 } from 'lucide-react'
import type { GrowaAnalysisContext, GrowaChatMessage, GrowaModule } from '@/lib/ai/growa-types'
import { isHarvestGrowaContext } from '@/lib/ai/growa-types'
import { getGrowaPrompts } from '@/lib/ai/growa-prompts'
import { GrowaMarkdown } from '@/components/dashboard/growa-markdown'
import { IntelligencePanel } from '@/components/dashboard/intelligence-workspace-ui'
import { Textarea } from '@/components/ui/textarea'

interface GrowaIntelligencePanelProps {
  module: GrowaModule
  context: GrowaAnalysisContext | null
  disabled?: boolean
}

function contextSessionKey(context: GrowaAnalysisContext | null) {
  if (!context) return 'empty'

  if (isHarvestGrowaContext(context)) {
    return [
      context.module,
      context.view,
      context.mode,
      context.fieldDetail?.parcel_id ?? 'national',
      context.fieldDetail?.season_id ?? 'none',
    ].join(':')
  }

  return `${context.module}:${context.generatedAt.slice(0, 13)}`
}

export function GrowaIntelligencePanel({ module, context, disabled = false }: GrowaIntelligencePanelProps) {
  const promptOptions = useMemo(() => getGrowaPrompts(module, context), [module, context])
  const sessionKey = useMemo(() => contextSessionKey(context), [context])

  const [messages, setMessages] = useState<GrowaChatMessage[]>([])
  const [customInput, setCustomInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMessages([])
    setCustomInput('')
    setError(null)
  }, [sessionKey])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, loading])

  const sendMessage = useCallback(
    async (rawPrompt: string) => {
      const prompt = rawPrompt.trim()
      if (!context || !prompt || disabled || loading) return

      const userMessage: GrowaChatMessage = { role: 'user', content: prompt }
      const historyForApi = messages

      setMessages((current) => [...current, userMessage])
      setCustomInput('')
      setError(null)
      setLoading(true)

      try {
        const response = await fetch('/api/ai/growa/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            module,
            prompt,
            context,
            messages: historyForApi,
          }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || 'Growa analysis failed')
        }

        const analysis = typeof payload?.analysis === 'string' ? payload.analysis.trim() : ''
        if (!analysis) {
          throw new Error('Growa returned an empty response.')
        }

        setMessages((current) => [...current, { role: 'assistant', content: analysis }])
      } catch (analysisError) {
        setError(analysisError instanceof Error ? analysisError.message : 'Growa analysis failed')
        setMessages((current) => (current.at(-1)?.role === 'user' ? current.slice(0, -1) : current))
      } finally {
        setLoading(false)
      }
    },
    [context, disabled, loading, messages, module]
  )

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void sendMessage(customInput)
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(customInput)
    }
  }

  const canSend = Boolean(context && customInput.trim() && !disabled && !loading)

  const contextSummary = context
    ? isHarvestGrowaContext(context)
      ? `${context.headline.fieldCount} fields • ${context.headline.totalAreaHa.toLocaleString()} ha • ${context.headline.modeLabel}`
      : `${context.headline.cropCount} crops • ${context.headline.producerCount} producers • ${context.headline.trackedPolygons} polygons`
    : 'Waiting for operational data...'

  return (
    <IntelligencePanel
      title="Growa Assistant"
      subtitle="Chat in English with live dashboard context."
      icon={Bot}
      fillHeight
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Suggested prompts</p>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setError(null)
                  setCustomInput('')
                }}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-secondary/40 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Clear chat
              </button>
            ) : null}
          </div>
          <div className="max-h-[88px] overflow-y-auto overscroll-contain pr-1">
            <div className="flex flex-wrap gap-1.5">
              {promptOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled || loading || !context}
                  onClick={() => void sendMessage(option.prompt)}
                  className="rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={messagesContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border/80 bg-background/40 p-3 [scrollbar-gutter:stable]"
          onWheel={(event) => {
            event.stopPropagation()
          }}
          onTouchMove={(event) => {
            event.stopPropagation()
          }}
        >
          {messages.length === 0 && !loading ? (
            <div className="flex min-h-[120px] flex-col justify-center text-sm text-muted-foreground">
              <p>Ask a custom question or tap a suggested prompt to start the briefing.</p>
              <p className="mt-2 text-xs">{contextSummary}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[95%] rounded-xl border px-3 py-2.5 ${
                      message.role === 'user'
                        ? 'border-primary/30 bg-primary/15 text-foreground'
                        : 'border-border bg-card/80 text-foreground'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <GrowaMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Growa is analyzing...
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 space-y-1.5 border-t border-border/70 pt-2">
          <Textarea
            value={customInput}
            onChange={(event) => setCustomInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask a follow-up or type a custom question..."
            disabled={disabled || loading || !context}
            rows={2}
            className="min-h-[52px] resize-none border-border bg-background/70 text-sm"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Sending...' : messages.length === 0 ? 'Send message' : 'Send follow-up'}
          </button>
          <p className="text-[10px] leading-4 text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Enter to send, Shift+Enter for a new line.
          </p>
        </form>
      </div>
    </IntelligencePanel>
  )
}
