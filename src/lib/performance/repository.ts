import { randomUUID } from "node:crypto";

type PerformanceMetricRecord = {
  id: string;
  routeName: string;
  durationMs: number;
  statusCode: number;
  createdAt: string;
};

export type PerformanceSummary = {
  windowMinutes: number;
  count: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  targetMs: number;
  passesTarget: boolean;
};

const MAX_RECORDS = 2000;

const globalForPerformance = globalThis as unknown as {
  performanceRecords?: PerformanceMetricRecord[];
};

function getRecordsStore() {
  if (!globalForPerformance.performanceRecords) {
    globalForPerformance.performanceRecords = [];
  }

  return globalForPerformance.performanceRecords;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * ratio)));
  return values[index];
}

export async function recordPerformanceMetric(input: {
  routeName: string;
  durationMs: number;
  statusCode: number;
}) {
  const records = getRecordsStore();

  records.unshift({
    id: randomUUID(),
    routeName: input.routeName,
    durationMs: round2(Math.max(0, input.durationMs)),
    statusCode: Math.max(100, Math.floor(input.statusCode)),
    createdAt: new Date().toISOString()
  });

  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS);
  }
}

export async function summarizePerformance(windowMinutes = 60, targetMs = 3000): Promise<PerformanceSummary> {
  const records = getRecordsStore();
  const threshold = Date.now() - windowMinutes * 60 * 1000;
  const durations = records
    .filter((record) => Date.parse(record.createdAt) >= threshold)
    .map((record) => record.durationMs)
    .sort((left, right) => left - right);

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
    };
  }

  const medianMs = percentile(durations, 0.5);
  const p95Ms = percentile(durations, 0.95);
  const minMs = durations[0];
  const maxMs = durations[durations.length - 1];

  return {
    windowMinutes,
    count: durations.length,
    medianMs: round2(medianMs),
    p95Ms: round2(p95Ms),
    minMs: round2(minMs),
    maxMs: round2(maxMs),
    targetMs,
    passesTarget: medianMs <= targetMs
  };
}

export async function resetPerformanceMetrics() {
  globalForPerformance.performanceRecords = [];
}
