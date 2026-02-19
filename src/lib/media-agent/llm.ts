import {
  BedrockRuntimeClient,
  InvokeModelCommand,
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

// Cost rates per 1M tokens for known Bedrock models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "anthropic.claude-3-5-haiku-20241022-v1:0": { input: 0.25, output: 1.25 },
  "anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 3.00, output: 15.00 },
}

const DEFAULT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0"

function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS[DEFAULT_MODEL]
  return Number(((tokensIn * rates.input + tokensOut * rates.output) / 1_000_000).toFixed(6))
}

// Module-level singleton client — avoids creating a new client per call
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
})

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? DEFAULT_MODEL

  // Extract system message from the messages array
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

  // Build the Anthropic Messages API body for Bedrock
  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: input.maxTokens ?? 2048,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: input.temperature ?? 0.7,
  }

  if (systemPrompt) {
    body.system = systemPrompt
  }

  const command = new InvokeModelCommand({
    modelId: model,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  })

  const response = await bedrockClient.send(command)

  // Decode the response body
  const rawBody = new TextDecoder().decode(response.body)
  const data = JSON.parse(rawBody) as {
    content: Array<{ type: string; text: string }>
    usage: { input_tokens: number; output_tokens: number }
    model?: string
  }

  const tokensIn = data.usage?.input_tokens ?? 0
  const tokensOut = data.usage?.output_tokens ?? 0

  // Extract text from the first content block
  const textContent = data.content?.find((c) => c.type === "text")?.text ?? ""

  return {
    content: textContent,
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
