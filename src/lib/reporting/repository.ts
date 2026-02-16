import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EmailStatus,
  QueueJobStatus,
  type ParentSummaryEmail,
  type QueueJob
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LessonInteractionInput,
  LessonMetrics,
  ParentSummaryQueueJob,
  ParentSummaryRecord,
  SupportedLocale
} from "@/lib/reporting/types";

type ParentSummaryQueuePayload = {
  parentSummaryId: string;
};

type FallbackInteractionRecord = {
  id: string;
  lessonId: string;
  actorRole: string;
  promptText: string;
  responseText: string;
  usedHint: boolean;
  isCorrect: boolean | null;
  outOfScopeQuery: boolean;
  responseMs: number | null;
  createdAt: string;
};

type FallbackMetricSnapshotRecord = {
  id: string;
  lessonId: string;
  accuracyRatio: number;
  hintDependency: number;
  repetitionPerformance: number;
  interactionQuality: number;
  timeManagement: number;
  createdAt: string;
};

type FallbackParentSummaryRecord = {
  id: string;
  lessonId: string;
  studentId: string;
  parentEmail: string;
  locale: SupportedLocale;
  subject: string;
  bodyText: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FallbackQueueJobRecord = {
  id: string;
  jobType: string;
  payload: ParentSummaryQueuePayload;
  runAt: string;
  status: QueueJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FallbackReportingIndex = {
  interactions: FallbackInteractionRecord[];
  metricSnapshots: FallbackMetricSnapshotRecord[];
  parentSummaries: FallbackParentSummaryRecord[];
  queueJobs: FallbackQueueJobRecord[];
};

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const FALLBACK_ROOT = path.join(STORAGE_ROOT, "fallback");
const FALLBACK_INDEX_FILE = path.join(FALLBACK_ROOT, "reporting-index.json");
const PARENT_SUMMARY_JOB_TYPE = "PARENT_SUMMARY_EMAIL";

function parseQueuePayload(payload: unknown): ParentSummaryQueuePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as { parentSummaryId?: unknown };

  if (typeof raw.parentSummaryId !== "string" || raw.parentSummaryId.length === 0) {
    return null;
  }

  return {
    parentSummaryId: raw.parentSummaryId
  };
}

function mapDbParentSummary(record: ParentSummaryEmail): ParentSummaryRecord {
  return {
    id: record.id,
    lessonId: record.lessonId,
    studentId: record.studentId,
    parentEmail: record.parentEmail,
    locale: record.locale === "en" ? "en" : "tr",
    subject: record.subject,
    bodyText: record.bodyText,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    queuedAt: record.queuedAt.toISOString(),
    sentAt: record.sentAt ? record.sentAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    persistence: "db"
  };
}

function mapFallbackParentSummary(record: FallbackParentSummaryRecord): ParentSummaryRecord {
  return {
    id: record.id,
    lessonId: record.lessonId,
    studentId: record.studentId,
    parentEmail: record.parentEmail,
    locale: record.locale,
    subject: record.subject,
    bodyText: record.bodyText,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    queuedAt: record.queuedAt,
    sentAt: record.sentAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    persistence: "fallback"
  };
}

function mapDbQueueJob(record: QueueJob): ParentSummaryQueueJob | null {
  const payload = parseQueuePayload(record.payload);

  if (!payload || record.jobType !== PARENT_SUMMARY_JOB_TYPE) {
    return null;
  }

  return {
    id: record.id,
    parentSummaryId: payload.parentSummaryId,
    status: record.status,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    runAt: record.runAt.toISOString(),
    lastError: record.lastError,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    persistence: "db"
  };
}

function mapFallbackQueueJob(record: FallbackQueueJobRecord): ParentSummaryQueueJob {
  return {
    id: record.id,
    parentSummaryId: record.payload.parentSummaryId,
    status: record.status,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    runAt: record.runAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    persistence: "fallback"
  };
}

async function ensureStorageStructure() {
  await fs.mkdir(FALLBACK_ROOT, { recursive: true });

  try {
    await fs.access(FALLBACK_INDEX_FILE);
  } catch {
    await fs.writeFile(
      FALLBACK_INDEX_FILE,
      JSON.stringify(
        {
          interactions: [],
          metricSnapshots: [],
          parentSummaries: [],
          queueJobs: []
        },
        null,
        2
      ),
      "utf-8"
    );
  }
}

async function readFallbackIndex(): Promise<FallbackReportingIndex> {
  await ensureStorageStructure();
  const raw = await fs.readFile(FALLBACK_INDEX_FILE, "utf-8");
  const parsed = JSON.parse(raw) as FallbackReportingIndex;

  return {
    interactions: parsed.interactions ?? [],
    metricSnapshots: parsed.metricSnapshots ?? [],
    parentSummaries: parsed.parentSummaries ?? [],
    queueJobs: parsed.queueJobs ?? []
  };
}

async function writeFallbackIndex(index: FallbackReportingIndex) {
  await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

function decimalValue(value: number) {
  return Number(value.toFixed(4));
}

export async function persistLessonAnalytics(input: {
  lessonId: string;
  interactions: LessonInteractionInput[];
  metrics: LessonMetrics;
}) {
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.lessonInteraction.deleteMany({
        where: {
          lessonId: input.lessonId
        }
      });

      if (input.interactions.length > 0) {
        await transaction.lessonInteraction.createMany({
          data: input.interactions.map((interaction) => ({
            lessonId: input.lessonId,
            actorRole: interaction.actorRole?.trim() || "STUDENT",
            promptText: interaction.promptText,
            responseText: interaction.responseText,
            usedHint: interaction.usedHint === true,
            isCorrect: typeof interaction.isCorrect === "boolean" ? interaction.isCorrect : null,
            outOfScopeQuery: interaction.outOfScopeQuery === true,
            responseMs:
              typeof interaction.responseMs === "number" && interaction.responseMs > 0
                ? Math.floor(interaction.responseMs)
                : null
          }))
        });
      }

      await transaction.lessonMetricSnapshot.upsert({
        where: {
          lessonId: input.lessonId
        },
        create: {
          lessonId: input.lessonId,
          accuracyRatio: decimalValue(input.metrics.accuracyRatio),
          hintDependency: decimalValue(input.metrics.hintDependency),
          repetitionPerformance: decimalValue(input.metrics.repetitionPerformance),
          interactionQuality: decimalValue(input.metrics.interactionQuality),
          timeManagement: decimalValue(input.metrics.timeManagement)
        },
        update: {
          accuracyRatio: decimalValue(input.metrics.accuracyRatio),
          hintDependency: decimalValue(input.metrics.hintDependency),
          repetitionPerformance: decimalValue(input.metrics.repetitionPerformance),
          interactionQuality: decimalValue(input.metrics.interactionQuality),
          timeManagement: decimalValue(input.metrics.timeManagement)
        }
      });
    });

    return {
      persistence: "db" as const
    };
  } catch {
    const index = await readFallbackIndex();
    const now = new Date().toISOString();

    index.interactions = index.interactions.filter((interaction) => interaction.lessonId !== input.lessonId);
    index.metricSnapshots = index.metricSnapshots.filter((snapshot) => snapshot.lessonId !== input.lessonId);

    index.interactions.push(
      ...input.interactions.map((interaction) => ({
        id: randomUUID(),
        lessonId: input.lessonId,
        actorRole: interaction.actorRole?.trim() || "STUDENT",
        promptText: interaction.promptText,
        responseText: interaction.responseText,
        usedHint: interaction.usedHint === true,
        isCorrect: typeof interaction.isCorrect === "boolean" ? interaction.isCorrect : null,
        outOfScopeQuery: interaction.outOfScopeQuery === true,
        responseMs:
          typeof interaction.responseMs === "number" && interaction.responseMs > 0
            ? Math.floor(interaction.responseMs)
            : null,
        createdAt: now
      }))
    );

    index.metricSnapshots.push({
      id: randomUUID(),
      lessonId: input.lessonId,
      accuracyRatio: input.metrics.accuracyRatio,
      hintDependency: input.metrics.hintDependency,
      repetitionPerformance: input.metrics.repetitionPerformance,
      interactionQuality: input.metrics.interactionQuality,
      timeManagement: input.metrics.timeManagement,
      createdAt: now
    });

    await writeFallbackIndex(index);

    return {
      persistence: "fallback" as const
    };
  }
}

export async function createParentSummaryEmailRecord(input: {
  lessonId: string;
  studentId: string;
  parentEmail: string;
  locale: SupportedLocale;
  subject: string;
  bodyText: string;
}): Promise<ParentSummaryRecord> {
  try {
    const created = await prisma.parentSummaryEmail.create({
      data: {
        lessonId: input.lessonId,
        studentId: input.studentId,
        parentEmail: input.parentEmail,
        locale: input.locale,
        subject: input.subject,
        bodyText: input.bodyText,
        status: EmailStatus.QUEUED,
        attempts: 0,
        lastError: null
      }
    });

    return mapDbParentSummary(created);
  } catch {
    const index = await readFallbackIndex();
    const now = new Date().toISOString();

    const record: FallbackParentSummaryRecord = {
      id: randomUUID(),
      lessonId: input.lessonId,
      studentId: input.studentId,
      parentEmail: input.parentEmail,
      locale: input.locale,
      subject: input.subject,
      bodyText: input.bodyText,
      status: EmailStatus.QUEUED,
      attempts: 0,
      lastError: null,
      queuedAt: now,
      sentAt: null,
      createdAt: now,
      updatedAt: now
    };

    index.parentSummaries.unshift(record);
    await writeFallbackIndex(index);
    return mapFallbackParentSummary(record);
  }
}

export async function enqueueParentSummaryEmailJob(
  parentSummaryId: string,
  runAt: Date,
  maxAttempts = 3
): Promise<ParentSummaryQueueJob> {
  try {
    const created = await prisma.queueJob.create({
      data: {
        jobType: PARENT_SUMMARY_JOB_TYPE,
        payload: {
          parentSummaryId
        },
        runAt,
        status: QueueJobStatus.PENDING,
        attempts: 0,
        maxAttempts,
        lastError: null
      }
    });

    const mapped = mapDbQueueJob(created);

    if (!mapped) {
      throw new Error("Queue payload could not be parsed.");
    }

    return mapped;
  } catch {
    const index = await readFallbackIndex();
    const now = new Date().toISOString();

    const record: FallbackQueueJobRecord = {
      id: randomUUID(),
      jobType: PARENT_SUMMARY_JOB_TYPE,
      payload: {
        parentSummaryId
      },
      runAt: runAt.toISOString(),
      status: QueueJobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      lastError: null,
      lockedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };

    index.queueJobs.unshift(record);
    await writeFallbackIndex(index);
    return mapFallbackQueueJob(record);
  }
}

export async function listParentSummaryEmailRecords(limit = 25): Promise<ParentSummaryRecord[]> {
  const records: ParentSummaryRecord[] = [];

  try {
    const dbRecords = await prisma.parentSummaryEmail.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      take: limit
    });

    records.push(...dbRecords.map(mapDbParentSummary));
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  records.push(...index.parentSummaries.map(mapFallbackParentSummary));

  const unique = new Map<string, ParentSummaryRecord>();

  for (const record of records) {
    unique.set(record.id, record);
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export async function getParentSummaryEmailRecord(
  summaryId: string
): Promise<ParentSummaryRecord | null> {
  try {
    const dbRecord = await prisma.parentSummaryEmail.findUnique({
      where: {
        id: summaryId
      }
    });

    if (dbRecord) {
      return mapDbParentSummary(dbRecord);
    }
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  const fallbackRecord = index.parentSummaries.find((record) => record.id === summaryId);
  return fallbackRecord ? mapFallbackParentSummary(fallbackRecord) : null;
}

export async function claimPendingParentSummaryJobs(limit = 10): Promise<ParentSummaryQueueJob[]> {
  const claimed: ParentSummaryQueueJob[] = [];

  try {
    const now = new Date();
    const candidates = await prisma.queueJob.findMany({
      where: {
        jobType: PARENT_SUMMARY_JOB_TYPE,
        status: QueueJobStatus.PENDING,
        runAt: {
          lte: now
        }
      },
      orderBy: {
        runAt: "asc"
      },
      take: limit
    });

    for (const candidate of candidates) {
      const updated = await prisma.queueJob.update({
        where: {
          id: candidate.id
        },
        data: {
          status: QueueJobStatus.RUNNING,
          attempts: {
            increment: 1
          },
          lockedAt: now
        }
      });

      const mapped = mapDbQueueJob(updated);

      if (mapped) {
        claimed.push(mapped);
      }
    }

    if (claimed.length > 0) {
      return claimed;
    }
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  const now = new Date();
  const nowIso = now.toISOString();

  const candidates = index.queueJobs
    .filter(
      (record) =>
        record.jobType === PARENT_SUMMARY_JOB_TYPE &&
        record.status === QueueJobStatus.PENDING &&
        Date.parse(record.runAt) <= now.getTime()
    )
    .sort((left, right) => Date.parse(left.runAt) - Date.parse(right.runAt))
    .slice(0, limit);

  for (const candidate of candidates) {
    candidate.status = QueueJobStatus.RUNNING;
    candidate.attempts += 1;
    candidate.lockedAt = nowIso;
    candidate.updatedAt = nowIso;
    claimed.push(mapFallbackQueueJob(candidate));
  }

  if (candidates.length > 0) {
    await writeFallbackIndex(index);
  }

  return claimed;
}

export async function markParentSummarySent(summaryId: string): Promise<void> {
  try {
    await prisma.parentSummaryEmail.update({
      where: {
        id: summaryId
      },
      data: {
        status: EmailStatus.SENT,
        attempts: {
          increment: 1
        },
        lastError: null,
        sentAt: new Date()
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.parentSummaries.find((record) => record.id === summaryId);

    if (!target) {
      return;
    }

    const now = new Date().toISOString();
    target.status = EmailStatus.SENT;
    target.attempts += 1;
    target.lastError = null;
    target.sentAt = now;
    target.updatedAt = now;
    await writeFallbackIndex(index);
  }
}

export async function markParentSummaryRetry(summaryId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.parentSummaryEmail.update({
      where: {
        id: summaryId
      },
      data: {
        status: EmailStatus.QUEUED,
        attempts: {
          increment: 1
        },
        lastError: errorMessage
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.parentSummaries.find((record) => record.id === summaryId);

    if (!target) {
      return;
    }

    target.status = EmailStatus.QUEUED;
    target.attempts += 1;
    target.lastError = errorMessage;
    target.updatedAt = new Date().toISOString();
    await writeFallbackIndex(index);
  }
}

export async function markParentSummaryFailed(summaryId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.parentSummaryEmail.update({
      where: {
        id: summaryId
      },
      data: {
        status: EmailStatus.FAILED,
        attempts: {
          increment: 1
        },
        lastError: errorMessage
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.parentSummaries.find((record) => record.id === summaryId);

    if (!target) {
      return;
    }

    target.status = EmailStatus.FAILED;
    target.attempts += 1;
    target.lastError = errorMessage;
    target.updatedAt = new Date().toISOString();
    await writeFallbackIndex(index);
  }
}

export async function markQueueJobCompleted(jobId: string): Promise<void> {
  try {
    await prisma.queueJob.update({
      where: {
        id: jobId
      },
      data: {
        status: QueueJobStatus.COMPLETED,
        completedAt: new Date(),
        lockedAt: null,
        lastError: null
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.queueJobs.find((record) => record.id === jobId);

    if (!target) {
      return;
    }

    const now = new Date().toISOString();
    target.status = QueueJobStatus.COMPLETED;
    target.completedAt = now;
    target.lockedAt = null;
    target.lastError = null;
    target.updatedAt = now;
    await writeFallbackIndex(index);
  }
}

export async function markQueueJobRetry(
  jobId: string,
  errorMessage: string,
  runAt: Date
): Promise<void> {
  try {
    await prisma.queueJob.update({
      where: {
        id: jobId
      },
      data: {
        status: QueueJobStatus.PENDING,
        runAt,
        lockedAt: null,
        lastError: errorMessage
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.queueJobs.find((record) => record.id === jobId);

    if (!target) {
      return;
    }

    target.status = QueueJobStatus.PENDING;
    target.runAt = runAt.toISOString();
    target.lockedAt = null;
    target.lastError = errorMessage;
    target.updatedAt = new Date().toISOString();
    await writeFallbackIndex(index);
  }
}

export async function markQueueJobFailed(jobId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.queueJob.update({
      where: {
        id: jobId
      },
      data: {
        status: QueueJobStatus.FAILED,
        completedAt: new Date(),
        lockedAt: null,
        lastError: errorMessage
      }
    });
    return;
  } catch {
    const index = await readFallbackIndex();
    const target = index.queueJobs.find((record) => record.id === jobId);

    if (!target) {
      return;
    }

    const now = new Date().toISOString();
    target.status = QueueJobStatus.FAILED;
    target.completedAt = now;
    target.lockedAt = null;
    target.lastError = errorMessage;
    target.updatedAt = now;
    await writeFallbackIndex(index);
  }
}
