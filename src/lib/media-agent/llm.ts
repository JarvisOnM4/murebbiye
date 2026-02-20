type LlmMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type LlmCallInput = {
  messages: LlmMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
}

type LlmCallOutput = {
  content: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

// Cost rates per 1M tokens for known models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "anthropic.claude-3-5-haiku-20241022-v1:0": { input: 0.25, output: 1.25 },
  "anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 3.00, output: 15.00 },
  "haiku": { input: 0.25, output: 1.25 },
  "sonnet": { input: 3.00, output: 15.00 },
}

const DEFAULT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0"

export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS[DEFAULT_MODEL]
  return Number(((tokensIn * rates.input + tokensOut * rates.output) / 1_000_000).toFixed(6))
}

function getZeusConfig() {
  const baseUrl = process.env.ZEUS_BASE_URL
  const apiKey = process.env.ZEUS_API_KEY
  if (!baseUrl) {
    throw new Error("ZEUS_BASE_URL is not configured")
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey }
}

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? DEFAULT_MODEL
  const { baseUrl, apiKey } = getZeusConfig()

  // Build OpenAI-compatible messages array
  const messages: Array<{ role: string; content: string }> = []

  // Collect system messages into a single system message
  const systemMessages = input.messages.filter((m) => m.role === "system")
  const nonSystemMessages = input.messages.filter((m) => m.role !== "system")

  let systemPrompt = systemMessages.map((m) => m.content).join("\n\n")

  // For JSON mode, prepend JSON-only instruction to the system prompt
  if (input.jsonMode) {
    const jsonInstruction =
      "You must respond with valid JSON only. No markdown, no explanation, just the JSON object."
    systemPrompt = systemPrompt
      ? `${jsonInstruction}\n\n${systemPrompt}`
      : jsonInstruction
  }

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }

  for (const m of nonSystemMessages) {
    messages.push({ role: m.role, content: m.content })
  }

  // Call Zeus (OpenAI-compatible API)
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`Zeus API error ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    model: string
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const tokensIn = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0
  const content = data.choices?.[0]?.message?.content ?? ""

  return {
    content,
    model: data.model ?? model,
    tokensIn,
    tokensOut,
    costUsd: computeCost(model, tokensIn, tokensOut),
  }
}

// Convenience: call LLM and parse JSON response
export async function callLlmJson<T = Record<string, unknown>>(
  input: LlmCallInput
): Promise<{ parsed: T } & LlmCallOutput> {
  const result = await callLlm({ ...input, jsonMode: true })
  const parsed = JSON.parse(result.content) as T
  return { ...result, parsed }
}
