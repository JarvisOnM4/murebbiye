import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("callLlm (via Zeus)", () => {
  let callLlm: typeof import("@/lib/media-agent/llm").callLlm
  let callLlmJson: typeof import("@/lib/media-agent/llm").callLlmJson
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    process.env.ZEUS_BASE_URL = "http://zeus-test:8080"
    process.env.ZEUS_API_KEY = "test-key"

    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const mod = await import("@/lib/media-agent/llm")
    callLlm = mod.callLlm
    callLlmJson = mod.callLlmJson
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ZEUS_BASE_URL
    delete process.env.ZEUS_API_KEY
  })

  it("should return parsed content from Zeus response", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "anthropic.claude-3-5-haiku-20241022-v1:0",
        choices: [{ message: { content: "Hello from Zeus" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    })

    const result = await callLlm({
      messages: [{ role: "user", content: "Hello" }],
    })

    expect(result.content).toBe("Hello from Zeus")
    expect(result.tokensIn).toBe(10)
    expect(result.tokensOut).toBe(5)
    expect(result.costUsd).toBeGreaterThan(0)

    // Verify fetch was called with correct URL and auth
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://zeus-test:8080/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    )
  })

  it("should parse JSON response via callLlmJson", async () => {
    const jsonPayload = { items: ["a", "b"], count: 2 }
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "anthropic.claude-3-5-haiku-20241022-v1:0",
        choices: [{ message: { content: JSON.stringify(jsonPayload) } }],
        usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
      }),
    })

    const result = await callLlmJson<{ items: string[]; count: number }>({
      messages: [{ role: "user", content: "Give me JSON" }],
    })

    expect(result.parsed.items).toEqual(["a", "b"])
    expect(result.parsed.count).toBe(2)
  })

  it("should throw on Zeus API error", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    })

    await expect(
      callLlm({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow("Zeus API error 500")
  })

  it("should throw when ZEUS_BASE_URL is not configured", async () => {
    delete process.env.ZEUS_BASE_URL
    vi.resetModules()
    const mod = await import("@/lib/media-agent/llm")

    await expect(
      mod.callLlm({ messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow("ZEUS_BASE_URL")
  })

  it("should send system messages correctly in OpenAI format", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "haiku",
        choices: [{ message: { content: "response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    })

    await callLlm({
      messages: [
        { role: "system", content: "You are a tutor." },
        { role: "user", content: "Hello" },
      ],
    })

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(callBody.messages[0]).toEqual({ role: "system", content: "You are a tutor." })
    expect(callBody.messages[1]).toEqual({ role: "user", content: "Hello" })
  })
})
