import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Bedrock SDK before importing the module
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const mockSend = vi.fn()
  return {
    BedrockRuntimeClient: vi.fn(() => ({ send: mockSend })),
    InvokeModelCommand: vi.fn((input: unknown) => input),
    __mockSend: mockSend,
  }
})

describe("callLlm", () => {
  let callLlm: typeof import("@/lib/media-agent/llm").callLlm
  let callLlmJson: typeof import("@/lib/media-agent/llm").callLlmJson
  let mockSend: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    process.env.AWS_REGION = "us-east-1"

    const sdk = await import("@aws-sdk/client-bedrock-runtime")
    mockSend = (sdk as unknown as { __mockSend: ReturnType<typeof vi.fn> }).__mockSend
    mockSend.mockReset()

    const mod = await import("@/lib/media-agent/llm")
    callLlm = mod.callLlm
    callLlmJson = mod.callLlmJson
  })

  it("should return parsed content from Bedrock response", async () => {
    const mockResponse = {
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ type: "text", text: "Hello from Bedrock" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "anthropic.claude-3-5-haiku-20241022-v1:0",
      })),
    }
    mockSend.mockResolvedValue(mockResponse)

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
    const mockResponse = {
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(jsonPayload) }],
        usage: { input_tokens: 15, output_tokens: 10 },
        model: "anthropic.claude-3-5-haiku-20241022-v1:0",
      })),
    }
    mockSend.mockResolvedValue(mockResponse)

    const result = await callLlmJson<{ items: string[]; count: number }>({
      messages: [{ role: "user", content: "Give me JSON" }],
    })

    expect(result.parsed.items).toEqual(["a", "b"])
    expect(result.parsed.count).toBe(2)
  })

  it("should throw on Bedrock error", async () => {
    mockSend.mockRejectedValue(new Error("Bedrock throttled"))

    await expect(
      callLlm({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow()
  })
})
