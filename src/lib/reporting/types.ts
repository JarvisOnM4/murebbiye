import type { EmailStatus, LessonTrack, QueueJobStatus } from "@prisma/client";

export type SupportedLocale = "tr" | "en";

export type LessonInteractionInput = {
  actorRole?: string;
  promptText: string;
  responseText: string;
  usedHint?: boolean;
  isCorrect?: boolean;
  outOfScopeQuery?: boolean;
  responseMs?: number;
};

export type LessonMetrics = {
  accuracyRatio: number;
  hintDependency: number;
  repetitionPerformance: number;
  interactionQuality: number;
  timeManagement: number;
  interactionCount: number;
};

export type ParentSummaryDraft = {
  subject: string;
  bodyText: string;
  strengths: string[];
  improvementAreas: string[];
  nextLessonRecommendation: string;
};

export type ParentSummaryRecord = {
  id: string;
  lessonId: string;
  studentId: string;
  parentEmail: string;
  locale: SupportedLocale;
  subject: string;
  bodyText: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParentSummaryQueueJob = {
  id: string;
  parentSummaryId: string;
  status: QueueJobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompleteLessonInput = {
  lessonId: string;
  studentId: string;
  locale: SupportedLocale;
  interactions: LessonInteractionInput[];
  parentEmail?: string;
};

export type CompleteLessonResult = {
  lessonId: string;
  studentId: string;
  track: LessonTrack;
  metrics: LessonMetrics;
  parentSummary?: ParentSummaryRecord;
  queueJob?: ParentSummaryQueueJob;
};

export type QueueDispatchItem = {
  queueJobId: string;
  parentSummaryId: string;
  status: "SENT" | "RETRY_SCHEDULED" | "FAILED";
  errorMessage: string | null;
};

export type QueueDispatchResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  items: QueueDispatchItem[];
};
