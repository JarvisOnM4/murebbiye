type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
}

type LlmCallInput = {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

type LlmCallOutput = {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// Cost rates per 1M tokens for known models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "claude-3-5-haiku-latest": { input: 0.25, output: 1.25 },
}

function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COSTS[model] ?? MODEL_COSTS["gpt-4o-mini"]
  return Number(((tokensIn * rates.input + tokensOut * rates.output) / 1_000_000).toFixed(6))
}

export async function callLlm(input: LlmCallInput): Promise<LlmCallOutput> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Media agent requires an LLM provider.")
  }

  const model = input.model ?? process.env.PRIMARY_MODEL_NAME ?? "gpt-4o-mini"

  const body: Record<string, unknown> = {
    model,
    messages: input.messages,
    max_tokens: input.maxTokens ?? 2048,
    temperature: input.temperature ?? 0.7,
  }

  if (input.jsonMode) {
    body.response_format = { type: "json_object" }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error (${response.status}): ${errorText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  }

  const tokensIn = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0

  return {
    content: data.choices[0]?.message?.content ?? "",
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
