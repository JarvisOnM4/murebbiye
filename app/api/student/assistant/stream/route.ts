import { LessonTrack } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordBudgetUsage } from "@/lib/budget/service";
import { streamWithScopeGuard } from "@/lib/assistant/stream";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import { checkRateLimit } from "@/lib/learner/rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DAILY_QUESTION_LIMIT = 500;

const requestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  track: z.nativeEnum(LessonTrack).default(LessonTrack.ENGLISH),
  locale: z.enum(["tr", "en"]).default("tr"),
  excludeSuggestions: z.array(z.string()).max(50).default([]),
});

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrementQuota(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const date = todayDateString();

  try {
    const quota = await prisma.dailyQuota.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, count: 1 },
      update: { count: { increment: 1 } },
    });

    const remaining = Math.max(0, DAILY_QUESTION_LIMIT - quota.count);
    return { allowed: quota.count <= DAILY_QUESTION_LIMIT, remaining };
  } catch {
    // DB error — fail closed
    return { allowed: false, remaining: 0 };
  }
}

export async function POST(request: Request) {
  return withPerformanceMetric(
    "POST /api/student/assistant/stream",
    async () => {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      const rateCheck = await checkRateLimit(ip, "assistant-respond", 10, 60);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Çok hızlı soruyorsun! Biraz bekle." },
          { status: 429 }
        );
      }

      const identity = await getStudentIdentity();

      if (!identity) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }

      const body = await request.json().catch(() => ({}));
      const parsed = requestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { errors: parsed.error.issues.map((issue) => issue.message) },
          { status: 400 }
        );
      }

      const { allowed, remaining } = await checkAndIncrementQuota(identity.id);
      if (!allowed) {
        return NextResponse.json(
          {
            reply: {
              status: "OUT_OF_SCOPE",
              answer:
                "Bugünlük soru limitine ulaştın! Yarın tekrar gel, birlikte keşfetmeye devam ederiz.",
              references: [],
              suggestions: [],
              redirect: {
                recommendedAction: "RETURN_TO_CURRICULUM",
                suggestedPrompt: "Yarın tekrar dene!",
              },
              guardrail: {
                sourcePolicy: "curriculum_only",
                track: parsed.data.track,
                matchedTokenCount: 0,
                scannedChunks: 0,
              },
            },
          },
          { status: 200 }
        );
      }

      try {
        const stream = await streamWithScopeGuard({
          studentId: identity.id,
          question: parsed.data.question,
          track: parsed.data.track,
          locale: parsed.data.locale,
          excludeSuggestions: parsed.data.excludeSuggestions,
        });

        try {
          await recordBudgetUsage({
            provider: "internal",
            model: "scope-assistant",
            requestType: "assistant_response",
            costUsd: 0.01,
          });
        } catch {
          // no-op
        }

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Daily-Remaining": String(remaining),
          },
        });
      } catch {
        return NextResponse.json(
          {
            errors: [
              process.env.NODE_ENV === "production"
                ? "Bir hata oluştu. Lütfen tekrar deneyin."
                : "Stream failed",
            ],
          },
          { status: 422 }
        );
      }
    }
  );
}
