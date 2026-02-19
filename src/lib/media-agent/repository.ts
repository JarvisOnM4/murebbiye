import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import type {
  EnrichmentJobStatus,
  MediaAssetStatus,
  MediaAssetType
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { markDbFailure, markDbSuccess, shouldAttemptDb } from "@/lib/persistence"
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
  documentId: string;
  locale?: SupportedLocale;
  mediaTypesRequested?: string[];
  budgetModeAtStart?: string;
}

type UpdateEnrichmentJobInput = {
  status?: EnrichmentJobStatus;
  assetsGenerated?: number;
  assetsFailed?: number;
  totalCostUsd?: number;
  errorMessage?: string | null;
  startedAt?: Date;
  completedAt?: Date;
}

type CreateMediaAssetInput = {
  enrichmentJobId: string;
  documentId: string;
  chunkOrdinal?: number | null;
  lessonId?: string | null;
  type: MediaAssetType;
  locale?: SupportedLocale;
  title: string;
  altText?: string | null;
  storyboard: string;
}

type UpdateMediaAssetStatusExtras = {
  content?: Record<string, unknown>;
  renderHints?: Record<string, unknown>;
  generationModel?: string;
  generationCostUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string | null;
  lessonId?: string | null;
}

type ListMediaAssetsFilters = {
  documentId?: string;
  type?: MediaAssetType;
  status?: MediaAssetStatus;
  enrichmentJobId?: string;
}

// ---------------------------------------------------------------------------
// Fallback record types
// ---------------------------------------------------------------------------

type FallbackJobRecord = {
  id: string;
  documentId: string;
  status: EnrichmentJobStatus;
  locale: SupportedLocale;
  mediaTypesRequested: string[];
  assetsGenerated: number;
  assetsFailed: number;
  totalCostUsd: number;
  budgetModeAtStart: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type FallbackAssetRecord = {
  id: string;
  enrichmentJobId: string;
  documentId: string;
  chunkOrdinal: number | null;
  lessonId: string | null;
  type: MediaAssetType;
  status: MediaAssetStatus;
  locale: SupportedLocale;
  title: string;
  altText: string | null;
  storyboard: string;
  content: Record<string, unknown> | null;
  renderHints: Record<string, unknown> | null;
  generationModel: string | null;
  generationCostUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

type FallbackMediaAgentIndex = {
  jobs: FallbackJobRecord[];
  assets: FallbackAssetRecord[];
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

const STORAGE_ROOT = path.join(process.cwd(), "storage")
const FALLBACK_ROOT = path.join(STORAGE_ROOT, "fallback")
const FALLBACK_INDEX_FILE = path.join(FALLBACK_ROOT, "media-agent-index.json")

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
// DB → domain mappers
// ---------------------------------------------------------------------------

function mapDbJob(job: {
  id: string;
  documentId: string;
  status: EnrichmentJobStatus;
  locale: string;
  mediaTypesRequested: string[];
  assetsGenerated: number;
  assetsFailed: number;
  totalCostUsd: { toNumber(): number };
  budgetModeAtStart: string;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
    updatedAt: job.updatedAt.toISOString(),
    persistence: "db"
  }
}

function mapDbAsset(asset: {
  id: string;
  enrichmentJobId: string;
  documentId: string;
  chunkOrdinal: number | null;
  lessonId: string | null;
  type: MediaAssetType;
  status: MediaAssetStatus;
  locale: string;
  title: string;
  altText: string | null;
  storyboard: string;
  content: unknown;
  renderHints: unknown;
  generationModel: string | null;
  generationCostUsd: { toNumber(): number } | null;
  tokensIn: number | null;
  tokensOut: number | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    updatedAt: asset.updatedAt.toISOString(),
    persistence: "db"
  }
}

// ---------------------------------------------------------------------------
// Fallback → domain mappers
// ---------------------------------------------------------------------------

function mapFallbackJob(record: FallbackJobRecord): EnrichmentJobSummary {
  return {
    id: record.id,
    documentId: record.documentId,
    status: record.status,
    locale: record.locale,
    mediaTypesRequested: record.mediaTypesRequested,
    assetsGenerated: record.assetsGenerated,
    assetsFailed: record.assetsFailed,
    totalCostUsd: round6(record.totalCostUsd),
    budgetModeAtStart: record.budgetModeAtStart,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    persistence: "fallback"
  }
}

function mapFallbackAsset(record: FallbackAssetRecord): MediaAssetSummary {
  return {
    id: record.id,
    enrichmentJobId: record.enrichmentJobId,
    documentId: record.documentId,
    chunkOrdinal: record.chunkOrdinal,
    lessonId: record.lessonId,
    type: record.type,
    status: record.status,
    locale: record.locale,
    title: record.title,
    altText: record.altText,
    storyboard: record.storyboard,
    content: record.content,
    renderHints: record.renderHints,
    generationModel: record.generationModel,
    generationCostUsd: record.generationCostUsd
      ? round6(record.generationCostUsd)
      : null,
    tokensIn: record.tokensIn,
    tokensOut: record.tokensOut,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
    rejectionReason: record.rejectionReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    persistence: "fallback"
  }
}

// ---------------------------------------------------------------------------
// Fallback I/O
// ---------------------------------------------------------------------------

async function ensureStorageStructure() {
  await fs.mkdir(FALLBACK_ROOT, { recursive: true })

  try {
    await fs.access(FALLBACK_INDEX_FILE)
  } catch {
    await fs.writeFile(
      FALLBACK_INDEX_FILE,
      JSON.stringify({ jobs: [], assets: [] }, null, 2),
      "utf-8"
    )
  }
}

async function readFallbackIndex(): Promise<FallbackMediaAgentIndex> {
  await ensureStorageStructure()
  const raw = await fs.readFile(FALLBACK_INDEX_FILE, "utf-8")
  const parsed = JSON.parse(raw) as FallbackMediaAgentIndex

  return {
    jobs: parsed.jobs ?? [],
    assets: parsed.assets ?? []
  }
}

async function writeFallbackIndex(index: FallbackMediaAgentIndex) {
  await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify(index, null, 2), "utf-8")
}

// ---------------------------------------------------------------------------
// EnrichmentJob CRUD
// ---------------------------------------------------------------------------

export async function createEnrichmentJob(
  input: CreateEnrichmentJobInput
): Promise<EnrichmentJobSummary> {
  if (shouldAttemptDb()) {
    try {
      const created = await prisma.enrichmentJob.create({
        data: {
          documentId: input.documentId,
          locale: input.locale ?? "tr",
          mediaTypesRequested: input.mediaTypesRequested ?? [],
          budgetModeAtStart: input.budgetModeAtStart ?? "normal"
        }
      })

      markDbSuccess()
      return mapDbJob(created)
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const now = new Date().toISOString()

  const fallbackRecord: FallbackJobRecord = {
    id: randomUUID(),
    documentId: input.documentId,
    status: "QUEUED" as EnrichmentJobStatus,
    locale: normalizeLocale(input.locale ?? "tr"),
    mediaTypesRequested: input.mediaTypesRequested ?? [],
    assetsGenerated: 0,
    assetsFailed: 0,
    totalCostUsd: 0,
    budgetModeAtStart: input.budgetModeAtStart ?? "normal",
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  }

  index.jobs.unshift(fallbackRecord)
  await writeFallbackIndex(index)
  return mapFallbackJob(fallbackRecord)
}

export async function updateEnrichmentJob(
  jobId: string,
  updates: UpdateEnrichmentJobInput
): Promise<EnrichmentJobSummary | null> {
  if (shouldAttemptDb()) {
    try {
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

      markDbSuccess()
      return mapDbJob(updated)
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const target = index.jobs.find((job) => job.id === jobId)

  if (!target) {
    return null
  }

  if (updates.status !== undefined) target.status = updates.status
  if (updates.assetsGenerated !== undefined) target.assetsGenerated = updates.assetsGenerated
  if (updates.assetsFailed !== undefined) target.assetsFailed = updates.assetsFailed
  if (updates.totalCostUsd !== undefined) target.totalCostUsd = round6(updates.totalCostUsd)
  if (updates.errorMessage !== undefined) target.errorMessage = updates.errorMessage
  if (updates.startedAt !== undefined) target.startedAt = updates.startedAt.toISOString()
  if (updates.completedAt !== undefined) target.completedAt = updates.completedAt.toISOString()
  target.updatedAt = new Date().toISOString()

  await writeFallbackIndex(index)
  return mapFallbackJob(target)
}

export async function getEnrichmentJob(
  jobId: string
): Promise<EnrichmentJobDetail | null> {
  if (shouldAttemptDb()) {
    try {
      const dbJob = await prisma.enrichmentJob.findUnique({
        where: { id: jobId },
        include: { mediaAssets: true }
      })

      if (dbJob) {
        markDbSuccess()
        return {
          ...mapDbJob(dbJob),
          assets: dbJob.mediaAssets.map(mapDbAsset)
        }
      }

      markDbSuccess()
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const fallbackJob = index.jobs.find((job) => job.id === jobId)

  if (!fallbackJob) {
    return null
  }

  const jobAssets = index.assets.filter((asset) => asset.enrichmentJobId === jobId)

  return {
    ...mapFallbackJob(fallbackJob),
    assets: jobAssets.map(mapFallbackAsset)
  }
}

export async function listEnrichmentJobs(
  limit = 20
): Promise<EnrichmentJobSummary[]> {
  const summaries: EnrichmentJobSummary[] = []

  if (shouldAttemptDb()) {
    try {
      const dbJobs = await prisma.enrichmentJob.findMany({
        orderBy: { createdAt: "desc" },
        take: limit
      })

      markDbSuccess()
      summaries.push(...dbJobs.map(mapDbJob))
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  summaries.push(...index.jobs.map(mapFallbackJob))

  const unique = new Map<string, EnrichmentJobSummary>()

  for (const summary of summaries) {
    unique.set(summary.id, summary)
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// MediaAsset CRUD
// ---------------------------------------------------------------------------

export async function createMediaAsset(
  input: CreateMediaAssetInput
): Promise<MediaAssetSummary> {
  if (shouldAttemptDb()) {
    try {
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

      markDbSuccess()
      return mapDbAsset(created)
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const now = new Date().toISOString()

  const fallbackRecord: FallbackAssetRecord = {
    id: randomUUID(),
    enrichmentJobId: input.enrichmentJobId,
    documentId: input.documentId,
    chunkOrdinal: input.chunkOrdinal ?? null,
    lessonId: input.lessonId ?? null,
    type: input.type,
    status: "STORYBOARD_PENDING" as MediaAssetStatus,
    locale: normalizeLocale(input.locale ?? "tr"),
    title: input.title,
    altText: input.altText ?? null,
    storyboard: input.storyboard,
    content: null,
    renderHints: null,
    generationModel: null,
    generationCostUsd: null,
    tokensIn: null,
    tokensOut: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now
  }

  index.assets.unshift(fallbackRecord)
  await writeFallbackIndex(index)
  return mapFallbackAsset(fallbackRecord)
}

export async function updateMediaAssetStatus(
  assetId: string,
  status: MediaAssetStatus,
  extras?: UpdateMediaAssetStatusExtras
): Promise<MediaAssetSummary | null> {
  if (shouldAttemptDb()) {
    try {
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

      markDbSuccess()
      return mapDbAsset(updated)
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const target = index.assets.find((asset) => asset.id === assetId)

  if (!target) {
    return null
  }

  target.status = status
  if (extras?.content !== undefined) target.content = extras.content
  if (extras?.renderHints !== undefined) target.renderHints = extras.renderHints
  if (extras?.generationModel !== undefined) target.generationModel = extras.generationModel
  if (extras?.generationCostUsd !== undefined) {
    target.generationCostUsd = round6(extras.generationCostUsd)
  }
  if (extras?.tokensIn !== undefined) target.tokensIn = extras.tokensIn
  if (extras?.tokensOut !== undefined) target.tokensOut = extras.tokensOut
  if (extras?.reviewedBy !== undefined) target.reviewedBy = extras.reviewedBy
  if (extras?.reviewedAt !== undefined) target.reviewedAt = extras.reviewedAt.toISOString()
  if (extras?.rejectionReason !== undefined) target.rejectionReason = extras.rejectionReason
  if (extras?.lessonId !== undefined) target.lessonId = extras.lessonId
  target.updatedAt = new Date().toISOString()

  await writeFallbackIndex(index)
  return mapFallbackAsset(target)
}

export async function getMediaAsset(
  assetId: string
): Promise<MediaAssetSummary | null> {
  if (shouldAttemptDb()) {
    try {
      const dbAsset = await prisma.mediaAsset.findUnique({
        where: { id: assetId }
      })

      if (dbAsset) {
        markDbSuccess()
        return mapDbAsset(dbAsset)
      }

      markDbSuccess()
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()
  const fallbackAsset = index.assets.find((asset) => asset.id === assetId)

  if (!fallbackAsset) {
    return null
  }

  return mapFallbackAsset(fallbackAsset)
}

export async function listMediaAssets(
  filters?: ListMediaAssetsFilters,
  limit = 50
): Promise<MediaAssetSummary[]> {
  const items: MediaAssetSummary[] = []

  if (shouldAttemptDb()) {
    try {
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

      markDbSuccess()
      items.push(...dbAssets.map(mapDbAsset))
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()

  const filtered = index.assets.filter((asset) => {
    if (filters?.documentId && asset.documentId !== filters.documentId) return false
    if (filters?.type && asset.type !== filters.type) return false
    if (filters?.status && asset.status !== filters.status) return false
    if (filters?.enrichmentJobId && asset.enrichmentJobId !== filters.enrichmentJobId) return false
    return true
  })

  items.push(...filtered.map(mapFallbackAsset))

  const unique = new Map<string, MediaAssetSummary>()

  for (const item of items) {
    unique.set(item.id, item)
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit)
}

export async function listApprovedAssetsForLesson(
  lessonId: string
): Promise<MediaAssetSummary[]> {
  const items: MediaAssetSummary[] = []

  if (shouldAttemptDb()) {
    try {
      const dbAssets = await prisma.mediaAsset.findMany({
        where: {
          lessonId,
          status: "GENERATED"
        },
        orderBy: { chunkOrdinal: "asc" }
      })

      markDbSuccess()
      items.push(...dbAssets.map(mapDbAsset))
    } catch {
      markDbFailure()
    }
  }

  const index = await readFallbackIndex()

  const fallbackAssets = index.assets.filter(
    (asset) => asset.lessonId === lessonId && asset.status === "GENERATED"
  )

  items.push(...fallbackAssets.map(mapFallbackAsset))

  const unique = new Map<string, MediaAssetSummary>()

  for (const item of items) {
    unique.set(item.id, item)
  }

  return [...unique.values()].sort((left, right) => {
    const leftOrd = left.chunkOrdinal ?? Number.MAX_SAFE_INTEGER
    const rightOrd = right.chunkOrdinal ?? Number.MAX_SAFE_INTEGER
    return leftOrd - rightOrd
  })
}
