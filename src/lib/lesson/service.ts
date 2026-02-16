import { randomUUID } from "node:crypto";
import { assertBudgetAllowsGeneration, recordBudgetUsage } from "@/lib/budget/service";
import { listReadyCurriculumChunks } from "@/lib/curriculum/repository";
import {
  createLessonDraftRecord,
  getLessonDraftRecord,
  markLessonCompleted,
  listLessonDraftSummaries
} from "@/lib/lesson/repository";
import { LESSON_TEMPLATE_MINUTES, buildLessonTemplate } from "@/lib/lesson/template";
import type {
  GenerateLessonDraftInput,
  LessonDraftRecord,
  LessonDraftSummary,
  ListLessonDraftInput
} from "@/lib/lesson/types";

const READY_SOURCE_MIN_COUNT = 1;
const LESSON_GENERATION_ESTIMATE_USD = 0.05;

export async function generateLessonDraft(input: GenerateLessonDraftInput): Promise<LessonDraftRecord> {
  const budgetStatus = await assertBudgetAllowsGeneration(LESSON_GENERATION_ESTIMATE_USD);
  const curriculumSources = await listReadyCurriculumChunks(120);
  const trackScopedSources = curriculumSources.filter((chunk) => chunk.track === input.track);
  const sources = trackScopedSources.length > 0 ? trackScopedSources : curriculumSources;

  if (sources.length < READY_SOURCE_MIN_COUNT) {
    throw new Error(
      "No READY curriculum chunks found. Upload and process curriculum before generating a lesson draft."
    );
  }

  const draft = buildLessonTemplate({
    track: input.track,
    locale: input.locale,
    focusTopic: input.focusTopic,
    sources,
    compactMode: budgetStatus.shortResponseMode
  });

  const created = await createLessonDraftRecord({
    id: randomUUID(),
    studentId: input.studentId,
    locale: input.locale,
    track: input.track,
    durationMinutes: LESSON_TEMPLATE_MINUTES.total,
    explainMinutes: LESSON_TEMPLATE_MINUTES.explain,
    guidedPracticeMinutes: LESSON_TEMPLATE_MINUTES.guidedPractice,
    independentTaskMinutes: LESSON_TEMPLATE_MINUTES.independentTask,
    budgetModeAtStart: budgetStatus.budgetModeEnum,
    draft
  });

  try {
    await recordBudgetUsage({
      lessonId: created.id,
      provider: "internal",
      model: budgetStatus.shortResponseMode ? "template-engine-low-cost" : "template-engine",
      requestType: "lesson_generation",
      costUsd: LESSON_GENERATION_ESTIMATE_USD
    });
  } catch {
    // no-op: draft is already generated, ledger write is best-effort in fallback mode
  }

  return created;
}

export async function listLessonDrafts(input: ListLessonDraftInput): Promise<LessonDraftSummary[]> {
  const limit = input.limit ?? 20;
  return listLessonDraftSummaries(limit, input.studentId);
}

export async function getLessonDraftById(lessonId: string): Promise<LessonDraftRecord | null> {
  return getLessonDraftRecord(lessonId);
}

export async function completeLessonById(lessonId: string) {
  return markLessonCompleted(lessonId);
}
