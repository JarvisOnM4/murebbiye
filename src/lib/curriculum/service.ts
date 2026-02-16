import { randomUUID } from "node:crypto";
import { DocumentStatus } from "@prisma/client";
import { parseCurriculumContent } from "@/lib/curriculum/parser";
import {
  createCurriculumDocumentRecord,
  getCurriculumDocument,
  listCurriculumDocuments,
  markCurriculumDocumentFailed,
  markCurriculumDocumentReady,
  readCurriculumDocumentFile,
  saveCurriculumFile
} from "@/lib/curriculum/repository";
import type {
  IngestCurriculumInput,
  IngestCurriculumResult
} from "@/lib/curriculum/types";

type RetryResult = IngestCurriculumResult;

function actionableParseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown parser error.";

  return `${message} If this is a PDF, ensure it contains selectable text and is not corrupted.`;
}

export async function ingestCurriculum(input: IngestCurriculumInput): Promise<IngestCurriculumResult> {
  const documentId = randomUUID();

  const savedFile = await saveCurriculumFile(documentId, input.originalName, input.buffer);

  const { document } = await createCurriculumDocumentRecord({
    id: documentId,
    uploaderId: input.uploaderId,
    title: input.title,
    originalName: input.originalName,
    mimeType: input.mimeType,
    sourceLanguage: input.sourceLanguage,
    storageKey: savedFile.storageKey,
    checksum: savedFile.checksum,
    track: input.track,
    sourceType: input.sourceType
  });

  try {
    const parsed = await parseCurriculumContent(input.sourceType, input.buffer);
    const readyDocument = await markCurriculumDocumentReady(document.id, parsed.chunks);

    return {
      document: readyDocument,
      warnings: [],
      errors: []
    };
  } catch (error) {
    const errorMessage = actionableParseError(error);
    const failedDocument = await markCurriculumDocumentFailed(document.id, errorMessage);

    return {
      document: failedDocument,
      warnings: [],
      errors: [errorMessage]
    };
  }
}

export async function retryCurriculumIngestion(documentId: string): Promise<RetryResult | null> {
  const document = await getCurriculumDocument(documentId);

  if (!document) {
    return null;
  }

  const buffer = await readCurriculumDocumentFile(document.storageKey);

  try {
    const parsed = await parseCurriculumContent(document.sourceType, buffer);
    const readyDocument = await markCurriculumDocumentReady(document.id, parsed.chunks);

    return {
      document: readyDocument,
      warnings: [],
      errors: []
    };
  } catch (error) {
    const errorMessage = actionableParseError(error);
    const failedDocument = await markCurriculumDocumentFailed(document.id, errorMessage);

    return {
      document: failedDocument,
      warnings: [],
      errors: [errorMessage]
    };
  }
}

export async function fetchCurriculumDocuments() {
  const documents = await listCurriculumDocuments();

  const counts = {
    total: documents.length,
    ready: documents.filter((item) => item.status === DocumentStatus.READY).length,
    failed: documents.filter((item) => item.status === DocumentStatus.FAILED).length,
    processing: documents.filter((item) => item.status === DocumentStatus.PROCESSING).length
  };

  return {
    documents,
    counts
  };
}
