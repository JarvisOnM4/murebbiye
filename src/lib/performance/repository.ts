import { prisma } from "@/lib/prisma"

export type PerformanceSummary = {
  windowMinutes: number
  count: number
  medianMs: number
  p95Ms: number
  minMs: number
  maxMs: number
  targetMs: number
  passesTarget: boolean
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * ratio)))
  return values[index]
}

export async function recordPerformanceMetric(input: {
  routeName: string
  durationMs: number
  statusCode: number
}) {
  await prisma.performanceMetric.create({
    data: {
      routeName: input.routeName,
      durationMs: round2(Math.max(0, input.durationMs)),
      statusCode: Math.max(100, Math.floor(input.statusCode))
    }
  })
}

export async function summarizePerformance(windowMinutes = 60, targetMs = 3000): Promise<PerformanceSummary> {
  const threshold = new Date(Date.now() - windowMinutes * 60 * 1000)

  const records = await prisma.performanceMetric.findMany({
    where: { createdAt: { gte: threshold } },
    select: { durationMs: true },
    orderBy: { durationMs: "asc" }
  })

  const durations = records.map((r) => r.durationMs)

  if (durations.length === 0) {
    return {
      windowMinutes,
      count: 0,
      medianMs: 0,
      p95Ms: 0,
      minMs: 0,
      maxMs: 0,
      targetMs,
      passesTarget: true
    }
  }

  return {
    windowMinutes,
    count: durations.length,
    medianMs: round2(percentile(durations, 0.5)),
    p95Ms: round2(percentile(durations, 0.95)),
    minMs: round2(durations[0]),
    maxMs: round2(durations[durations.length - 1]),
    targetMs,
    passesTarget: percentile(durations, 0.5) <= targetMs
  }
}

export async function resetPerformanceMetrics() {
  await prisma.performanceMetric.deleteMany()
}
