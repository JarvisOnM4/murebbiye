import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime"

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
  "us.anthropic.claude-3-5-haiku-20241022-v1:0": { input: 0.80, output: 4.00 },
  "anthropic.claude-3-5-haiku-20241022-v1:0": { input: 0.80, output: 4.00 },
  "us.anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 3.00, output: 15.00 },
  "anthropic.claude-3-haiku-20240307-v1:0": { input: 0.25, output: 1.25 },
  "haiku": { input: 0.80, output: 4.00 },
  "sonnet": { input: 3.00, output: 15.00 },
  // OpenRouter models
  "qwen/qwen3-235b-a22b-2507": { input: 0.07, output: 0.10 },
  "qwen/qwen3-next-80b-a3b-instruct:free": { input: 0, output: 0 },
  "z-ai/glm-4.5-air:free": { input: 0, output: 0 },
  "nvidia/nemotron-3-nano-30b-a3b:free": { input: 0, output: 0 },
  "deepseek/deepseek-v3.2": { input: 0.25, output: 0.40 },
}

const DEFAULT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0"
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-235b-a22b-2507"

// Provider detection: "openrouter" or "bedrock"
function getProvider(): string {
  return process.env.PRIMARY_MODEL_PROVIDER ?? "bedrock"
}

let _client: BedrockRuntimeClient | null = null

function getBedrockClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-west-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _client
}

export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS[DEFAULT_MODEL]
  return Number(((tokensIn * rates.input + tokensOut * rates.output) / 1_000_000).toFixed(6))
}

async function callOpenRouter(input: LlmCallInput, model: string): Promise<LlmCallOutput> {
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const messages = input.messages.map((m) => ({
    role: m.role,
    content: m.role === "system" && input.jsonMode
      ? `You must respond with valid JSON only. No markdown, no explanation, just the JSON object.\n\n${m.content}`
      : m.content,
  }))

  if (input.jsonMode && !input.messages.some((m) => m.role === "system")) {
    messages.unshift({
      role: "system",
      content: "You must respond with valid JSON only. No markdown, no explanation, just the JSON object.",
    })
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.7,
      stream: false,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  // Some free models (Nemotron, GLM) are reasoning models that put output
  // in content but may return null content when reasoning overflows.
  // Fall back to last reasoning detail text if content is empty.
  let content = data.choices?.[0]?.message?.content ?? ""
  if (!content) {
    const reasoning = data.choices?.[0]?.message?.reasoning_details ?? data.choices?.[0]?.message?.reasoning
    if (typeof reasoning === "string" && reasoning.length > 0) {
      content = reasoning
    } else if (Array.isArray(reasoning)) {
      const last = reasoning[reasoning.length - 1]
      content = last?.text ?? ""
    }
  }
  const tokensIn = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0

  return {
    content,
    model,
    tokensIn,
    tokensOut,
    costUsd: computeCost(model, tokensIn, tokensOut),
  }
}

async function callBedrock(input: LlmCallInput, model: string): Promise<LlmCallOutput> {
  const client = getBedrockClient()

  const systemMessages = input.messages.filter((m) => m.role === "system")
  const nonSystemMessages = input.messages.filter((m) => m.role !== "system")

  let systemPrompt = systemMessages.map((m) => m.content).join("\n\n")

  if (input.jsonMode) {
    const jsonInstruction =
      "You must respond with valid JSON only. No markdown, no explanation, just the JSON object."
    systemPrompt = systemPrompt
      ? `${jsonInstruction}\n\n${systemPrompt}`
      : jsonInstruction
  }

  const system: SystemContentBlock[] = systemPrompt
    ? [{ text: systemPrompt }]
    : []

  const messages: Message[] = nonSystemMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: [{ text: m.content }],
  }))

  const command = new ConverseCommand({
    modelId: model,
    system,
    messages,
    inferenceConfig: {
      maxTokens: input.maxTokens ?? 2048,
      temperature: input.temperature ?? 0.7,
    },
  })

  const response = await client.send(command)

  const tokensIn = response.usage?.inputTokens ?? 0
  const tokensOut = response.usage?.outputTokens ?? 0
  const content =
    response.output?.message?.content?.[0]?.text ?? ""

  return {
    content,
    model,
    tokensIn,
    tokensOut,
    costUsd: computeCost(model, tokensIn, tokensOut),
  }
}

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const provider = getProvider()

  if (provider === "openrouter") {
    const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? DEFAULT_OPENROUTER_MODEL
    return callOpenRouter(input, model)
  }

  const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? DEFAULT_MODEL
  return callBedrock(input, model)
}

// Convenience: call LLM and parse JSON response
export async function callLlmJson<T = Record<string, unknown>>(
  input: LlmCallInput
): Promise<{ parsed: T } & LlmCallOutput> {
  const result = await callLlm({ ...input, jsonMode: true })
  const parsed = JSON.parse(result.content) as T
  return { ...result, parsed }
}
