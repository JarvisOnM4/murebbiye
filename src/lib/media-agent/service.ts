import { MediaAssetStatus } from "@prisma/client"
import { enrichDocument, generateApprovedAssets } from "@/lib/media-agent/orchestrator"
import {
  getEnrichmentJob,
  getMediaAsset,
  listEnrichmentJobs,
  listMediaAssets,
  listApprovedAssetsForLesson,
  updateMediaAssetStatus,
} from "@/lib/media-agent/repository"
import type { EnrichDocumentInput, ReviewAssetInput } from "@/lib/media-agent/types"

// ---------------------------------------------------------------------------
// startEnrichment — validate input and kick off Stage 1
// ---------------------------------------------------------------------------

export async function startEnrichment(input: EnrichDocumentInput) {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error("documentId is required")
  }

  try {
    return await enrichDocument(input)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error starting enrichment"
    throw new Error(`Enrichment failed: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// getJob — retrieve a single enrichment job with its assets
// ---------------------------------------------------------------------------

export async function getJob(jobId: string) {
  if (!jobId || jobId.trim().length === 0) {
    throw new Error("jobId is required")
  }

  const job = await getEnrichmentJob(jobId)

  if (!job) {
    throw new Error(`Enrichment job not found: ${jobId}`)
  }

  return job
}

// ---------------------------------------------------------------------------
// listJobs — list enrichment jobs (most recent first)
// ---------------------------------------------------------------------------

export async function listJobs(limit?: number) {
  return listEnrichmentJobs(limit)
}

// ---------------------------------------------------------------------------
// getAsset — retrieve a single media asset
// ---------------------------------------------------------------------------

export async function getAsset(assetId: string) {
  if (!assetId || assetId.trim().length === 0) {
    throw new Error("assetId is required")
  }

  const asset = await getMediaAsset(assetId)

  if (!asset) {
    throw new Error(`Media asset not found: ${assetId}`)
  }

  return asset
}

// ---------------------------------------------------------------------------
// listAssets — list media assets with optional filters
// ---------------------------------------------------------------------------

export async function listAssets(filters?: {
  documentId?: string
  type?: string
  status?: string
  enrichmentJobId?: string
}) {
  return listMediaAssets(
    filters as Parameters<typeof listMediaAssets>[0]
  )
}

// ---------------------------------------------------------------------------
// reviewStoryboard — approve or reject a single storyboard asset
// ---------------------------------------------------------------------------

export async function reviewStoryboard(input: ReviewAssetInput) {
  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new Error("assetId is required")
  }

  if (!input.reviewedBy || input.reviewedBy.trim().length === 0) {
    throw new Error("reviewedBy is required")
  }

  if (input.action !== "approve" && input.action !== "reject") {
    throw new Error("action must be 'approve' or 'reject'")
  }

  // Retrieve the asset and validate its current status
  const asset = await getMediaAsset(input.assetId)

  if (!asset) {
    throw new Error(`Media asset not found: ${input.assetId}`)
  }

  if (asset.status !== MediaAssetStatus.STORYBOARD_PENDING) {
    throw new Error(
      `Asset ${input.assetId} cannot be reviewed (current status: ${asset.status}). ` +
      `Only assets in STORYBOARD_PENDING status can be reviewed.`
    )
  }

  const newStatus =
    input.action === "approve"
      ? MediaAssetStatus.STORYBOARD_APPROVED
      : MediaAssetStatus.STORYBOARD_REJECTED

  const updated = await updateMediaAssetStatus(input.assetId, newStatus, {
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(),
    rejectionReason: input.action === "reject"
      ? (input.rejectionReason ?? null)
      : null,
  })

  if (!updated) {
    throw new Error(`Failed to update asset status: ${input.assetId}`)
  }

  return updated
}

// ---------------------------------------------------------------------------
// approveAllStoryboards — bulk-approve all pending storyboards for a job
// ---------------------------------------------------------------------------

export async function approveAllStoryboards(jobId: string, reviewedBy: string) {
  if (!jobId || jobId.trim().length === 0) {
    throw new Error("jobId is required")
  }

  if (!reviewedBy || reviewedBy.trim().length === 0) {
    throw new Error("reviewedBy is required")
  }

  const job = await getEnrichmentJob(jobId)

  if (!job) {
    throw new Error(`Enrichment job not found: ${jobId}`)
  }

  const pendingAssets = job.assets.filter(
    (asset) => asset.status === MediaAssetStatus.STORYBOARD_PENDING
  )

  if (pendingAssets.length === 0) {
    throw new Error(
      `No pending storyboards found for job ${jobId}. All assets may already be reviewed.`
    )
  }

  const results = []

  for (const asset of pendingAssets) {
    const updated = await updateMediaAssetStatus(
      asset.id,
      MediaAssetStatus.STORYBOARD_APPROVED,
      {
        reviewedBy,
        reviewedAt: new Date(),
      }
    )

    if (updated) {
      results.push(updated)
    }
  }

  return {
    approvedCount: results.length,
    assets: results,
  }
}

// ---------------------------------------------------------------------------
// startGeneration — kick off Stage 2 for approved storyboards
// ---------------------------------------------------------------------------

export async function startGeneration(jobId: string) {
  if (!jobId || jobId.trim().length === 0) {
    throw new Error("jobId is required")
  }

  try {
    return await generateApprovedAssets(jobId)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during generation"
    throw new Error(`Generation failed: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// retryAsset — reset a FAILED asset to STORYBOARD_APPROVED for retry
// ---------------------------------------------------------------------------

export async function retryAsset(assetId: string) {
  if (!assetId || assetId.trim().length === 0) {
    throw new Error("assetId is required")
  }

  const asset = await getMediaAsset(assetId)

  if (!asset) {
    throw new Error(`Media asset not found: ${assetId}`)
  }

  if (asset.status !== MediaAssetStatus.FAILED) {
    throw new Error(
      `Asset ${assetId} cannot be retried (current status: ${asset.status}). ` +
      `Only assets in FAILED status can be retried.`
    )
  }

  const updated = await updateMediaAssetStatus(
    assetId,
    MediaAssetStatus.STORYBOARD_APPROVED,
    {
      rejectionReason: null,
    }
  )

  if (!updated) {
    throw new Error(`Failed to reset asset status: ${assetId}`)
  }

  return updated
}

// ---------------------------------------------------------------------------
// listApprovedAssetsForLesson — get generated assets for a lesson
// ---------------------------------------------------------------------------

export { listApprovedAssetsForLesson }
