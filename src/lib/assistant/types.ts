import type { LessonTrack } from "@prisma/client";

export type AssistantScopeStatus = "IN_SCOPE" | "OUT_OF_SCOPE";

export type AssistantReference = {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  excerpt: string;
  track: LessonTrack;
  score: number;
};

export type ScopeGuardPayload = {
  sourcePolicy: "curriculum_only";
  track: LessonTrack;
  matchedTokenCount: number;
  scannedChunks: number;
};

export type ScopeConstrainedReply = {
  status: AssistantScopeStatus;
  answer: string;
  references: AssistantReference[];
  suggestions: string[];
  redirect: {
    recommendedAction: "RETURN_TO_CURRICULUM";
    suggestedPrompt: string;
  };
  guardrail: ScopeGuardPayload;
};

export type ScopeConstrainedReplyInput = {
  studentId: string;
  question: string;
  track: LessonTrack;
  locale: "tr" | "en";
};
