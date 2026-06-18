import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GrowaAnalyzeRequest } from './growa-types'
import { getGrowaModuleTitle } from './growa-prompts'
import { getModuleAnalysisFramework } from './growa-digest'

const DEFAULT_MODEL = 'gemini-3.5-flash'

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

function buildSystemInstruction(request: GrowaAnalyzeRequest) {
  const workspace = getGrowaModuleTitle(request.module)
  const framework = getModuleAnalysisFramework(request.module)

  return `You are Growa, the AI intelligence analyst for the Qatar government agricultural operations platform (Growa Qatar).

Audience: ministry officials, food security planners, and government operators.
Language: English only.
Workspace: ${workspace}.

Core rules:
1. Treat the OPERATIONAL DIGEST as the single source of truth. Never invent farms, crops, metrics, or policies unsupported by the digest.
2. Cite exact numbers from the digest when making claims (production tons, m³, kWh, scores, shares, ranks, producer names).
3. Name specific crops and producers from the digest when discussing risk or opportunity.
4. Separate facts (from digest) from interpretation (your analysis).
5. When data is missing, zero, or inconsistent (see DATA ALERTS), state the limitation and avoid overconfident conclusions.
6. Prioritize Qatar national food security, resource sustainability, and accountable producer oversight.
7. Keep the briefing concise, decision-ready, and structured.

${framework}

Output format (use these headings):
## Executive Summary
## Evidence From Current Data
## Risk Signals and Outliers
## Recommended Government Actions
## Monitoring KPIs and Data Gaps`
}

function buildUserMessage(request: GrowaAnalyzeRequest) {
  const digest = request.context.digest?.trim() || 'No digest available.'

  return `GOVERNMENT ANALYSIS REQUEST
${request.prompt.trim()}

OPERATIONAL DIGEST
${digest}

STRUCTURED DATA (for exact lookups)
${JSON.stringify(
    {
      headline: request.context.headline,
      rankings: request.context.rankings,
      alerts: request.context.alerts,
      crops: request.context.crops,
      topProducers: request.context.topProducers,
      atRiskProducers: request.context.atRiskProducers,
    },
    null,
    2
  )}

INSTRUCTIONS
- Answer the analysis request using the digest and structured data above.
- Quote at least 8 concrete metrics (with units) and at least 3 named crops/producers.
- Use DATA ALERTS to explain uncertainty or monitoring gaps.
- End with 3-5 measurable KPIs the government should track next cycle.`
}

export async function generateGrowaAnalysis(request: GrowaAnalyzeRequest): Promise<{
  analysis: string
  model: string
}> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.')
  }

  const modelName = getGeminiModel()
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemInstruction(request),
  })

  const result = await model.generateContent(buildUserMessage(request))
  const analysis = result.response.text().trim()

  if (!analysis) {
    throw new Error('Growa returned an empty analysis response.')
  }

  return { analysis, model: modelName }
}
