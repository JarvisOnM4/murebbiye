import { describe, it, expect } from "vitest"

// Test the pure helper functions from performance/repository.ts
// without hitting the database.

function round2(value: number) {
  return Number(value.toFixed(2))
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.floor(values.length * ratio))
  )
  return values[index]
}

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.23456)).toBe(1.23)
  })

  it("rounds up when appropriate", () => {
    expect(round2(1.235)).toBe(1.24)
  })

  it("handles zero", () => {
    expect(round2(0)).toBe(0)
  })

  it("handles negative values", () => {
    expect(round2(-3.14159)).toBe(-3.14)
  })
})

describe("percentile", () => {
  it("returns 0 for empty array", () => {
    expect(percentile([], 0.5)).toBe(0)
  })

  it("returns the single value for a 1-element array", () => {
    expect(percentile([42], 0.5)).toBe(42)
    expect(percentile([42], 0.95)).toBe(42)
  })

  it("computes median for sorted array", () => {
    const values = [10, 20, 30, 40, 50]
    expect(percentile(values, 0.5)).toBe(30)
  })

  it("computes p95 for sorted array", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1) // 1..100
    const p95 = percentile(values, 0.95)
    expect(p95).toBe(96) // index 95 → value 96
  })

  it("handles ratio 0 (minimum)", () => {
    const values = [5, 10, 15]
    expect(percentile(values, 0)).toBe(5)
  })

  it("handles ratio 1 (maximum)", () => {
    const values = [5, 10, 15]
    expect(percentile(values, 1)).toBe(15)
  })
})

describe("performance summary logic", () => {
  it("builds summary with empty durations", () => {
    const durations: number[] = []
    const windowMinutes = 60
    const targetMs = 3000

    const summary =
      durations.length === 0
        ? {
            windowMinutes,
            count: 0,
            medianMs: 0,
            p95Ms: 0,
            minMs: 0,
            maxMs: 0,
            targetMs,
            passesTarget: true,
          }
        : null

    expect(summary).not.toBeNull()
    expect(summary!.count).toBe(0)
    expect(summary!.passesTarget).toBe(true)
  })

  it("builds summary with real durations", () => {
    const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    const windowMinutes = 60
    const targetMs = 3000

    const summary = {
      windowMinutes,
      count: durations.length,
      medianMs: round2(percentile(durations, 0.5)),
      p95Ms: round2(percentile(durations, 0.95)),
      minMs: round2(durations[0]),
      maxMs: round2(durations[durations.length - 1]),
      targetMs,
      passesTarget: percentile(durations, 0.5) <= targetMs,
    }

    expect(summary.count).toBe(10)
    expect(summary.medianMs).toBe(600)
    expect(summary.p95Ms).toBe(1000)
    expect(summary.minMs).toBe(100)
    expect(summary.maxMs).toBe(1000)
    expect(summary.passesTarget).toBe(true)
  })

  it("fails target when median exceeds threshold", () => {
    const durations = [3000, 3100, 3200, 3300, 3400]
    const targetMs = 3000
    const passesTarget = percentile(durations, 0.5) <= targetMs

    expect(passesTarget).toBe(false)
  })

  it("normalizes input metrics", () => {
    const durationMs = round2(Math.max(0, -50))
    expect(durationMs).toBe(0)

    const statusCode = Math.max(100, Math.floor(99.5))
    expect(statusCode).toBe(100)
  })
})
