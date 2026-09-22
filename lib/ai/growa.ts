import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import type { GrowaAnalyzeRequest } from './growa-types'
import { isHarvestGrowaContext, isWatchtowerGrowaContext } from './growa-types'
import { getGrowaModuleTitle } from './growa-prompts'
import { getModuleAnalysisFramework } from './growa-digest'

const DEFAULT_MODEL = 'gemini-3.5-flash'
const MAX_HISTORY_MESSAGES = 20

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

function buildSystemInstruction(request: GrowaAnalyzeRequest, isFollowUp: boolean) {
  const workspace = getGrowaModuleTitle(request.module)
  const framework = getModuleAnalysisFramework(request.module)
  const digest = request.context.digest?.trim() || 'No digest available.'

  const outputFormat = isFollowUp
    ? `For follow-up replies:
- Answer the user's question directly and concisely.
- Use markdown when helpful (lists, short headings).
- Cite digest metrics when relevant.
- Do not repeat the full briefing structure unless the user asks for it.`
    : `Output format (use these headings):
## Executive Summary
## Evidence From Current Data
## Risk Signals and Outliers
## Recommended Government Actions
## Monitoring KPIs and Data Gaps`

  return `You are Growa, the AI intelligence analyst for the Qatar government agricultural operations platform (Growa Qatar).

Audience: ministry officials, food security planners, and government operators.
Language: English only.
Workspace: ${workspace}.

Core rules:
1. Treat the OPERATIONAL DIGEST below as the single source of truth. Never invent farms, crops, fields, metrics, or policies unsupported by the digest.
2. Cite exact numbers from the digest when making claims (production tons, m³, kWh, scores, shares, ranks, producer/field names).
3. Name specific crops, producers, or fields from the digest when discussing risk or opportunity.
4. Separate facts (from digest) from interpretation (your analysis).
5. When data is missing, zero, or inconsistent (see DATA ALERTS), state the limitation and avoid overconfident conclusions.
6. Prioritize Qatar national food security, resource sustainability, and accountable producer oversight.
7. In conversation mode, remember prior turns and build on earlier answers without contradicting them.

${framework}

${outputFormat}

OPERATIONAL DIGEST (authoritative):
${digest}`
}

function buildStructuredData(request: GrowaAnalyzeRequest) {
  const context = request.context

  if (isHarvestGrowaContext(context)) {
    return {
      view: context.view,
      mode: context.mode,
      usingDemoData: context.usingDemoData,
      headline: context.headline,
      rankings: context.rankings,
      alerts: context.alerts,
      fields: context.fields,
      nationalMetrics: context.nationalMetrics,
      timeseries: context.timeseries,
      fieldDetail: context.fieldDetail,
    }
  }

  if (isWatchtowerGrowaContext(context)) {
    return {
      timeframe: context.timeframe,
      usingDemoData: context.usingDemoData,
      headline: context.headline,
      nationalStatus: context.nationalStatus,
      prioritySignals: context.prioritySignals,
      changes: context.changes,
      dataGaps: context.dataGaps,
    }
  }

  return {
    headline: context.headline,
    rankings: context.rankings,
    alerts: context.alerts,
    crops: context.crops,
    topProducers: context.topProducers,
    atRiskProducers: context.atRiskProducers,
  }
}

function buildFirstUserMessage(request: GrowaAnalyzeRequest) {
  const structuredData = buildStructuredData(request)

  const harvestInstructions = isHarvestGrowaContext(request.context)
    ? `- Quote at least 8 concrete Harvest metrics (with units) and at least 3 named fields when available.
- Explain whether the active mode is observed (current) or forecast (predict).
- If fieldDetail.raster is present and an image is attached, describe visible spatial patterns and relate them to KPI/trend data.
- Use DATA ALERTS (collecting fields, missing metrics, demo data) to explain uncertainty.`
    : `- Quote at least 8 concrete metrics (with units) and at least 3 named crops/producers.
- Use DATA ALERTS to explain uncertainty or monitoring gaps.`

  return `GOVERNMENT ANALYSIS REQUEST
${request.prompt.trim()}

STRUCTURED DATA (for exact lookups)
${JSON.stringify(structuredData, null, 2)}

INSTRUCTIONS
- Answer the analysis request using the operational digest in your system instructions and the structured data above.
${harvestInstructions}
- End with 3-5 measurable KPIs the government should track next cycle.`
}

async function fetchRasterImagePart(imageUrl: string, request?: Request): Promise<Part | null> {
  try {
    const resolvedUrl = imageUrl.startsWith('http')
      ? imageUrl
      : request
        ? new URL(imageUrl, request.url).toString()
        : imageUrl

    const response = await fetch(resolvedUrl, {
      headers: request?.headers.get('cookie')
        ? { cookie: request.headers.get('cookie') || '' }
        : undefined,
      cache: 'no-store',
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) return null

    return {
      inlineData: {
        mimeType: contentType.split(';')[0] || 'image/png',
        data: buffer.toString('base64'),
      },
    }
  } catch {
    return null
  }
}

async function buildRasterImageParts(
  request: GrowaAnalyzeRequest,
  options?: { request?: Request }
): Promise<Part[]> {
  if (!isHarvestGrowaContext(request.context)) return []

  const imageUrl = request.context.fieldDetail?.raster?.image_url
  if (!imageUrl) return []

  const imagePart = await fetchRasterImagePart(imageUrl, options?.request)
  if (!imagePart) return []

  return [
    {
      text:
        'Attached satellite raster image for the active field metric layer. Interpret visible spatial patterns in relation to the digest metrics.',
    },
    imagePart,
  ]
}

function normalizeHistory(messages: GrowaAnalyzeRequest['messages']) {
  if (!Array.isArray(messages)) return []

  return messages
    .filter(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 12000),
    }))
}

export async function generateGrowaAnalysis(
  request: GrowaAnalyzeRequest,
  options?: { request?: Request }
): Promise<{
  analysis: string
  model: string
}> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.')
  }

  const modelName = getGeminiModel()
  const client = new GoogleGenerativeAI(apiKey)
  const priorMessages = normalizeHistory(request.messages)
  const isFollowUp = priorMessages.length > 0

  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(request, isFollowUp),
  })

  let analysis = ''

  if (isFollowUp) {
    const history = priorMessages.map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(request.prompt.trim())
    analysis = result.response.text().trim()
  } else {
    const parts: Part[] = [{ text: buildFirstUserMessage(request) }, ...await buildRasterImageParts(request, options)]
    const result = await model.generateContent(parts)
    analysis = result.response.text().trim()
  }

  if (!analysis) {
    throw new Error('Growa returned an empty analysis response.')
  }

  return { analysis, model: modelName }
}
