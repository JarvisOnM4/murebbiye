import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the budget repository
vi.mock("@/lib/budget/repository", () => ({
  createBudgetLedgerEntry: vi.fn(),
  listBudgetLedgerEntriesSince: vi.fn(),
  resetBudgetLedgerSince: vi.fn(),
}))

// Mock the env module so we control MONTHLY_CAP_USD and PER_LESSON_CAP_USD
vi.mock("@/lib/env", () => ({
  env: {
    MONTHLY_CAP_USD: 10,
    PER_LESSON_CAP_USD: 0.2,
  },
}))

// Mock @prisma/client to provide the BudgetMode enum
vi.mock("@prisma/client", () => ({
  BudgetMode: {
    NORMAL: "NORMAL",
    SHORT_RESPONSE_LOW_COST: "SHORT_RESPONSE_LOW_COST",
    REVIEW_ONLY: "REVIEW_ONLY",
  },
}))

// Mock pilot config used by resolveBudgetMode
vi.mock("@/config/pilot", () => ({
  pilotConfig: {
    budget: {
      monthlyCapUsd: 10,
      perLessonCapUsd: 0.2,
    },
  },
}))

describe("budget service", () => {
  let getBudgetStatus: typeof import("@/lib/budget/service").getBudgetStatus
  let assertBudgetAllowsGeneration: typeof import("@/lib/budget/service").assertBudgetAllowsGeneration
  let mockListEntries: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    const repo = await import("@/lib/budget/repository")
    mockListEntries = repo.listBudgetLedgerEntriesSince as ReturnType<typeof vi.fn>
    mockListEntries.mockReset()

    const mod = await import("@/lib/budget/service")
    getBudgetStatus = mod.getBudgetStatus
    assertBudgetAllowsGeneration = mod.assertBudgetAllowsGeneration
  })

  it("should return mode 'normal' when spend is under 80%", async () => {
    // $5 out of $10 cap = 50%
    mockListEntries.mockResolvedValue([
      { costUsd: 3 },
      { costUsd: 2 },
    ])

    const status = await getBudgetStatus(0.1)

    expect(status.mode).toBe("normal")
    expect(status.shouldBlockNewGeneration).toBe(false)
    expect(status.shortResponseMode).toBe(false)
    expect(status.monthlySpentUsd).toBe(5)
  })

  it("should return mode 'short_response_low_cost_model' at 80% threshold", async () => {
    // $8.5 out of $10 cap = 85%
    mockListEntries.mockResolvedValue([
      { costUsd: 5 },
      { costUsd: 3.5 },
    ])

    const status = await getBudgetStatus(0.1)

    expect(status.mode).toBe("short_response_low_cost_model")
    expect(status.shortResponseMode).toBe(true)
    expect(status.shouldBlockNewGeneration).toBe(false)
  })

  it("should return mode 'review_only' at 100% threshold", async () => {
    // $10.5 out of $10 cap = 105%
    mockListEntries.mockResolvedValue([
      { costUsd: 6 },
      { costUsd: 4.5 },
    ])

    const status = await getBudgetStatus(0.1)

    expect(status.mode).toBe("review_only")
    expect(status.shouldBlockNewGeneration).toBe(true)
  })

  it("should block generation when shouldBlockNewGeneration is true", async () => {
    // Over 100% budget
    mockListEntries.mockResolvedValue([
      { costUsd: 10.5 },
    ])

    await expect(assertBudgetAllowsGeneration(0.1)).rejects.toThrow(
      "Budget cap reached"
    )
  })
})
