import { LessonTrack } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordBudgetUsage } from "@/lib/budget/service";
import { respondWithScopeGuard } from "@/lib/assistant/service";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DAILY_QUESTION_LIMIT = 500;

const requestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  track: z.nativeEnum(LessonTrack).default(LessonTrack.ENGLISH),
  locale: z.enum(["tr", "en"]).default("tr")
});

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Assistant response failed.";
}

async function checkAndIncrementQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const date = todayDateString();

  const quota = await prisma.dailyQuota.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });

  const remaining = Math.max(0, DAILY_QUESTION_LIMIT - quota.count);
  return { allowed: quota.count <= DAILY_QUESTION_LIMIT, remaining };
}

export async function POST(request: Request) {
  return withPerformanceMetric("POST /api/student/assistant/respond", async () => {
    const identity = await getStudentIdentity();

    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    // Check daily quota
    const { allowed, remaining } = await checkAndIncrementQuota(identity.id);
    if (!allowed) {
      return NextResponse.json(
        {
          reply: {
            status: "OUT_OF_SCOPE",
            answer: "Bugünlük soru limitine ulaştın! Yarın tekrar gel, birlikte keşfetmeye devam ederiz.",
            references: [],
            suggestions: [],
            redirect: {
              recommendedAction: "RETURN_TO_CURRICULUM",
              suggestedPrompt: "Yarın tekrar dene!"
            },
            guardrail: {
              sourcePolicy: "curriculum_only",
              track: parsed.data.track,
              matchedTokenCount: 0,
              scannedChunks: 0
            }
          }
        },
        { status: 200 }
      );
    }

    try {
      const reply = await respondWithScopeGuard({
        studentId: identity.id,
        question: parsed.data.question,
        track: parsed.data.track,
        locale: parsed.data.locale
      });

      try {
        await recordBudgetUsage({
          provider: "internal",
          model: "scope-assistant",
          requestType: "assistant_response",
          costUsd: 0.01
        });
      } catch {
        // no-op
      }

      return NextResponse.json(
        { reply },
        {
          status: 200,
          headers: { "X-Daily-Remaining": String(remaining) }
        }
      );
    } catch (error) {
      return NextResponse.json(
        {
          errors: [toErrorMessage(error)]
        },
        { status: 422 }
      );
    }
  });
}
