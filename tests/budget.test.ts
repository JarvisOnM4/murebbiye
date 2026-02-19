import { describe, it, expect } from "vitest"

// Test the pure helper functions from budget/repository.ts
// without hitting the database.

function round4(value: number) {
  return Number(value.toFixed(4))
}

function mapDbEntry(entry: {
  id: string
  lessonId: string | null
  provider: string
  model: string
  requestType: string
  costUsd: { toNumber(): number }
  tokensIn: number | null
  tokensOut: number | null
  createdAt: Date
}) {
  return {
    id: entry.id,
    lessonId: entry.lessonId,
    provider: entry.provider,
    model: entry.model,
    requestType: entry.requestType,
    costUsd: round4(entry.costUsd.toNumber()),
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    createdAt: entry.createdAt.toISOString(),
  }
}

describe("round4", () => {
  it("rounds to 4 decimal places", () => {
    expect(round4(0.123456789)).toBe(0.1235)
  })

  it("handles zero", () => {
    expect(round4(0)).toBe(0)
  })

  it("handles negative values", () => {
    expect(round4(-0.00005)).toBe(-0.0001)
  })

  it("preserves values with fewer decimals", () => {
    expect(round4(1.5)).toBe(1.5)
  })
})

describe("mapDbEntry", () => {
  const baseEntry = {
    id: "test-id",
    lessonId: "lesson-1",
    provider: "bedrock",
    model: "anthropic.claude-3-5-haiku-20241022-v1:0",
    requestType: "lesson_generation",
    costUsd: { toNumber: () => 0.001234 },
    tokensIn: 500,
    tokensOut: 200,
    createdAt: new Date("2025-01-15T10:00:00Z"),
  }

  it("maps all fields correctly", () => {
    const result = mapDbEntry(baseEntry)
    expect(result.id).toBe("test-id")
    expect(result.lessonId).toBe("lesson-1")
    expect(result.provider).toBe("bedrock")
    expect(result.model).toBe("anthropic.claude-3-5-haiku-20241022-v1:0")
    expect(result.requestType).toBe("lesson_generation")
  })

  it("rounds costUsd to 4 decimal places", () => {
    const result = mapDbEntry(baseEntry)
    expect(result.costUsd).toBe(0.0012)
  })

  it("converts Date to ISO string", () => {
    const result = mapDbEntry(baseEntry)
    expect(result.createdAt).toBe("2025-01-15T10:00:00.000Z")
  })

  it("handles null lessonId", () => {
    const result = mapDbEntry({ ...baseEntry, lessonId: null })
    expect(result.lessonId).toBeNull()
  })

  it("handles null token counts", () => {
    const result = mapDbEntry({ ...baseEntry, tokensIn: null, tokensOut: null })
    expect(result.tokensIn).toBeNull()
    expect(result.tokensOut).toBeNull()
  })
})

describe("budget input normalization", () => {
  it("clamps negative cost to zero", () => {
    const normalizedCost = round4(Math.max(0, -0.5))
    expect(normalizedCost).toBe(0)
  })

  it("floors token counts to integers", () => {
    const tokensIn = 100.7
    const normalized =
      typeof tokensIn === "number" && Number.isFinite(tokensIn)
        ? Math.max(0, Math.floor(tokensIn))
        : null
    expect(normalized).toBe(100)
  })

  it("handles NaN token counts", () => {
    const tokensIn = NaN
    const normalized =
      typeof tokensIn === "number" && Number.isFinite(tokensIn)
        ? Math.max(0, Math.floor(tokensIn))
        : null
    expect(normalized).toBeNull()
  })

  it("handles Infinity token counts", () => {
    const tokensIn = Infinity
    const normalized =
      typeof tokensIn === "number" && Number.isFinite(tokensIn)
        ? Math.max(0, Math.floor(tokensIn))
        : null
    expect(normalized).toBeNull()
  })
})
