import type {
  EnrichmentJobStatus,
  MediaAssetStatus,
  MediaAssetType
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type {
  EnrichmentJobDetail,
  EnrichmentJobSummary,
  MediaAssetSummary,
  SupportedLocale
} from "@/lib/media-agent/types"

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type CreateEnrichmentJobInput = {
  documentId: string
  locale?: SupportedLocale
  mediaTypesRequested?: string[]
  budgetModeAtStart?: string
}

type UpdateEnrichmentJobInput = {
  status?: EnrichmentJobStatus
  assetsGenerated?: number
  assetsFailed?: number
  totalCostUsd?: number
  errorMessage?: string | null
  startedAt?: Date
  completedAt?: Date
}

type CreateMediaAssetInput = {
  enrichmentJobId: string
  documentId: string
  chunkOrdinal?: number | null
  lessonId?: string | null
  type: MediaAssetType
  locale?: SupportedLocale
  title: string
  altText?: string | null
  storyboard: string
}

type UpdateMediaAssetStatusExtras = {
  content?: Record<string, unknown>
  renderHints?: Record<string, unknown>
  generationModel?: string
  generationCostUsd?: number
  tokensIn?: number
  tokensOut?: number
  reviewedBy?: string
  reviewedAt?: Date
  rejectionReason?: string | null
  lessonId?: string | null
}

type ListMediaAssetsFilters = {
  documentId?: string
  type?: MediaAssetType
  status?: MediaAssetStatus
  enrichmentJobId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round6(value: number) {
  return Number(value.toFixed(6))
}

function normalizeLocale(value: string): SupportedLocale {
  return value === "en" ? "en" : "tr"
}

// ---------------------------------------------------------------------------
// DB -> domain mappers
// ---------------------------------------------------------------------------

function mapDbJob(job: {
  id: string
  documentId: string
  status: EnrichmentJobStatus
  locale: string
  mediaTypesRequested: string[]
  assetsGenerated: number
  assetsFailed: number
  totalCostUsd: { toNumber(): number }
  budgetModeAtStart: string
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): EnrichmentJobSummary {
  return {
    id: job.id,
    documentId: job.documentId,
    status: job.status,
    locale: normalizeLocale(job.locale),
    mediaTypesRequested: job.mediaTypesRequested,
    assetsGenerated: job.assetsGenerated,
    assetsFailed: job.assetsFailed,
    totalCostUsd: round6(job.totalCostUsd.toNumber()),
    budgetModeAtStart: job.budgetModeAtStart,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  }
}

function mapDbAsset(asset: {
  id: string
  enrichmentJobId: string
  documentId: string
  chunkOrdinal: number | null
  lessonId: string | null
  type: MediaAssetType
  status: MediaAssetStatus
  locale: string
  title: string
  altText: string | null
  storyboard: string
  content: unknown
  renderHints: unknown
  generationModel: string | null
  generationCostUsd: { toNumber(): number } | null
  tokensIn: number | null
  tokensOut: number | null
  reviewedBy: string | null
  reviewedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
}): MediaAssetSummary {
  return {
    id: asset.id,
    enrichmentJobId: asset.enrichmentJobId,
    documentId: asset.documentId,
    chunkOrdinal: asset.chunkOrdinal,
    lessonId: asset.lessonId,
    type: asset.type,
    status: asset.status,
    locale: normalizeLocale(asset.locale),
    title: asset.title,
    altText: asset.altText,
    storyboard: asset.storyboard,
    content: (asset.content as Record<string, unknown>) ?? null,
    renderHints: (asset.renderHints as Record<string, unknown>) ?? null,
    generationModel: asset.generationModel,
    generationCostUsd: asset.generationCostUsd
      ? round6(asset.generationCostUsd.toNumber())
      : null,
    tokensIn: asset.tokensIn,
    tokensOut: asset.tokensOut,
    reviewedBy: asset.reviewedBy,
    reviewedAt: asset.reviewedAt?.toISOString() ?? null,
    rejectionReason: asset.rejectionReason,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString()
  }
}

// ---------------------------------------------------------------------------
// EnrichmentJob CRUD
// ---------------------------------------------------------------------------

export async function createEnrichmentJob(
  input: CreateEnrichmentJobInput
): Promise<EnrichmentJobSummary> {
  const created = await prisma.enrichmentJob.create({
    data: {
      documentId: input.documentId,
      locale: input.locale ?? "tr",
      mediaTypesRequested: input.mediaTypesRequested ?? [],
      budgetModeAtStart: input.budgetModeAtStart ?? "normal"
    }
  })

  return mapDbJob(created)
}

export async function updateEnrichmentJob(
  jobId: string,
  updates: UpdateEnrichmentJobInput
): Promise<EnrichmentJobSummary | null> {
  const data: Record<string, unknown> = {}

  if (updates.status !== undefined) data.status = updates.status
  if (updates.assetsGenerated !== undefined) data.assetsGenerated = updates.assetsGenerated
  if (updates.assetsFailed !== undefined) data.assetsFailed = updates.assetsFailed
  if (updates.totalCostUsd !== undefined) data.totalCostUsd = round6(updates.totalCostUsd)
  if (updates.errorMessage !== undefined) data.errorMessage = updates.errorMessage
  if (updates.startedAt !== undefined) data.startedAt = updates.startedAt
  if (updates.completedAt !== undefined) data.completedAt = updates.completedAt

  const updated = await prisma.enrichmentJob.update({
    where: { id: jobId },
    data
  })

  return mapDbJob(updated)
}

export async function getEnrichmentJob(
  jobId: string
): Promise<EnrichmentJobDetail | null> {
  const dbJob = await prisma.enrichmentJob.findUnique({
    where: { id: jobId },
    include: { mediaAssets: true }
  })

  if (!dbJob) {
    return null
  }

  return {
    ...mapDbJob(dbJob),
    assets: dbJob.mediaAssets.map(mapDbAsset)
  }
}

export async function listEnrichmentJobs(
  limit = 20
): Promise<EnrichmentJobSummary[]> {
  const dbJobs = await prisma.enrichmentJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  })

  return dbJobs.map(mapDbJob)
}

// ---------------------------------------------------------------------------
// MediaAsset CRUD
// ---------------------------------------------------------------------------

export async function createMediaAsset(
  input: CreateMediaAssetInput
): Promise<MediaAssetSummary> {
  const created = await prisma.mediaAsset.create({
    data: {
      enrichmentJobId: input.enrichmentJobId,
      documentId: input.documentId,
      chunkOrdinal: input.chunkOrdinal ?? null,
      lessonId: input.lessonId ?? null,
      type: input.type,
      status: "STORYBOARD_PENDING",
      locale: input.locale ?? "tr",
      title: input.title,
      altText: input.altText ?? null,
      storyboard: input.storyboard
    }
  })

  return mapDbAsset(created)
}

export async function updateMediaAssetStatus(
  assetId: string,
  status: MediaAssetStatus,
  extras?: UpdateMediaAssetStatusExtras
): Promise<MediaAssetSummary | null> {
  const data: Record<string, unknown> = { status }

  if (extras?.content !== undefined) data.content = extras.content
  if (extras?.renderHints !== undefined) data.renderHints = extras.renderHints
  if (extras?.generationModel !== undefined) data.generationModel = extras.generationModel
  if (extras?.generationCostUsd !== undefined) {
    data.generationCostUsd = round6(extras.generationCostUsd)
  }
  if (extras?.tokensIn !== undefined) data.tokensIn = extras.tokensIn
  if (extras?.tokensOut !== undefined) data.tokensOut = extras.tokensOut
  if (extras?.reviewedBy !== undefined) data.reviewedBy = extras.reviewedBy
  if (extras?.reviewedAt !== undefined) data.reviewedAt = extras.reviewedAt
  if (extras?.rejectionReason !== undefined) data.rejectionReason = extras.rejectionReason
  if (extras?.lessonId !== undefined) data.lessonId = extras.lessonId

  const updated = await prisma.mediaAsset.update({
    where: { id: assetId },
    data
  })

  return mapDbAsset(updated)
}

export async function getMediaAsset(
  assetId: string
): Promise<MediaAssetSummary | null> {
  const dbAsset = await prisma.mediaAsset.findUnique({
    where: { id: assetId }
  })

  if (!dbAsset) {
    return null
  }

  return mapDbAsset(dbAsset)
}

export async function listMediaAssets(
  filters?: ListMediaAssetsFilters,
  limit = 50
): Promise<MediaAssetSummary[]> {
  const where: Record<string, unknown> = {}

  if (filters?.documentId) where.documentId = filters.documentId
  if (filters?.type) where.type = filters.type
  if (filters?.status) where.status = filters.status
  if (filters?.enrichmentJobId) where.enrichmentJobId = filters.enrichmentJobId

  const dbAssets = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit
  })

  return dbAssets.map(mapDbAsset)
}

export async function listApprovedAssetsForLesson(
  lessonId: string
): Promise<MediaAssetSummary[]> {
  const dbAssets = await prisma.mediaAsset.findMany({
    where: {
      lessonId,
      status: "GENERATED"
    },
    orderBy: { chunkOrdinal: "asc" }
  })

  return dbAssets.map(mapDbAsset)
}
