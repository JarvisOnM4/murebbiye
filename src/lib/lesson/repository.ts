import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BudgetMode,
  LessonStatus,
  type Lesson,
  type LessonTrack
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LessonDraftRecord,
  LessonDraftSummary,
  LessonDraftTemplate,
  SupportedLocale
} from "@/lib/lesson/types";

type CreateLessonDraftInput = {
  id: string;
  studentId: string;
  locale: SupportedLocale;
  track: LessonTrack;
  durationMinutes: number;
  explainMinutes: number;
  guidedPracticeMinutes: number;
  independentTaskMinutes: number;
  budgetModeAtStart: BudgetMode;
  draft: LessonDraftTemplate;
};

type FallbackLessonRecord = {
  id: string;
  studentId: string;
  locale: SupportedLocale;
  track: LessonTrack;
  status: LessonStatus;
  durationMinutes: number;
  explainMinutes: number;
  guidedPracticeMinutes: number;
  independentTaskMinutes: number;
  budgetModeAtStart: BudgetMode;
  createdAt: string;
  updatedAt: string;
};

type FallbackLessonIndex = {
  drafts: FallbackLessonRecord[];
};

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const LESSON_DRAFT_ROOT = path.join(STORAGE_ROOT, "lesson-drafts");
const FALLBACK_ROOT = path.join(STORAGE_ROOT, "fallback");
const LESSON_FALLBACK_INDEX_FILE = path.join(FALLBACK_ROOT, "lesson-draft-index.json");

function normalizeLocale(value: string): SupportedLocale {
  return value === "en" ? "en" : "tr";
}

function mapDbLesson(lesson: Lesson): LessonDraftSummary {
  return {
    id: lesson.id,
    studentId: lesson.studentId,
    locale: normalizeLocale(lesson.locale),
    track: lesson.track,
    status: lesson.status,
    durationMinutes: lesson.durationMinutes,
    explainMinutes: lesson.explainMinutes,
    guidedPracticeMinutes: lesson.guidedPracticeMinutes,
    independentTaskMinutes: lesson.independentTaskMinutes,
    budgetModeAtStart: lesson.budgetModeAtStart,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    persistence: "db"
  };
}

function mapFallbackLesson(record: FallbackLessonRecord): LessonDraftSummary {
  return {
    id: record.id,
    studentId: record.studentId,
    locale: record.locale,
    track: record.track,
    status: record.status,
    durationMinutes: record.durationMinutes,
    explainMinutes: record.explainMinutes,
    guidedPracticeMinutes: record.guidedPracticeMinutes,
    independentTaskMinutes: record.independentTaskMinutes,
    budgetModeAtStart: record.budgetModeAtStart,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    persistence: "fallback"
  };
}

function sanitizeLessonId(lessonId: string) {
  const sanitized = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized || "lesson-draft";
}

function draftFilePath(lessonId: string) {
  return path.join(LESSON_DRAFT_ROOT, `${sanitizeLessonId(lessonId)}.json`);
}

async function ensureStorageStructure() {
  await fs.mkdir(LESSON_DRAFT_ROOT, { recursive: true });
  await fs.mkdir(FALLBACK_ROOT, { recursive: true });

  try {
    await fs.access(LESSON_FALLBACK_INDEX_FILE);
  } catch {
    await fs.writeFile(LESSON_FALLBACK_INDEX_FILE, JSON.stringify({ drafts: [] }, null, 2), "utf-8");
  }
}

async function readFallbackIndex(): Promise<FallbackLessonIndex> {
  await ensureStorageStructure();
  const raw = await fs.readFile(LESSON_FALLBACK_INDEX_FILE, "utf-8");
  const parsed = JSON.parse(raw) as FallbackLessonIndex;

  return {
    drafts: parsed.drafts ?? []
  };
}

async function writeFallbackIndex(index: FallbackLessonIndex) {
  await fs.writeFile(LESSON_FALLBACK_INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

async function writeDraftFile(lessonId: string, draft: LessonDraftTemplate) {
  await ensureStorageStructure();
  await fs.writeFile(draftFilePath(lessonId), JSON.stringify(draft, null, 2), "utf-8");
}

async function readDraftFile(lessonId: string): Promise<LessonDraftTemplate | null> {
  try {
    const raw = await fs.readFile(draftFilePath(lessonId), "utf-8");
    return JSON.parse(raw) as LessonDraftTemplate;
  } catch {
    return null;
  }
}

async function createFallbackLessonRecord(input: CreateLessonDraftInput): Promise<LessonDraftRecord> {
  const index = await readFallbackIndex();
  const now = new Date().toISOString();

  const record: FallbackLessonRecord = {
    id: input.id,
    studentId: input.studentId,
    locale: input.locale,
    track: input.track,
    status: LessonStatus.PLANNED,
    durationMinutes: input.durationMinutes,
    explainMinutes: input.explainMinutes,
    guidedPracticeMinutes: input.guidedPracticeMinutes,
    independentTaskMinutes: input.independentTaskMinutes,
    budgetModeAtStart: input.budgetModeAtStart,
    createdAt: now,
    updatedAt: now
  };

  index.drafts.unshift(record);
  await writeFallbackIndex(index);

  return {
    ...mapFallbackLesson(record),
    draft: input.draft
  };
}

export async function createLessonDraftRecord(input: CreateLessonDraftInput): Promise<LessonDraftRecord> {
  await writeDraftFile(input.id, input.draft);

  try {
    const created = await prisma.lesson.create({
      data: {
        id: input.id,
        studentId: input.studentId,
        locale: input.locale,
        track: input.track,
        status: LessonStatus.PLANNED,
        durationMinutes: input.durationMinutes,
        explainMinutes: input.explainMinutes,
        guidedPracticeMinutes: input.guidedPracticeMinutes,
        independentTaskMinutes: input.independentTaskMinutes,
        budgetModeAtStart: input.budgetModeAtStart
      }
    });

    return {
      ...mapDbLesson(created),
      draft: input.draft
    };
  } catch {
    return createFallbackLessonRecord(input);
  }
}

export async function listLessonDraftSummaries(
  limit = 20,
  studentId?: string
): Promise<LessonDraftSummary[]> {
  const summaries: LessonDraftSummary[] = [];

  try {
    const dbLessons = await prisma.lesson.findMany({
      where: studentId
        ? {
            studentId
          }
        : undefined,
      orderBy: {
        updatedAt: "desc"
      },
      take: limit
    });

    summaries.push(...dbLessons.map(mapDbLesson));
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  const fallbackRecords = index.drafts.filter((draft) => (studentId ? draft.studentId === studentId : true));

  summaries.push(...fallbackRecords.map(mapFallbackLesson));

  const unique = new Map<string, LessonDraftSummary>();

  for (const summary of summaries) {
    unique.set(summary.id, summary);
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export async function getLessonDraftRecord(lessonId: string): Promise<LessonDraftRecord | null> {
  let summary: LessonDraftSummary | null = null;

  try {
    const dbLesson = await prisma.lesson.findUnique({
      where: {
        id: lessonId
      }
    });

    if (dbLesson) {
      summary = mapDbLesson(dbLesson);
    }
  } catch {
    // no-op fallback below
  }

  if (!summary) {
    const index = await readFallbackIndex();
    const fallbackRecord = index.drafts.find((draft) => draft.id === lessonId);

    if (!fallbackRecord) {
      return null;
    }

    summary = mapFallbackLesson(fallbackRecord);
  }

  const draft = await readDraftFile(lessonId);

  if (!draft) {
    return null;
  }

  return {
    ...summary,
    draft
  };
}

export async function markLessonCompleted(lessonId: string): Promise<LessonDraftSummary | null> {
  try {
    const updated = await prisma.lesson.update({
      where: {
        id: lessonId
      },
      data: {
        status: LessonStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    return mapDbLesson(updated);
  } catch {
    const index = await readFallbackIndex();
    const target = index.drafts.find((draft) => draft.id === lessonId);

    if (!target) {
      return null;
    }

    target.status = LessonStatus.COMPLETED;
    target.updatedAt = new Date().toISOString();
    await writeFallbackIndex(index);
    return mapFallbackLesson(target);
  }
}
