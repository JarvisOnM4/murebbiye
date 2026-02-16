import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { completeLessonAndQueueSummary } from "@/lib/reporting/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const interactionSchema = z.object({
  actorRole: z.string().trim().min(1).max(40).optional(),
  promptText: z.string().trim().min(1).max(500),
  responseText: z.string().trim().min(1).max(1500),
  usedHint: z.boolean().optional(),
  isCorrect: z.boolean().optional(),
  outOfScopeQuery: z.boolean().optional(),
  responseMs: z.coerce.number().int().min(1).max(600000).optional()
});

const completeLessonSchema = z.object({
  lessonId: z.string().trim().min(1),
  locale: z.enum(["tr", "en"]).default("tr"),
  parentEmail: z.string().email().optional(),
  interactions: z.array(interactionSchema).min(1).max(80)
});

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Lesson completion failed.";
}

export async function POST(request: Request) {
  return withPerformanceMetric("POST /api/student/lessons/complete", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = completeLessonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    try {
      const result = await completeLessonAndQueueSummary({
        lessonId: parsed.data.lessonId,
        studentId: session.user.id,
        locale: parsed.data.locale,
        interactions: parsed.data.interactions,
        parentEmail: parsed.data.parentEmail
      });

      return NextResponse.json({ result }, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        {
          errors: [asErrorMessage(error)]
        },
        { status: 422 }
      );
    }
  });
}
