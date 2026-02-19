import { promises as fs } from "node:fs"
import path from "node:path"
import {
  BudgetMode,
  LessonStatus,
  type Lesson,
  type LessonTrack
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  LessonDraftRecord,
  LessonDraftSummary,
  LessonDraftTemplate,
  SupportedLocale
} from "@/lib/lesson/types"

type CreateLessonDraftInput = {
  id: string
  studentId: string
  locale: SupportedLocale
  track: LessonTrack
  durationMinutes: number
  explainMinutes: number
  guidedPracticeMinutes: number
  independentTaskMinutes: number
  budgetModeAtStart: BudgetMode
  draft: LessonDraftTemplate
}

const STORAGE_ROOT = path.join(process.cwd(), "storage")
const LESSON_DRAFT_ROOT = path.join(STORAGE_ROOT, "lesson-drafts")

function normalizeLocale(value: string): SupportedLocale {
  return value === "en" ? "en" : "tr"
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
    updatedAt: lesson.updatedAt.toISOString()
  }
}

function sanitizeLessonId(lessonId: string) {
  const sanitized = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return sanitized || "lesson-draft"
}

function draftFilePath(lessonId: string) {
  return path.join(LESSON_DRAFT_ROOT, `${sanitizeLessonId(lessonId)}.json`)
}

async function writeDraftFile(lessonId: string, draft: LessonDraftTemplate) {
  await fs.mkdir(LESSON_DRAFT_ROOT, { recursive: true })
  await fs.writeFile(draftFilePath(lessonId), JSON.stringify(draft, null, 2), "utf-8")
}

async function readDraftFile(lessonId: string): Promise<LessonDraftTemplate | null> {
  try {
    const raw = await fs.readFile(draftFilePath(lessonId), "utf-8")
    return JSON.parse(raw) as LessonDraftTemplate
  } catch {
    return null
  }
}

export async function createLessonDraftRecord(input: CreateLessonDraftInput): Promise<LessonDraftRecord> {
  await writeDraftFile(input.id, input.draft)

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
  })

  return {
    ...mapDbLesson(created),
    draft: input.draft
  }
}

export async function listLessonDraftSummaries(
  limit = 20,
  studentId?: string
): Promise<LessonDraftSummary[]> {
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
  })

  return dbLessons.map(mapDbLesson)
}

export async function getLessonDraftRecord(lessonId: string): Promise<LessonDraftRecord | null> {
  const dbLesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId
    }
  })

  if (!dbLesson) {
    return null
  }

  const summary = mapDbLesson(dbLesson)
  const draft = await readDraftFile(lessonId)

  if (!draft) {
    return null
  }

  return {
    ...summary,
    draft
  }
}

export async function markLessonCompleted(lessonId: string): Promise<LessonDraftSummary | null> {
  const updated = await prisma.lesson.update({
    where: {
      id: lessonId
    },
    data: {
      status: LessonStatus.COMPLETED,
      completedAt: new Date()
    }
  })

  return mapDbLesson(updated)
}
