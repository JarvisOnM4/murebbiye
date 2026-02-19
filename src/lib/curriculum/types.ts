import type { DocumentStatus, LessonTrack } from "@prisma/client";

export type CurriculumSourceType = "markdown" | "pdf";

export type CurriculumChunkInput = {
  ordinal: number;
  content: string;
  tokenCount: number;
};

export type CurriculumChunkContext = {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  content: string;
  track: LessonTrack;
  sourceLanguage: string;
  sourceType: CurriculumSourceType;
  updatedAt: string;
};

export type CurriculumDocumentSummary = {
  id: string;
  uploaderId: string;
  title: string;
  originalName: string;
  mimeType: string;
  storageKey: string;
  sourceLanguage: string;
  checksum: string;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  track: LessonTrack;
  sourceType: CurriculumSourceType;
};

export type IngestCurriculumInput = {
  uploaderId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sourceLanguage: string;
  sourceType: CurriculumSourceType;
  track: LessonTrack;
  buffer: Buffer;
};

export type IngestCurriculumResult = {
  document: CurriculumDocumentSummary;
  warnings: string[];
  errors: string[];
};
