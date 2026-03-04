-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "LessonTrack" AS ENUM ('ENGLISH', 'AI_MODULE');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_ONLY', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "BudgetMode" AS ENUM ('NORMAL', 'SHORT_RESPONSE_LOW_COST', 'REVIEW_ONLY');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('DIAGRAM', 'FLOWCHART', 'ILLUSTRATION', 'SLIDE_DECK', 'VIDEO_SCRIPT', 'INTERACTIVE', 'CARTOON_NARRATIVE');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('STORYBOARD_PENDING', 'STORYBOARD_APPROVED', 'STORYBOARD_REJECTED', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('QUEUED', 'ANALYZING', 'STORYBOARD_READY', 'GENERATING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "nickname" TEXT,
    "parentEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumDocument" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
    "checksum" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "track" "LessonTrack" NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "durationMinutes" INTEGER NOT NULL DEFAULT 35,
    "explainMinutes" INTEGER NOT NULL DEFAULT 7,
    "guidedPracticeMinutes" INTEGER NOT NULL DEFAULT 20,
    "independentTaskMinutes" INTEGER NOT NULL DEFAULT 8,
    "budgetModeAtStart" "BudgetMode" NOT NULL DEFAULT 'NORMAL',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonInteraction" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "usedHint" BOOLEAN NOT NULL DEFAULT false,
    "isCorrect" BOOLEAN,
    "outOfScopeQuery" BOOLEAN NOT NULL DEFAULT false,
    "responseMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonMetricSnapshot" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "accuracyRatio" DECIMAL(5,4) NOT NULL,
    "hintDependency" DECIMAL(5,4) NOT NULL,
    "repetitionPerformance" DECIMAL(5,4) NOT NULL,
    "interactionQuality" DECIMAL(5,4) NOT NULL,
    "timeManagement" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentSummaryEmail" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentSummaryEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLedger" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "costUsd" DECIMAL(10,4) NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "enrichmentJobId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkOrdinal" INTEGER,
    "lessonId" TEXT,
    "type" "MediaAssetType" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'STORYBOARD_PENDING',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "title" TEXT NOT NULL,
    "altText" TEXT,
    "storyboard" TEXT NOT NULL,
    "content" JSONB,
    "renderHints" JSONB,
    "generationModel" TEXT,
    "generationCostUsd" DECIMAL(10,6),
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'QUEUED',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "mediaTypesRequested" TEXT[],
    "assetsGenerated" INTEGER NOT NULL DEFAULT 0,
    "assetsFailed" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "budgetModeAtStart" TEXT NOT NULL DEFAULT 'normal',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CurriculumDocument_uploaderId_createdAt_idx" ON "CurriculumDocument"("uploaderId", "createdAt");

-- CreateIndex
CREATE INDEX "CurriculumDocument_status_idx" ON "CurriculumDocument"("status");

-- CreateIndex
CREATE INDEX "CurriculumChunk_documentId_idx" ON "CurriculumChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumChunk_documentId_ordinal_key" ON "CurriculumChunk"("documentId", "ordinal");

-- CreateIndex
CREATE INDEX "Lesson_studentId_createdAt_idx" ON "Lesson"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "LessonInteraction_lessonId_createdAt_idx" ON "LessonInteraction"("lessonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonMetricSnapshot_lessonId_key" ON "LessonMetricSnapshot"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSummaryEmail_lessonId_key" ON "ParentSummaryEmail"("lessonId");

-- CreateIndex
CREATE INDEX "ParentSummaryEmail_status_queuedAt_idx" ON "ParentSummaryEmail"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "QueueJob_status_runAt_idx" ON "QueueJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "BudgetLedger_createdAt_idx" ON "BudgetLedger"("createdAt");

-- CreateIndex
CREATE INDEX "BudgetLedger_lessonId_idx" ON "BudgetLedger"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "MediaAsset_enrichmentJobId_idx" ON "MediaAsset"("enrichmentJobId");

-- CreateIndex
CREATE INDEX "MediaAsset_documentId_status_idx" ON "MediaAsset"("documentId", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_lessonId_idx" ON "MediaAsset"("lessonId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_status_idx" ON "MediaAsset"("type", "status");

-- CreateIndex
CREATE INDEX "EnrichmentJob_documentId_idx" ON "EnrichmentJob"("documentId");

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

-- AddForeignKey
ALTER TABLE "CurriculumDocument" ADD CONSTRAINT "CurriculumDocument_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumChunk" ADD CONSTRAINT "CurriculumChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CurriculumDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonInteraction" ADD CONSTRAINT "LessonInteraction_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonMetricSnapshot" ADD CONSTRAINT "LessonMetricSnapshot_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSummaryEmail" ADD CONSTRAINT "ParentSummaryEmail_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSummaryEmail" ADD CONSTRAINT "ParentSummaryEmail_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLedger" ADD CONSTRAINT "BudgetLedger_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_enrichmentJobId_fkey" FOREIGN KEY ("enrichmentJobId") REFERENCES "EnrichmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
