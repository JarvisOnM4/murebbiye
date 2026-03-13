import { NextResponse } from "next/server";
import { z } from "zod";
import { withPerformanceMetric } from "@/lib/performance/measure";
import { getStudentIdentity } from "@/lib/learner/identity";
import { checkRateLimit } from "@/lib/learner/rate-limit";
import {
  getExerciseById,
  getMessages,
  addMessage,
  updateAttempt,
} from "@/lib/drawing-exercise/repository";
import { analyzePrompt } from "@/lib/drawing-exercise/agent";
import {
  computeVisibleLayers,
  checkCompletion,
  mergeAnalysis,
} from "@/lib/drawing-exercise/service";
import { prisma } from "@/lib/prisma";
import type { ExerciseSpec } from "@/lib/drawing-exercise/types";
import type { ElementStatus } from "@/lib/drawing-exercise/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  attemptId: z.string().min(1),
  message: z.string().trim().min(3).max(300),
});

type RouteContext = {
  params: Promise<{ exerciseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withPerformanceMetric(
    "POST /api/student/exercise/[exerciseId]/message",
    async () => {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      const rateCheck = await checkRateLimit(ip, "exercise-message", 5, 30);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Çok hızlı yazıyorsun! Biraz bekle." },
          { status: 429 }
        );
      }

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
      const { attemptId, message } = parsed.data;

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

      // Check max attempts
      if (attempt.attemptCount >= exercise.maxAttempts) {
        return NextResponse.json(
          { error: "Maksimum deneme sayısına ulaştın." },
          { status: 403 }
        );
      }

      const spec = exercise.templateSpec as ExerciseSpec;

      // Get last 6 messages for context
      const allMessages = await getMessages(attemptId);
      const recentMessages = allMessages.slice(-6);

      // Save user message
      await addMessage(attemptId, "user", message);

      // Analyze prompt with agent
      let analysis;
      try {
        analysis = await analyzePrompt(spec, message, recentMessages);
      } catch (err) {
        console.error("[exercise/message] Agent error:", err);
        return NextResponse.json(
          {
            error:
              process.env.NODE_ENV === "production"
                ? "Bir hata oluştu. Lütfen tekrar deneyin."
                : "Agent analysis failed",
          },
          { status: 422 }
        );
      }

      // Merge with previous matched elements (sticky)
      const previousMatched = (attempt.matchedElements ?? {}) as Record<
        string,
        ElementStatus
      >;
      const mergedElements = mergeAnalysis(previousMatched, analysis.detectedElements);

      // Compute new attempt count
      const newAttemptCount = attempt.attemptCount + 1;

      // Compute visible layers
      const visibleLayers = computeVisibleLayers(spec, mergedElements);

      // Check completion
      const isComplete = checkCompletion(spec, mergedElements);
      const completedAt = isComplete ? new Date() : null;
      const newStatus = isComplete ? "completed" : "in_progress";

      // Save agent message with analysis
      await addMessage(
        attemptId,
        "assistant",
        analysis.message,
        analysis.detectedElements as unknown as Record<string, unknown>,
        analysis.costUsd
      );

      // Update attempt
      await updateAttempt(attemptId, {
        attemptCount: newAttemptCount,
        matchedElements: mergedElements as Record<string, string>,
        status: newStatus,
        completedAt,
      });

      return NextResponse.json({
        agentMessage: analysis.message,
        matchedElements: mergedElements,
        visibleLayers,
        isComplete,
        attemptCount: newAttemptCount,
      });
    }
  );
}
