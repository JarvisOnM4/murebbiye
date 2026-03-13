import { NextResponse } from "next/server";
import { z } from "zod";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import { getExerciseById, updateAttempt } from "@/lib/drawing-exercise/repository";
import { prisma } from "@/lib/prisma";
import type { ExerciseSpec } from "@/lib/drawing-exercise/types";
import type { ElementStatus } from "@/lib/drawing-exercise/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  attemptId: z.string().min(1),
});

type RouteContext = {
  params: Promise<{ exerciseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withPerformanceMetric(
    "POST /api/student/exercise/[exerciseId]/complete",
    async () => {
      const identity = await getStudentIdentity();

      if (!identity) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const body = await request.json().catch(() => ({}));
      const parsed = requestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { errors: parsed.error.issues.map((issue) => issue.message) },
          { status: 400 }
        );
      }

      const { exerciseId } = await context.params;
      const { attemptId } = parsed.data;

      // Verify attempt belongs to this student and exercise
      const attempt = await prisma.drawingAttempt.findFirst({
        where: {
          id: attemptId,
          exerciseId,
          studentId: identity.id,
        },
      });

      if (!attempt) {
        return NextResponse.json(
          { error: "Deneme bulunamadı." },
          { status: 404 }
        );
      }

      const exercise = await getExerciseById(exerciseId);
      if (!exercise) {
        return NextResponse.json({ error: "Egzersiz bulunamadı." }, { status: 404 });
      }

      // Mark as completed
      await updateAttempt(attemptId, {
        status: "completed",
        completedAt: new Date(),
      });

      const spec = exercise.templateSpec as ExerciseSpec;
      const totalElements = spec.elements.filter((e) => e.category === "required").length;

      const matchedElements = (attempt.matchedElements ?? {}) as Record<
        string,
        ElementStatus
      >;
      const matchedCount = spec.elements
        .filter((e) => e.category === "required")
        .filter((e) => matchedElements[e.id] === "present").length;

      return NextResponse.json({
        attemptCount: attempt.attemptCount,
        hintsUsed: attempt.hintsUsed,
        totalElements,
        matchedCount,
      });
    }
  );
}
