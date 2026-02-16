import { LessonTrack } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { completeLessonById, getLessonDraftById } from "@/lib/lesson/service";
import { sendParentSummaryEmail } from "@/lib/reporting/mailer";
import {
  claimPendingParentSummaryJobs,
  createParentSummaryEmailRecord,
  enqueueParentSummaryEmailJob,
  getParentSummaryEmailRecord,
  listParentSummaryEmailRecords,
  markParentSummaryFailed,
  markParentSummaryRetry,
  markParentSummarySent,
  markQueueJobCompleted,
  markQueueJobFailed,
  markQueueJobRetry,
  persistLessonAnalytics
} from "@/lib/reporting/repository";
import { computeLessonMetrics } from "@/lib/reporting/scoring";
import { buildParentSummaryDraft } from "@/lib/reporting/template";
import type {
  CompleteLessonInput,
  CompleteLessonResult,
  ParentSummaryRecord,
  QueueDispatchResult,
  SupportedLocale
} from "@/lib/reporting/types";

const RETRY_BACKOFF_MS = 1000;

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown queue processing error.";
}

async function resolveStudentProfile(studentId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: studentId
      },
      select: {
        email: true,
        nickname: true,
        parentEmail: true
      }
    });

    if (user) {
      return {
        studentLabel: user.nickname || user.email || "Student",
        parentEmail: user.parentEmail
      };
    }
  } catch {
    // no-op fallback below
  }

  return {
    studentLabel: process.env.SEED_STUDENT_NICKNAME ?? "Student",
    parentEmail: process.env.SEED_STUDENT_PARENT_EMAIL ?? null
  };
}

function normalizeLocale(value: SupportedLocale) {
  return value === "en" ? "en" : "tr";
}

function normalizeTrack(track: LessonTrack) {
  return track === LessonTrack.AI_MODULE ? LessonTrack.AI_MODULE : LessonTrack.ENGLISH;
}

export async function completeLessonAndQueueSummary(
  input: CompleteLessonInput
): Promise<CompleteLessonResult> {
  const lesson = await getLessonDraftById(input.lessonId);

  if (!lesson) {
    throw new Error("Lesson draft not found.");
  }

  if (lesson.studentId !== input.studentId) {
    throw new Error("Lesson does not belong to the current student.");
  }

  const metrics = computeLessonMetrics(input.interactions);
  await persistLessonAnalytics({
    lessonId: input.lessonId,
    interactions: input.interactions,
    metrics
  });

  const completedLesson = await completeLessonById(input.lessonId);

  if (!completedLesson) {
    throw new Error("Lesson completion could not be persisted.");
  }

  const profile = await resolveStudentProfile(input.studentId);
  const parentEmail = input.parentEmail?.trim() || profile.parentEmail;

  if (!parentEmail) {
    throw new Error("Parent email is missing for this student.");
  }

  const locale = normalizeLocale(input.locale);
  const track = normalizeTrack(lesson.track);
  const summaryDraft = buildParentSummaryDraft({
    locale,
    track,
    studentLabel: profile.studentLabel,
    metrics
  });

  const parentSummary = await createParentSummaryEmailRecord({
    lessonId: input.lessonId,
    studentId: input.studentId,
    parentEmail,
    locale,
    subject: summaryDraft.subject,
    bodyText: summaryDraft.bodyText
  });

  const queueJob = await enqueueParentSummaryEmailJob(parentSummary.id, new Date(), 3);

  return {
    lessonId: input.lessonId,
    studentId: input.studentId,
    track,
    metrics,
    parentSummary,
    queueJob
  };
}

export async function listParentSummaryReports(limit = 25): Promise<ParentSummaryRecord[]> {
  return listParentSummaryEmailRecords(limit);
}

export async function dispatchParentSummaryQueue(limit = 10): Promise<QueueDispatchResult> {
  const jobs = await claimPendingParentSummaryJobs(limit);

  const result: QueueDispatchResult = {
    processed: jobs.length,
    sent: 0,
    retried: 0,
    failed: 0,
    items: []
  };

  for (const job of jobs) {
    const summary = await getParentSummaryEmailRecord(job.parentSummaryId);

    if (!summary) {
      const errorMessage = "Parent summary record not found for queued job.";
      await markQueueJobFailed(job.id, errorMessage);
      result.failed += 1;
      result.items.push({
        queueJobId: job.id,
        parentSummaryId: job.parentSummaryId,
        status: "FAILED",
        errorMessage
      });
      continue;
    }

    try {
      await sendParentSummaryEmail({
        to: summary.parentEmail,
        subject: summary.subject,
        bodyText: summary.bodyText
      });

      await markParentSummarySent(summary.id);
      await markQueueJobCompleted(job.id);

      result.sent += 1;
      result.items.push({
        queueJobId: job.id,
        parentSummaryId: job.parentSummaryId,
        status: "SENT",
        errorMessage: null
      });
    } catch (error) {
      const errorMessage = asErrorMessage(error);

      if (job.attempts < job.maxAttempts) {
        const nextRunAt = new Date(Date.now() + RETRY_BACKOFF_MS);
        await markParentSummaryRetry(summary.id, errorMessage);
        await markQueueJobRetry(job.id, errorMessage, nextRunAt);

        result.retried += 1;
        result.items.push({
          queueJobId: job.id,
          parentSummaryId: job.parentSummaryId,
          status: "RETRY_SCHEDULED",
          errorMessage
        });
      } else {
        await markParentSummaryFailed(summary.id, errorMessage);
        await markQueueJobFailed(job.id, errorMessage);

        result.failed += 1;
        result.items.push({
          queueJobId: job.id,
          parentSummaryId: job.parentSummaryId,
          status: "FAILED",
          errorMessage
        });
      }
    }
  }

  return result;
}
