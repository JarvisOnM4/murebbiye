import { NextResponse } from "next/server";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import {
  getExerciseById,
  getActiveAttempt,
  createAttempt,
} from "@/lib/drawing-exercise/repository";
import type { ExerciseSpec, ExerciseElement, TemplateLayer } from "@/lib/drawing-exercise/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ exerciseId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return withPerformanceMetric(
    "POST /api/student/exercise/[exerciseId]/start",
    async () => {
      const identity = await getStudentIdentity();

      if (!identity) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const { exerciseId } = await context.params;

      const exercise = await getExerciseById(exerciseId);

      if (!exercise) {
        return NextResponse.json({ error: "Egzersiz bulunamadı." }, { status: 404 });
      }

      if (exercise.status !== "ACTIVE") {
        return NextResponse.json({ error: "Bu egzersiz şu anda aktif değil." }, { status: 403 });
      }

      // Get or create active attempt
      let attempt = await getActiveAttempt(exerciseId, identity.id);

      if (!attempt) {
        attempt = await createAttempt(exerciseId, identity.id);
      }

      const spec = exercise.templateSpec as ExerciseSpec;

      // Strip detectionHints from elements before returning to client
      const clientElements = spec.elements.map((el: ExerciseElement) => ({
        id: el.id,
        labelTr: el.labelTr,
        labelEn: el.labelEn,
        category: el.category,
        activatesLayers: el.activatesLayers,
        dependsOn: el.dependsOn,
      }));

      const clientLayers = spec.layers.map((layer: TemplateLayer) => ({
        id: layer.id,
        imageKey: layer.imageKey,
        zIndex: layer.zIndex,
        defaultVisible: layer.defaultVisible,
        mutuallyExclusive: layer.mutuallyExclusive,
      }));

      return NextResponse.json({
        attemptId: attempt.id,
        exercise: {
          id: exercise.id,
          slug: exercise.slug,
          titleTr: exercise.titleTr,
          titleEn: exercise.titleEn,
          descriptionTr: exercise.descriptionTr,
          targetImageKey: exercise.targetImageKey,
          maxAttempts: exercise.maxAttempts,
          elements: clientElements,
          layers: clientLayers,
        },
        attempt: {
          attemptCount: attempt.attemptCount,
          hintsUsed: attempt.hintsUsed,
          matchedElements: attempt.matchedElements,
          status: attempt.status,
        },
      });
    }
  );
}
