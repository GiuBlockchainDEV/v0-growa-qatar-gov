import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GrowaAnalyzeRequest } from './growa-types'
import { getGrowaModuleTitle } from './growa-prompts'

const DEFAULT_MODEL = 'gemini-2.5-flash'

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

function buildSystemInstruction(module: GrowaAnalyzeRequest['module']) {
  const workspace = getGrowaModuleTitle(module)

  return `You are Growa, the AI intelligence analyst for the Qatar government agricultural operations platform (Growa Qatar).

Your role is to produce clear, decision-ready analysis for government officials, ministry planners, and food security operators.

Rules:
- Always respond in English.
- Base your analysis strictly on the operational dataset provided in the user message.
- Do not invent farms, crops, metrics, or policy actions that are not supported by the data.
- Use a professional government briefing tone: concise, structured, and actionable.
- When data is limited or missing, state the limitation explicitly.
- Prioritize Qatar national food security, resource sustainability, and producer accountability.
- Format the response with short sections and bullet points where helpful.
- Current workspace: ${workspace}.`
}

function buildUserMessage(request: GrowaAnalyzeRequest) {
  return `Government analysis request:
${request.prompt.trim()}

Operational dataset (JSON):
${JSON.stringify(request.context, null, 2)}

Deliver a government-ready analysis with:
1. Executive summary (3-5 sentences)
2. Key findings grounded in the dataset
3. Risk signals and outliers
4. Recommended government actions (short-, medium-, and long-term)
5. Data gaps or monitoring needs`
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
    systemInstruction: buildSystemInstruction(request.module),
  })

  const result = await model.generateContent(buildUserMessage(request))
  const analysis = result.response.text().trim()

  if (!analysis) {
    throw new Error('Growa returned an empty analysis response.')
  }

  return { analysis, model: modelName }
}
