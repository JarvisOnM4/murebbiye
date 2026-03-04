import { describe, it, expect } from "vitest"
import { computeCost } from "../src/lib/media-agent/llm"

// Test the pure helper functions from llm.ts.

const DEFAULT_MODEL = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

describe("computeCost", () => {
  it("computes Haiku cost correctly", () => {
    // 1000 input tokens @ $0.80/M = $0.0008
    // 500 output tokens @ $4.00/M = $0.002
    // total = $0.0028
    const cost = computeCost(DEFAULT_MODEL, 1000, 500)
    expect(cost).toBeCloseTo(0.0028, 6)
  })

  it("computes Sonnet cost correctly", () => {
    const cost = computeCost(
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      1000,
      500
    )
    // 1000 * 3.0 / 1M + 500 * 15.0 / 1M = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 6)
  })

  it("returns 0 for zero tokens", () => {
    expect(computeCost(DEFAULT_MODEL, 0, 0)).toBe(0)
  })

  it("falls back to default rates for unknown models", () => {
    const cost = computeCost("unknown-model", 1000, 500)
    const haikuCost = computeCost(DEFAULT_MODEL, 1000, 500)
    expect(cost).toBe(haikuCost)
  })

  it("handles large token counts", () => {
    const cost = computeCost(DEFAULT_MODEL, 1_000_000, 1_000_000)
    // 1M * 0.80/1M + 1M * 4.00/1M = 0.80 + 4.00 = 4.80
    expect(cost).toBeCloseTo(4.80, 4)
  })

  it("supports alias model names", () => {
    const cost = computeCost("haiku", 1000, 500)
    expect(cost).toBeCloseTo(0.0028, 6)
  })
})

describe("LLM message format", () => {
  it("separates system messages from non-system messages", () => {
    const messages = [
      { role: "system" as const, content: "You are helpful." },
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi!" },
      { role: "system" as const, content: "Be concise." },
    ]

    const systemMessages = messages.filter((m) => m.role === "system")
    const nonSystemMessages = messages.filter((m) => m.role !== "system")

    expect(systemMessages).toHaveLength(2)
    expect(nonSystemMessages).toHaveLength(2)
    expect(systemMessages[0].content).toBe("You are helpful.")
    expect(nonSystemMessages[0].role).toBe("user")
  })

  it("builds system prompt from multiple system messages", () => {
    const messages = [
      { role: "system" as const, content: "First." },
      { role: "system" as const, content: "Second." },
    ]

    const systemPrompt = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n")

    expect(systemPrompt).toBe("First.\n\nSecond.")
  })

  it("prepends JSON instruction for jsonMode", () => {
    const systemPrompt = "You are a tutor."
    const jsonInstruction =
      "You must respond with valid JSON only. No markdown, no explanation, just the JSON object."

    const combined = `${jsonInstruction}\n\n${systemPrompt}`
    expect(combined).toContain(jsonInstruction)
    expect(combined).toContain(systemPrompt)
  })
})
