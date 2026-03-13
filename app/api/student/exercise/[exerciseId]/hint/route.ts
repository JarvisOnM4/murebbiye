import { NextResponse } from "next/server";
import { z } from "zod";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import { getExerciseById, updateAttempt } from "@/lib/drawing-exercise/repository";
import { getNextHint } from "@/lib/drawing-exercise/service";
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
    "POST /api/student/exercise/[exerciseId]/hint",
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
          status: "in_progress",
        },
      });

      if (!attempt) {
        return NextResponse.json(
          { error: "Geçerli bir deneme bulunamadı." },
          { status: 404 }
        );
      }

      const exercise = await getExerciseById(exerciseId);
      if (!exercise) {
        return NextResponse.json({ error: "Egzersiz bulunamadı." }, { status: 404 });
      }

      const spec = exercise.templateSpec as ExerciseSpec;
      const matchedElements = (attempt.matchedElements ?? {}) as Record<
        string,
        ElementStatus
      >;

      const nextHint = getNextHint(spec, attempt.hintsUsed, matchedElements);

      if (!nextHint) {
        return NextResponse.json({ hint: null });
      }

      // Increment hintsUsed
      await updateAttempt(attemptId, {
        hintsUsed: attempt.hintsUsed + 1,
      });

      // Find element label for the hint
      const element = spec.elements.find((el) => el.id === nextHint.elementId);

      return NextResponse.json({
        hint: {
          elementId: nextHint.elementId,
          elementLabel: element?.labelTr ?? nextHint.elementId,
          highlightArea: nextHint.highlightArea,
          hintTextTr: nextHint.hintTextTr ?? null,
          hintTextEn: nextHint.hintTextEn ?? null,
        },
      });
    }
  );
}
