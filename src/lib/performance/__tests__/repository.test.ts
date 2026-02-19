import { describe, it, expect, vi, beforeEach } from "vitest"

const mockCreate = vi.fn()
const mockFindMany = vi.fn()
const mockDeleteMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    performanceMetric: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}))

import {
  recordPerformanceMetric,
  summarizePerformance,
  resetPerformanceMetrics,
} from "@/lib/performance/repository"

describe("performance repository", () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockFindMany.mockReset()
    mockDeleteMany.mockReset()
  })

  describe("recordPerformanceMetric", () => {
    it("should call prisma.performanceMetric.create with correct data", async () => {
      mockCreate.mockResolvedValue({})

      await recordPerformanceMetric({
        routeName: "POST /api/student/assistant/respond",
        durationMs: 1234.5678,
        statusCode: 200,
      })

      expect(mockCreate).toHaveBeenCalledOnce()
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.data.routeName).toBe("POST /api/student/assistant/respond")
      expect(callArgs.data.durationMs).toBe(1234.57) // rounded to 2 decimal places
      expect(callArgs.data.statusCode).toBe(200)
    })

    it("should clamp negative duration to zero", async () => {
      mockCreate.mockResolvedValue({})

      await recordPerformanceMetric({
        routeName: "GET /api/health",
        durationMs: -50,
        statusCode: 200,
      })

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.data.durationMs).toBe(0)
    })
  })

  describe("summarizePerformance", () => {
    it("should return correct median and p95 from mock data", async () => {
      // Provide 10 records in ascending order (findMany orderBy: durationMs asc)
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      mockFindMany.mockResolvedValue(
        durations.map((d) => ({ durationMs: d }))
      )

      const summary = await summarizePerformance(60, 3000)

      expect(summary.count).toBe(10)
      // median = percentile(0.5) => index = floor(10 * 0.5) = 5 => durations[5] = 600
      expect(summary.medianMs).toBe(600)
      // p95 = percentile(0.95) => index = floor(10 * 0.95) = 9 => durations[9] = 1000
      expect(summary.p95Ms).toBe(1000)
      expect(summary.minMs).toBe(100)
      expect(summary.maxMs).toBe(1000)
      expect(summary.passesTarget).toBe(true)
    })

    it("should return zeros when no metrics exist", async () => {
      mockFindMany.mockResolvedValue([])

      const summary = await summarizePerformance(60, 3000)

      expect(summary.count).toBe(0)
      expect(summary.medianMs).toBe(0)
      expect(summary.p95Ms).toBe(0)
      expect(summary.passesTarget).toBe(true)
    })

    it("should fail target when median exceeds target", async () => {
      // All durations are above the 500ms target
      mockFindMany.mockResolvedValue([
        { durationMs: 600 },
        { durationMs: 700 },
        { durationMs: 800 },
      ])

      const summary = await summarizePerformance(60, 500)

      expect(summary.passesTarget).toBe(false)
    })
  })

  describe("resetPerformanceMetrics", () => {
    it("should call prisma.performanceMetric.deleteMany", async () => {
      mockDeleteMany.mockResolvedValue({ count: 5 })

      await resetPerformanceMetrics()

      expect(mockDeleteMany).toHaveBeenCalledOnce()
    })
  })
})
