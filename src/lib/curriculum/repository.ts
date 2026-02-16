import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DocumentStatus, LessonTrack, type CurriculumDocument } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CurriculumChunkContext,
  CurriculumChunkInput,
  CurriculumDocumentSummary,
  CurriculumSourceType
} from "@/lib/curriculum/types";

type CreateDocumentInput = {
  id: string;
  uploaderId: string;
  title: string;
  originalName: string;
  mimeType: string;
  storageKey: string;
  sourceLanguage: string;
  checksum: string;
  track: LessonTrack;
  sourceType: CurriculumSourceType;
};

type FallbackDocumentRecord = {
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
  track: LessonTrack;
  sourceType: CurriculumSourceType;
  chunks: CurriculumChunkInput[];
};

type FallbackIndex = {
  documents: FallbackDocumentRecord[];
};

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const STORAGE_UPLOADS_ROOT = path.join(STORAGE_ROOT, "uploads");
const FALLBACK_ROOT = path.join(STORAGE_ROOT, "fallback");
const FALLBACK_INDEX_FILE = path.join(FALLBACK_ROOT, "curriculum-index.json");

function sanitizeFileName(fileName: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized || "curriculum-file";
}

function inferSourceType(originalName: string, mimeType: string): CurriculumSourceType {
  if (mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }

  return "markdown";
}

function mapDbDocument(document: CurriculumDocument, chunkCount: number): CurriculumDocumentSummary {
  return {
    id: document.id,
    uploaderId: document.uploaderId,
    title: document.title,
    originalName: document.originalName,
    mimeType: document.mimeType,
    storageKey: document.storageKey,
    sourceLanguage: document.sourceLanguage,
    checksum: document.checksum,
    status: document.status,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    chunkCount,
    track: LessonTrack.ENGLISH,
    sourceType: inferSourceType(document.originalName, document.mimeType),
    persistence: "db"
  };
}

function mapFallbackDocument(document: FallbackDocumentRecord): CurriculumDocumentSummary {
  return {
    id: document.id,
    uploaderId: document.uploaderId,
    title: document.title,
    originalName: document.originalName,
    mimeType: document.mimeType,
    storageKey: document.storageKey,
    sourceLanguage: document.sourceLanguage,
    checksum: document.checksum,
    status: document.status,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    chunkCount: document.chunks.length,
    track: document.track,
    sourceType: document.sourceType,
    persistence: "fallback"
  };
}

function mapDbChunkContext(
  document: {
    id: string;
    title: string;
    track: LessonTrack;
    sourceLanguage: string;
    mimeType: string;
    originalName: string;
    updatedAt: Date;
  },
  chunk: CurriculumChunkInput
): CurriculumChunkContext {
  return {
    documentId: document.id,
    documentTitle: document.title,
    chunkOrdinal: chunk.ordinal,
    content: chunk.content,
    track: document.track,
    sourceLanguage: document.sourceLanguage,
    sourceType: inferSourceType(document.originalName, document.mimeType),
    updatedAt: document.updatedAt.toISOString(),
    persistence: "db"
  };
}

function mapFallbackChunkContext(document: FallbackDocumentRecord): CurriculumChunkContext[] {
  return document.chunks.map((chunk) => ({
    documentId: document.id,
    documentTitle: document.title,
    chunkOrdinal: chunk.ordinal,
    content: chunk.content,
    track: document.track,
    sourceLanguage: document.sourceLanguage,
    sourceType: document.sourceType,
    updatedAt: document.updatedAt,
    persistence: "fallback"
  }));
}

async function ensureStorageStructure() {
  await fs.mkdir(STORAGE_UPLOADS_ROOT, { recursive: true });
  await fs.mkdir(FALLBACK_ROOT, { recursive: true });

  try {
    await fs.access(FALLBACK_INDEX_FILE);
  } catch {
    await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify({ documents: [] }, null, 2), "utf-8");
  }
}

async function readFallbackIndex(): Promise<FallbackIndex> {
  await ensureStorageStructure();
  const raw = await fs.readFile(FALLBACK_INDEX_FILE, "utf-8");
  const parsed = JSON.parse(raw) as FallbackIndex;
  return {
    documents: parsed.documents ?? []
  };
}

async function writeFallbackIndex(index: FallbackIndex) {
  await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

async function createFallbackDocument(input: CreateDocumentInput) {
  const index = await readFallbackIndex();
  const now = new Date().toISOString();

  const record: FallbackDocumentRecord = {
    id: input.id,
    uploaderId: input.uploaderId,
    title: input.title,
    originalName: input.originalName,
    mimeType: input.mimeType,
    storageKey: input.storageKey,
    sourceLanguage: input.sourceLanguage,
    checksum: input.checksum,
    status: DocumentStatus.PROCESSING,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    track: input.track,
    sourceType: input.sourceType,
    chunks: []
  };

  index.documents.unshift(record);
  await writeFallbackIndex(index);

  return mapFallbackDocument(record);
}

async function updateFallbackDocument(
  documentId: string,
  status: DocumentStatus,
  errorMessage: string | null,
  chunks: CurriculumChunkInput[]
) {
  const index = await readFallbackIndex();
  const target = index.documents.find((document) => document.id === documentId);

  if (!target) {
    return null;
  }

  target.status = status;
  target.errorMessage = errorMessage;
  target.updatedAt = new Date().toISOString();
  target.chunks = chunks;

  await writeFallbackIndex(index);

  return mapFallbackDocument(target);
}

function storagePathFromKey(storageKey: string) {
  const key = storageKey.replace(/\\/g, "/");
  return path.join(STORAGE_ROOT, ...key.split("/"));
}

export async function saveCurriculumFile(documentId: string, originalName: string, buffer: Buffer) {
  await ensureStorageStructure();

  const safeName = sanitizeFileName(originalName);
  const now = new Date();
  const storageKey = path.posix.join(
    "uploads",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    `${documentId}-${safeName}`
  );

  const targetPath = storagePathFromKey(storageKey);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const checksum = createHash("sha256").update(buffer).digest("hex");

  return {
    storageKey,
    checksum,
    filePath: targetPath
  };
}

export async function createCurriculumDocumentRecord(input: CreateDocumentInput) {
  try {
    const created = await prisma.curriculumDocument.create({
      data: {
        id: input.id,
        uploaderId: input.uploaderId,
        title: input.title,
        originalName: input.originalName,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        sourceLanguage: input.sourceLanguage,
        checksum: input.checksum,
        status: DocumentStatus.PROCESSING,
        errorMessage: null
      }
    });

    return {
      document: mapDbDocument(created, 0),
      persistence: "db" as const
    };
  } catch {
    const fallback = await createFallbackDocument(input);

    return {
      document: fallback,
      persistence: "fallback" as const
    };
  }
}

export async function markCurriculumDocumentReady(
  documentId: string,
  chunks: CurriculumChunkInput[]
): Promise<CurriculumDocumentSummary> {
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.curriculumChunk.deleteMany({
        where: { documentId }
      });

      if (chunks.length > 0) {
        await transaction.curriculumChunk.createMany({
          data: chunks.map((chunk) => ({
            documentId,
            ordinal: chunk.ordinal,
            content: chunk.content,
            tokenCount: chunk.tokenCount
          }))
        });
      }

      return transaction.curriculumDocument.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
          errorMessage: null
        },
        include: {
          _count: {
            select: {
              chunks: true
            }
          }
        }
      });
    });

    return mapDbDocument(updated, updated._count.chunks);
  } catch {
    const fallback = await updateFallbackDocument(documentId, DocumentStatus.READY, null, chunks);

    if (!fallback) {
      throw new Error("Curriculum document could not be updated to READY.");
    }

    return fallback;
  }
}

export async function markCurriculumDocumentFailed(
  documentId: string,
  errorMessage: string
): Promise<CurriculumDocumentSummary> {
  try {
    const updated = await prisma.curriculumDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        errorMessage
      },
      include: {
        _count: {
          select: {
            chunks: true
          }
        }
      }
    });

    return mapDbDocument(updated, updated._count.chunks);
  } catch {
    const fallback = await updateFallbackDocument(documentId, DocumentStatus.FAILED, errorMessage, []);

    if (!fallback) {
      throw new Error("Curriculum document could not be updated to FAILED.");
    }

    return fallback;
  }
}

export async function getCurriculumDocument(documentId: string) {
  try {
    const document = await prisma.curriculumDocument.findUnique({
      where: { id: documentId },
      include: {
        _count: {
          select: {
            chunks: true
          }
        }
      }
    });

    if (document) {
      return mapDbDocument(document, document._count.chunks);
    }
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  const fallbackDocument = index.documents.find((document) => document.id === documentId);

  return fallbackDocument ? mapFallbackDocument(fallbackDocument) : null;
}

export async function listCurriculumDocuments(limit = 25): Promise<CurriculumDocumentSummary[]> {
  const summaries: CurriculumDocumentSummary[] = [];

  try {
    const dbDocuments = await prisma.curriculumDocument.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: {
        _count: {
          select: {
            chunks: true
          }
        }
      }
    });

    summaries.push(
      ...dbDocuments.map((document) => mapDbDocument(document, document._count.chunks))
    );
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  summaries.push(...index.documents.map(mapFallbackDocument));

  const unique = new Map<string, CurriculumDocumentSummary>();

  for (const item of summaries) {
    unique.set(item.id, item);
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export async function listReadyCurriculumChunks(limit = 80): Promise<CurriculumChunkContext[]> {
  const summaries: CurriculumChunkContext[] = [];

  try {
    const dbDocuments = await prisma.curriculumDocument.findMany({
      where: {
        status: DocumentStatus.READY
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 10,
      include: {
        chunks: {
          orderBy: {
            ordinal: "asc"
          }
        }
      }
    });

    for (const document of dbDocuments) {
      for (const chunk of document.chunks) {
        summaries.push(
          mapDbChunkContext(
            {
              id: document.id,
              title: document.title,
              track: LessonTrack.ENGLISH,
              sourceLanguage: document.sourceLanguage,
              mimeType: document.mimeType,
              originalName: document.originalName,
              updatedAt: document.updatedAt
            },
            {
              ordinal: chunk.ordinal,
              content: chunk.content,
              tokenCount: chunk.tokenCount
            }
          )
        );
      }
    }
  } catch {
    // no-op fallback below
  }

  const index = await readFallbackIndex();
  const fallbackDocuments = index.documents
    .filter((document) => document.status === DocumentStatus.READY)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  for (const document of fallbackDocuments) {
    summaries.push(...mapFallbackChunkContext(document));
  }

  const unique = new Map<string, CurriculumChunkContext>();

  for (const chunk of summaries) {
    unique.set(`${chunk.documentId}:${chunk.chunkOrdinal}`, chunk);
  }

  return [...unique.values()]
    .sort((left, right) => {
      const timeDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.chunkOrdinal - right.chunkOrdinal;
    })
    .slice(0, limit);
}

export async function readCurriculumDocumentFile(storageKey: string) {
  const fullPath = storagePathFromKey(storageKey);
  return fs.readFile(fullPath);
}
