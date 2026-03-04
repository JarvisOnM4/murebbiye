import { describe, it, expect, vi, beforeEach } from "vitest"
import { computeCost } from "@/lib/media-agent/llm"

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const sendMock = vi.fn()
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
    ConverseCommand: vi.fn().mockImplementation((input) => ({ input })),
    __sendMock: sendMock,
  }
})

describe("callLlm (via Bedrock)", () => {
  let callLlm: typeof import("@/lib/media-agent/llm").callLlm
  let callLlmJson: typeof import("@/lib/media-agent/llm").callLlmJson
  let sendMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    process.env.AWS_REGION = "us-east-1"
    process.env.AWS_ACCESS_KEY_ID = "test-key-id"
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key"

    const bedrockMod = await import("@aws-sdk/client-bedrock-runtime")
    sendMock = (bedrockMod as unknown as { __sendMock: ReturnType<typeof vi.fn> }).__sendMock
    sendMock.mockReset()

    const mod = await import("@/lib/media-agent/llm")
    callLlm = mod.callLlm
    callLlmJson = mod.callLlmJson
  })

  it("should return parsed content from Bedrock response", async () => {
    sendMock.mockResolvedValue({
      output: { message: { content: [{ text: "Hello from Bedrock" }] } },
      usage: { inputTokens: 10, outputTokens: 5 },
    })

    const result = await callLlm({
      messages: [{ role: "user", content: "Hello" }],
    })

    expect(result.content).toBe("Hello from Bedrock")
    expect(result.tokensIn).toBe(10)
    expect(result.tokensOut).toBe(5)
    expect(result.costUsd).toBeGreaterThan(0)
  })

  it("should parse JSON response via callLlmJson", async () => {
    const jsonPayload = { items: ["a", "b"], count: 2 }
    sendMock.mockResolvedValue({
      output: { message: { content: [{ text: JSON.stringify(jsonPayload) }] } },
      usage: { inputTokens: 15, outputTokens: 10 },
    })

    const result = await callLlmJson<{ items: string[]; count: number }>({
      messages: [{ role: "user", content: "Give me JSON" }],
    })

    expect(result.parsed.items).toEqual(["a", "b"])
    expect(result.parsed.count).toBe(2)
  })

  it("should throw on Bedrock API error", async () => {
    sendMock.mockRejectedValue(new Error("Bedrock error: model not found"))

    await expect(
      callLlm({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow("Bedrock error")
  })
})

describe("computeCost", () => {
  it("should compute cost for known model", () => {
    const cost = computeCost("us.anthropic.claude-3-5-haiku-20241022-v1:0", 1000, 500)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.01)
  })

  it("should fallback to default rates for unknown model", () => {
    const cost = computeCost("unknown-model", 1000, 500)
    expect(cost).toBeGreaterThan(0)
  })
})
