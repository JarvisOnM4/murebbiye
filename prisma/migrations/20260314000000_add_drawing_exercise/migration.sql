-- CreateEnum
CREATE TYPE "DrawingExerciseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DrawingExercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "titleEn" TEXT,
    "descriptionTr" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "lessonNumber" INTEGER NOT NULL,
    "targetImageKey" TEXT NOT NULL,
    "templateSpec" JSONB NOT NULL,
    "generationMode" TEXT NOT NULL DEFAULT 'template',
    "status" "DrawingExerciseStatus" NOT NULL DEFAULT 'DRAFT',
    "maxAttempts" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingAttempt" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "matchedElements" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawingMessage" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "analysis" JSONB,
    "generatedImage" TEXT,
    "costUsd" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrawingExercise_slug_key" ON "DrawingExercise"("slug");

-- CreateIndex
CREATE INDEX "DrawingExercise_unitNumber_lessonNumber_idx" ON "DrawingExercise"("unitNumber", "lessonNumber");

-- CreateIndex
CREATE INDEX "DrawingExercise_status_idx" ON "DrawingExercise"("status");

-- CreateIndex
CREATE INDEX "DrawingAttempt_studentId_exerciseId_idx" ON "DrawingAttempt"("studentId", "exerciseId");

-- CreateIndex
CREATE INDEX "DrawingAttempt_exerciseId_status_idx" ON "DrawingAttempt"("exerciseId", "status");

-- CreateIndex
CREATE INDEX "DrawingMessage_attemptId_createdAt_idx" ON "DrawingMessage"("attemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "DrawingAttempt" ADD CONSTRAINT "DrawingAttempt_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "DrawingExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawingMessage" ADD CONSTRAINT "DrawingMessage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "DrawingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
