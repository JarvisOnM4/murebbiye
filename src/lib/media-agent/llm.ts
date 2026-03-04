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
}

const DEFAULT_MODEL = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

let _client: BedrockRuntimeClient | null = null

function getClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
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

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? DEFAULT_MODEL
  const client = getClient()

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
    model: response.metrics ? model : model,
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
