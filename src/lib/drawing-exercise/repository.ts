import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DrawingExercise, DrawingAttempt, DrawingMessage } from "@prisma/client";

export async function getExerciseBySlug(slug: string): Promise<DrawingExercise | null> {
  return prisma.drawingExercise.findUnique({
    where: { slug },
  });
}

export async function getExerciseById(id: string): Promise<DrawingExercise | null> {
  return prisma.drawingExercise.findUnique({
    where: { id },
  });
}

export async function getExercisesForLesson(
  unitNumber: number,
  lessonNumber: number
): Promise<DrawingExercise[]> {
  return prisma.drawingExercise.findMany({
    where: { unitNumber, lessonNumber },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAttempt(
  exerciseId: string,
  studentId: string
): Promise<DrawingAttempt> {
  return prisma.drawingAttempt.create({
    data: {
      exerciseId,
      studentId,
      status: "in_progress",
      attemptCount: 0,
      hintsUsed: 0,
      matchedElements: {},
    },
  });
}

export async function getActiveAttempt(
  exerciseId: string,
  studentId: string
): Promise<DrawingAttempt | null> {
  return prisma.drawingAttempt.findFirst({
    where: {
      exerciseId,
      studentId,
      status: "in_progress",
    },
    orderBy: { createdAt: "desc" },
  });
}

export type UpdateAttemptData = {
  status?: string;
  attemptCount?: number;
  hintsUsed?: number;
  matchedElements?: Record<string, string>;
  completedAt?: Date | null;
};

export async function updateAttempt(
  attemptId: string,
  data: UpdateAttemptData
): Promise<DrawingAttempt> {
  return prisma.drawingAttempt.update({
    where: { id: attemptId },
    data,
  });
}

export async function addMessage(
  attemptId: string,
  role: string,
  content: string,
  analysis?: Record<string, unknown> | null,
  costUsd?: number | null
): Promise<DrawingMessage> {
  return prisma.drawingMessage.create({
    data: {
      attemptId,
      role,
      content,
      analysis:
        analysis != null
          ? (analysis as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      costUsd: costUsd != null ? costUsd : undefined,
    },
  });
}

export async function getMessages(attemptId: string): Promise<DrawingMessage[]> {
  return prisma.drawingMessage.findMany({
    where: { attemptId },
    orderBy: { createdAt: "asc" },
  });
}
