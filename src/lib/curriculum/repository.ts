import { createHash } from "node:crypto"
import { DocumentStatus, LessonTrack, type CurriculumDocument } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { uploadToS3, downloadFromS3 } from "@/lib/storage/s3"
import type {
  CurriculumChunkContext,
  CurriculumChunkInput,
  CurriculumDocumentSummary,
  CurriculumSourceType
} from "@/lib/curriculum/types"

type CreateDocumentInput = {
  id: string
  uploaderId: string
  title: string
  originalName: string
  mimeType: string
  storageKey: string
  sourceLanguage: string
  checksum: string
  track: LessonTrack
  sourceType: CurriculumSourceType
}


function sanitizeFileName(fileName: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return sanitized || "curriculum-file"
}

function inferSourceType(originalName: string, mimeType: string): CurriculumSourceType {
  if (mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf")) {
    return "pdf"
  }

  return "markdown"
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
    track: document.track,
    sourceType: inferSourceType(document.originalName, document.mimeType)
  }
}

function mapDbChunkContext(
  document: {
    id: string
    title: string
    track: LessonTrack
    sourceLanguage: string
    mimeType: string
    originalName: string
    updatedAt: Date
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
    updatedAt: document.updatedAt.toISOString()
  }
}

export async function saveCurriculumFile(documentId: string, originalName: string, buffer: Buffer) {
  const safeName = sanitizeFileName(originalName)
  const now = new Date()
  const storageKey = [
    "uploads",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    `${documentId}-${safeName}`
  ].join("/")

  const mimeType =
    originalName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "text/markdown"

  await uploadToS3(storageKey, buffer, mimeType)

  const checksum = createHash("sha256").update(buffer).digest("hex")

  return {
    storageKey,
    checksum
  }
}

export async function createCurriculumDocumentRecord(input: CreateDocumentInput) {
  const created = await prisma.curriculumDocument.create({
    data: {
      id: input.id,
      uploaderId: input.uploaderId,
      title: input.title,
      originalName: input.originalName,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      sourceLanguage: input.sourceLanguage,
      track: input.track,
      checksum: input.checksum,
      status: DocumentStatus.PROCESSING,
      errorMessage: null
    }
  })

  return {
    document: mapDbDocument(created, 0)
  }
}

export async function markCurriculumDocumentReady(
  documentId: string,
  chunks: CurriculumChunkInput[]
): Promise<CurriculumDocumentSummary> {
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.curriculumChunk.deleteMany({
      where: { documentId }
    })

    if (chunks.length > 0) {
      await transaction.curriculumChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId,
          ordinal: chunk.ordinal,
          content: chunk.content,
          tokenCount: chunk.tokenCount
        }))
      })
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
    })
  })

  return mapDbDocument(updated, updated._count.chunks)
}

export async function markCurriculumDocumentFailed(
  documentId: string,
  errorMessage: string
): Promise<CurriculumDocumentSummary> {
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
  })

  return mapDbDocument(updated, updated._count.chunks)
}

export async function getCurriculumDocument(documentId: string) {
  const document = await prisma.curriculumDocument.findUnique({
    where: { id: documentId },
    include: {
      _count: {
        select: {
          chunks: true
        }
      }
    }
  })

  if (!document) {
    return null
  }

  return mapDbDocument(document, document._count.chunks)
}

export async function listCurriculumDocuments(limit = 25): Promise<CurriculumDocumentSummary[]> {
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
  })

  return dbDocuments.map((document) => mapDbDocument(document, document._count.chunks))
}

export async function listReadyCurriculumChunks(limit = 80): Promise<CurriculumChunkContext[]> {
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
  })

  const results: CurriculumChunkContext[] = []

  for (const document of dbDocuments) {
    for (const chunk of document.chunks) {
      results.push(
        mapDbChunkContext(
          {
            id: document.id,
            title: document.title,
            track: document.track,
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
      )
    }
  }

  return results.slice(0, limit)
}

export async function readCurriculumDocumentFile(storageKey: string) {
  return downloadFromS3(storageKey)
}
