import { LessonTrack } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordBudgetUsage } from "@/lib/budget/service";
import { respondWithScopeGuard } from "@/lib/assistant/service";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";

export const runtime = "nodejs";

const requestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  track: z.nativeEnum(LessonTrack).default(LessonTrack.ENGLISH),
  locale: z.enum(["tr", "en"]).default("tr")
});

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Assistant response failed.";
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

      return NextResponse.json({ reply }, { status: 200 });
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
