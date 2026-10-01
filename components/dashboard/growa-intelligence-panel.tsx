'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, Trash2 } from 'lucide-react'
import type { GrowaAnalysisContext, GrowaChatMessage, GrowaModule } from '@/lib/ai/growa-types'
import { isHarvestGrowaContext, isWatchtowerGrowaContext } from '@/lib/ai/growa-types'
import { getGrowaPrompts } from '@/lib/ai/growa-prompts'
import dynamic from 'next/dynamic'

/* react-markdown + remark only load once there is an answer to render. */
const GrowaMarkdown = dynamic(() => import('@/components/dashboard/growa-markdown').then((m) => m.GrowaMarkdown), {
  loading: () => <span className="text-[13px] text-content-soft">…</span>,
})
import { CardHeader } from '@/components/brand/layout'
import { LatticeLoader, StatusDot } from '@/components/brand/ui'
import { useI18n } from '@/lib/i18n'

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

  if (isWatchtowerGrowaContext(context)) {
    return [context.module, context.timeframe, context.generatedAt.slice(0, 13)].join(':')
  }

  return `${context.module}:${context.generatedAt.slice(0, 13)}`
}

export function GrowaIntelligencePanel({ module, context, disabled = false }: GrowaIntelligencePanelProps) {
  const { tr } = useI18n()
  const promptOptions = useMemo(() => getGrowaPrompts(module, context), [module, context])
  const [promptsHidden, setPromptsHidden] = useState(false)
  const sessionKey = useMemo(() => contextSessionKey(context), [context])

  const [messages, setMessages] = useState<GrowaChatMessage[]>([])
  const [customInput, setCustomInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      ? tr('{fields} fields · {area} ha · {mode}', {
          fields: context.headline.fieldCount,
          area: context.headline.totalAreaHa.toLocaleString(),
          mode: tr(context.headline.modeLabel),
        })
      : isWatchtowerGrowaContext(context)
        ? tr('{signals} signals · {domains} critical domains · {timeframe}', {
            signals: context.headline.signalCount,
            domains: context.headline.criticalDomains,
            timeframe: tr(context.timeframe),
          })
        : tr('{crops} crops · {producers} producers · {polygons} polygons', {
            crops: context.headline.cropCount,
            producers: context.headline.producerCount,
            polygons: context.headline.trackedPolygons,
          })
    : tr('Waiting for operational data…')

  /* The AI family of the Growa SaaS: ink header with cream voice and a
     cream icon tile, white body, messages told apart by SURFACE (the user
     on cream, Growa on white with a line) and by the small corner on the
     speaker's side — never by a neon colour. */
  return (
    <section
      data-famiglia="ai"
      className="growa flex h-full min-h-0 flex-col overflow-hidden bg-card border border-line"
      style={{ borderRadius: 'var(--radius-xl)' }}
    >
      <CardHeader
        icon={Bot}
        title={tr('Growa assistant')}
        subtitle={tr('Chat in English with live dashboard context.')}
        actions={
          messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setMessages([])
                setError(null)
                setCustomInput('')
              }}
              disabled={loading}
              className="w-8 h-8 inline-flex items-center justify-center rounded-pill bg-card text-content-soft hover:text-content transition-colors disabled:opacity-40"
              title={tr('Clear chat')}
              aria-label={tr('Clear chat')}
            >
              <Trash2 strokeWidth={1.5} className="h-4 w-4" />
            </button>
          ) : null
        }
      />

      <div className="g-card-corpo grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        {/* Suggested questions as in the SaaS assistant: a micro-label with
            "Hide", then bordered tiles two by two. Collapsed once the
            conversation starts, so the messages get the room. */}
        <div className="px-4 pt-3 pb-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="growa-eyebrow text-content-soft" style={{ fontSize: 11 }}>{tr('Suggested questions')}</span>
            <button
              type="button"
              onClick={() => setPromptsHidden((v) => !v)}
              className="text-[12px] text-content-soft hover:text-content transition-colors"
              aria-expanded={!promptsHidden}
            >
              {promptsHidden ? tr('Show') : tr('Hide')}
            </button>
          </div>
          {!promptsHidden && (
            <div className="max-h-[152px] overflow-y-auto overscroll-contain pe-1 grid grid-cols-1 @md:grid-cols-2 gap-2 sm:grid-cols-2">
              {promptOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled || loading || !context}
                  onClick={() => void sendMessage(option.prompt)}
                  className="bg-card border border-line px-3 py-2.5 text-start text-[13px] text-content leading-snug transition-colors hover:border-line-strong hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  {tr(option.label)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={messagesContainerRef}
          className="min-h-0 overflow-y-auto overscroll-y-contain bg-muted border-t border-line p-4 [scrollbar-gutter:stable]"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          aria-live="polite"
        >
          {messages.length === 0 && !loading ? (
            <div className="text-[13px] text-content-soft leading-[1.45]">
              <p>{tr('Ask a custom question or tap a suggested prompt to start the briefing.')}</p>
              <p className="mt-2 text-[12px]">{contextSummary}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => {
                const isUser = message.role === 'user'
                return (
                  <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[88%] px-4 py-2.5 text-content ${isUser ? 'bg-cream' : 'bg-card border border-line'}`}
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        borderStartEndRadius: isUser ? 'var(--radius-xs)' : 'var(--radius-lg)',
                        borderStartStartRadius: isUser ? 'var(--radius-lg)' : 'var(--radius-xs)',
                      }}
                    >
                      {message.role === 'assistant' ? (
                        <GrowaMarkdown content={message.content} />
                      ) : (
                        <p className="whitespace-pre-wrap text-[14px] leading-[1.5]">{message.content}</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {loading ? (
                <div className="flex items-center gap-3 text-[13px] text-content-soft">
                  <LatticeLoader className="text-ink scale-75" label={tr('Growa is analysing')} />
                  {tr('Growa is analysing…')}
                </div>
              ) : null}

              {error ? (
                <div role="alert" className="flex items-start gap-2 text-[13px] text-critical">
                  <StatusDot tone="critical" size={7} className="mt-1.5" />
                  {tr(error)}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-line px-4 py-3 space-y-2">
          <div className="flex items-end gap-2">
            <textarea
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={tr('Ask a follow-up or type a custom question…')}
              aria-label={tr('Message to Growa')}
              disabled={disabled || loading || !context}
              rows={2}
              className="flex-1 min-w-0 min-h-[44px] resize-none px-3 py-2 text-[14px] bg-card border border-line text-content placeholder:text-content-soft outline-none focus:border-sage transition-colors disabled:opacity-40"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="g-btn g-btn--primary shrink-0"
              style={{ height: 44, width: 44, padding: 0 }}
              title={messages.length === 0 ? tr('Send message') : tr('Send follow-up')}
              aria-label={messages.length === 0 ? tr('Send message') : tr('Send follow-up')}
            >
              {loading ? (
                <span role="status" aria-label={tr('Sending')}><LatticeLoader className="text-cream scale-50" label={tr('Sending')} /></span>
              ) : (
                <Send strokeWidth={1.5} className="h-4 w-4 rtl:-scale-x-100" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-content-soft">{tr('Enter to send, Shift+Enter for a new line.')}</p>
        </form>
      </div>
    </section>
  )
}
