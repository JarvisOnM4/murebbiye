import type { BudgetMode, LessonStatus, LessonTrack } from "@prisma/client";

export type SupportedLocale = "tr" | "en";

export type LessonDraftRatio = {
  explainPercent: number;
  practicePercent: number;
  explainItems: number;
  practiceItems: number;
};

export type LessonSourceReference = {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  excerpt: string;
};

export type GuidedPracticeActivity = {
  id: string;
  prompt: string;
  source: LessonSourceReference;
};

export type MiniAssessmentQuestion = {
  id: string;
  prompt: string;
  expectedAnswerHint: string;
  source: LessonSourceReference;
};

export type LessonDraftTemplate = {
  version: number;
  generatedAt: string;
  locale: SupportedLocale;
  track: LessonTrack;
  focusTopic: string;
  ratio: LessonDraftRatio;
  schedule: {
    totalMinutes: number;
    explainMinutes: number;
    guidedPracticeMinutes: number;
    independentTaskMinutes: number;
  };
  sections: {
    explain: {
      title: string;
      objectives: string[];
      keyPoints: string[];
    };
    guidedPractice: {
      title: string;
      activities: GuidedPracticeActivity[];
    };
    independentTask: {
      title: string;
      prompt: string;
      checklist: string[];
    };
    miniAssessment: {
      title: string;
      questions: MiniAssessmentQuestion[];
    };
  };
};

export type LessonDraftSummary = {
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
  persistence: "db" | "fallback";
};

export type LessonDraftRecord = LessonDraftSummary & {
  draft: LessonDraftTemplate;
};

export type GenerateLessonDraftInput = {
  studentId: string;
  locale: SupportedLocale;
  track: LessonTrack;
  focusTopic?: string;
};

export type ListLessonDraftInput = {
  studentId?: string;
  limit?: number;
};
