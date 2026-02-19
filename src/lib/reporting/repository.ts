import {
  EmailStatus,
  QueueJobStatus,
  type ParentSummaryEmail,
  type QueueJob
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  LessonInteractionInput,
  LessonMetrics,
  ParentSummaryQueueJob,
  ParentSummaryRecord,
  SupportedLocale
} from "@/lib/reporting/types"

type ParentSummaryQueuePayload = {
  parentSummaryId: string
}

const PARENT_SUMMARY_JOB_TYPE = "PARENT_SUMMARY_EMAIL"

function parseQueuePayload(payload: unknown): ParentSummaryQueuePayload | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const raw = payload as { parentSummaryId?: unknown }

  if (typeof raw.parentSummaryId !== "string" || raw.parentSummaryId.length === 0) {
    return null
  }

  return {
    parentSummaryId: raw.parentSummaryId
  }
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
    updatedAt: record.updatedAt.toISOString()
  }
}

function mapDbQueueJob(record: QueueJob): ParentSummaryQueueJob | null {
  const payload = parseQueuePayload(record.payload)

  if (!payload || record.jobType !== PARENT_SUMMARY_JOB_TYPE) {
    return null
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
    updatedAt: record.updatedAt.toISOString()
  }
}

function decimalValue(value: number) {
  return Number(value.toFixed(4))
}

export async function persistLessonAnalytics(input: {
  lessonId: string
  interactions: LessonInteractionInput[]
  metrics: LessonMetrics
}) {
  await prisma.$transaction(async (transaction) => {
    await transaction.lessonInteraction.deleteMany({
      where: {
        lessonId: input.lessonId
      }
    })

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
      })
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
    })
  })
}

export async function createParentSummaryEmailRecord(input: {
  lessonId: string
  studentId: string
  parentEmail: string
  locale: SupportedLocale
  subject: string
  bodyText: string
}): Promise<ParentSummaryRecord> {
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
  })

  return mapDbParentSummary(created)
}

export async function enqueueParentSummaryEmailJob(
  parentSummaryId: string,
  runAt: Date,
  maxAttempts = 3
): Promise<ParentSummaryQueueJob> {
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
  })

  const mapped = mapDbQueueJob(created)

  if (!mapped) {
    throw new Error("Queue payload could not be parsed.")
  }

  return mapped
}

export async function listParentSummaryEmailRecords(limit = 25): Promise<ParentSummaryRecord[]> {
  const dbRecords = await prisma.parentSummaryEmail.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: limit
  })

  return dbRecords.map(mapDbParentSummary)
}

export async function getParentSummaryEmailRecord(
  summaryId: string
): Promise<ParentSummaryRecord | null> {
  const dbRecord = await prisma.parentSummaryEmail.findUnique({
    where: {
      id: summaryId
    }
  })

  if (!dbRecord) {
    return null
  }

  return mapDbParentSummary(dbRecord)
}

export async function claimPendingParentSummaryJobs(limit = 10): Promise<ParentSummaryQueueJob[]> {
  const claimed: ParentSummaryQueueJob[] = []
  const now = new Date()

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
  })

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
    })

    const mapped = mapDbQueueJob(updated)

    if (mapped) {
      claimed.push(mapped)
    }
  }

  return claimed
}

export async function markParentSummarySent(summaryId: string): Promise<void> {
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
  })
}

export async function markParentSummaryRetry(summaryId: string, errorMessage: string): Promise<void> {
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
  })
}

export async function markParentSummaryFailed(summaryId: string, errorMessage: string): Promise<void> {
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
  })
}

export async function markQueueJobCompleted(jobId: string): Promise<void> {
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
  })
}

export async function markQueueJobRetry(
  jobId: string,
  errorMessage: string,
  runAt: Date
): Promise<void> {
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
  })
}

export async function markQueueJobFailed(jobId: string, errorMessage: string): Promise<void> {
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
  })
}
