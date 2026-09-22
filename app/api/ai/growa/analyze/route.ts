import { createClient } from '@/lib/supabase/server'
import { generateGrowaAnalysis } from '@/lib/ai/growa'
import type { GrowaAnalyzeRequest, GrowaChatMessage, GrowaModule } from '@/lib/ai/growa-types'
import { NextResponse } from 'next/server'

const ALLOWED_MODULES = new Set<GrowaModule>([
  'data-analytics',
  'water-intelligence',
  'energy-intelligence',
  'harvest',
  'watchtower',
])

function isGrowaModule(value: unknown): value is GrowaModule {
  return typeof value === 'string' && ALLOWED_MODULES.has(value as GrowaModule)
}

function normalizePrompt(input: unknown) {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, 4000)
}

function normalizeMessages(input: unknown): GrowaChatMessage[] | undefined {
  if (!Array.isArray(input)) return undefined

  const messages = input
    .filter(
      (entry): entry is GrowaChatMessage =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        (entry.role === 'user' || entry.role === 'assistant') &&
        typeof entry.content === 'string' &&
        entry.content.trim().length > 0
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 12000),
    }))

  return messages.length > 0 ? messages : undefined
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as Partial<GrowaAnalyzeRequest>
  const growaModule = payload.module
  const prompt = normalizePrompt(payload.prompt)
  const context = payload.context
  const messages = normalizeMessages(payload.messages)

  if (!isGrowaModule(growaModule)) {
    return NextResponse.json({ error: 'Invalid or missing module' }, { status: 400 })
  }

  if (!prompt) {
    return NextResponse.json({ error: 'Analysis prompt is required' }, { status: 400 })
  }

  if (!context || typeof context !== 'object') {
    return NextResponse.json({ error: 'Operational context is required' }, { status: 400 })
  }

  try {
    const result = await generateGrowaAnalysis(
      {
        module: growaModule,
        prompt,
        context: {
          ...context,
          module: growaModule,
        },
        messages,
      },
      { request }
    )

    return NextResponse.json({
      analysis: result.analysis,
      model: result.model,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Growa analysis'
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
