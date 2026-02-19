import { EnrichmentJobStatus, MediaAssetStatus, MediaAssetType } from "@prisma/client"
import { analyzeChunk } from "@/lib/media-agent/analyzer"
import { generateMediaContent } from "@/lib/media-agent/generators"
import {
  createEnrichmentJob,
  createMediaAsset,
  getEnrichmentJob,
  updateEnrichmentJob,
  updateMediaAssetStatus,
  listMediaAssets,
} from "@/lib/media-agent/repository"
import {
  assertBudgetAllowsGeneration,
  getBudgetStatus,
  recordBudgetUsage,
} from "@/lib/budget/service"
import { getCurriculumDocument } from "@/lib/curriculum/repository"
import { listReadyCurriculumChunks } from "@/lib/curriculum/repository"
import type { EnrichDocumentInput, SupportedLocale } from "@/lib/media-agent/types"
import { MEDIA_BUDGET_PER_ENRICHMENT_USD, MAX_ASSETS_PER_DOCUMENT } from "@/lib/media-agent/types"

// ---------------------------------------------------------------------------
// enrichDocument — Stage 1: Analyze chunks and produce storyboard previews
// ---------------------------------------------------------------------------

export async function enrichDocument(input: EnrichDocumentInput) {
  // -- Validate the document exists and is in READY status ----------------
  const document = await getCurriculumDocument(input.documentId)

  if (!document) {
    throw new Error(`Document not found: ${input.documentId}`)
  }

  if (document.status !== "READY") {
    throw new Error(
      `Document ${input.documentId} is not ready for enrichment (status: ${document.status})`
    )
  }

  // -- Check budget allows generation -------------------------------------
  const budgetStatus = await assertBudgetAllowsGeneration(
    MEDIA_BUDGET_PER_ENRICHMENT_USD
  )

  // -- Determine locale and compact mode ----------------------------------
  const locale: SupportedLocale = input.locale ?? "tr"
  const compactMode = budgetStatus.shortResponseMode

  // -- Create the enrichment job in QUEUED status -------------------------
  const job = await createEnrichmentJob({
    documentId: input.documentId,
    locale,
    mediaTypesRequested: input.mediaTypes?.map(String) ?? [],
    budgetModeAtStart: budgetStatus.mode,
  })

  try {
    // -- Transition to ANALYZING ------------------------------------------
    await updateEnrichmentJob(job.id, {
      status: EnrichmentJobStatus.ANALYZING,
      startedAt: new Date(),
    })

    // -- Retrieve chunks for this document --------------------------------
    const allChunks = await listReadyCurriculumChunks()
    const documentChunks = allChunks.filter(
      (chunk) => chunk.documentId === input.documentId
    )

    if (documentChunks.length === 0) {
      throw new Error(
        `No ready chunks found for document ${input.documentId}`
      )
    }

    // -- Analyze each chunk and collect storyboards -----------------------
    let totalAnalysisCost = 0
    let assetCount = 0

    for (const chunk of documentChunks) {
      if (assetCount >= MAX_ASSETS_PER_DOCUMENT) {
        break
      }

      const analysis = await analyzeChunk({
        chunkOrdinal: chunk.chunkOrdinal,
        documentId: input.documentId,
        documentTitle: document.title,
        content: chunk.content,
        locale,
        compactMode,
        allowedTypes: input.mediaTypes,
      })

      totalAnalysisCost += analysis.totalCostUsd

      // Create a MediaAsset for each storyboard preview
      for (const storyboard of analysis.storyboards) {
        if (assetCount >= MAX_ASSETS_PER_DOCUMENT) {
          break
        }

        await createMediaAsset({
          enrichmentJobId: job.id,
          documentId: input.documentId,
          chunkOrdinal: chunk.chunkOrdinal,
          type: storyboard.mediaType,
          locale,
          title: storyboard.title,
          altText: storyboard.altText,
          storyboard: storyboard.detailedDescription,
        })

        assetCount += 1
      }

      // Record analysis cost in the budget ledger for this chunk
      if (analysis.totalCostUsd > 0) {
        await recordBudgetUsage({
          provider: "bedrock",
          model: "anthropic.claude-3-5-haiku-20241022-v1:0",
          requestType: "media_analysis",
          costUsd: analysis.totalCostUsd,
          tokensIn: analysis.totalTokensIn,
          tokensOut: analysis.totalTokensOut,
        })
      }
    }

    // -- Transition to STORYBOARD_READY -----------------------------------
    await updateEnrichmentJob(job.id, {
      status: EnrichmentJobStatus.STORYBOARD_READY,
      totalCostUsd: totalAnalysisCost,
    })

    // -- Return the full job detail with assets ---------------------------
    const jobDetail = await getEnrichmentJob(job.id)

    if (!jobDetail) {
      throw new Error(`Failed to retrieve enrichment job after creation: ${job.id}`)
    }

    return jobDetail
  } catch (error) {
    // -- On any failure, mark the job as FAILED ---------------------------
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during enrichment"

    await updateEnrichmentJob(job.id, {
      status: EnrichmentJobStatus.FAILED,
      errorMessage,
      completedAt: new Date(),
    })

    throw error
  }
}

// ---------------------------------------------------------------------------
// generateApprovedAssets — Stage 2: Generate actual media from storyboards
// ---------------------------------------------------------------------------

export async function generateApprovedAssets(jobId: string) {
  // -- Retrieve the job ---------------------------------------------------
  const job = await getEnrichmentJob(jobId)

  if (!job) {
    throw new Error(`Enrichment job not found: ${jobId}`)
  }

  // -- Filter to only STORYBOARD_APPROVED assets --------------------------
  const approvedAssets = job.assets.filter(
    (asset) => asset.status === MediaAssetStatus.STORYBOARD_APPROVED
  )

  if (approvedAssets.length === 0) {
    throw new Error(
      `No approved storyboards found for job ${jobId}. Approve storyboards before generating.`
    )
  }

  // -- Check budget allows generation -------------------------------------
  await assertBudgetAllowsGeneration(MEDIA_BUDGET_PER_ENRICHMENT_USD)

  // -- Retrieve the source document for context ---------------------------
  const document = await getCurriculumDocument(job.documentId)
  const documentTitle = document?.title ?? "Untitled"

  // -- Retrieve chunk content for generation context ----------------------
  const allChunks = await listReadyCurriculumChunks()
  const chunksByOrdinal = new Map(
    allChunks
      .filter((c) => c.documentId === job.documentId)
      .map((c) => [c.chunkOrdinal, c])
  )

  // -- Determine compact mode from current budget status ------------------
  const currentBudget = await getBudgetStatus(MEDIA_BUDGET_PER_ENRICHMENT_USD)
  const compactMode = currentBudget.shortResponseMode

  // -- Transition to GENERATING -------------------------------------------
  await updateEnrichmentJob(jobId, {
    status: EnrichmentJobStatus.GENERATING,
  })

  let assetsGenerated = 0
  let assetsFailed = 0
  let cumulativeCostUsd = job.totalCostUsd // carry over analysis cost
  let budgetExceeded = false

  try {
    for (const asset of approvedAssets) {
      // Check per-enrichment budget before each generation
      if (cumulativeCostUsd >= MEDIA_BUDGET_PER_ENRICHMENT_USD) {
        budgetExceeded = true
        break
      }

      // Mark asset as GENERATING
      await updateMediaAssetStatus(asset.id, MediaAssetStatus.GENERATING)

      try {
        // Resolve chunk content for this asset
        const chunk = asset.chunkOrdinal !== null
          ? chunksByOrdinal.get(asset.chunkOrdinal)
          : undefined
        const chunkContent = chunk?.content ?? ""

        // Generate the actual media content
        const result = await generateMediaContent(
          asset.type as MediaAssetType,
          {
            chunkContent,
            documentTitle,
            locale: asset.locale as SupportedLocale,
            storyboard: asset.storyboard,
            compactMode,
          }
        )

        // Update asset with generated content
        await updateMediaAssetStatus(asset.id, MediaAssetStatus.GENERATED, {
          content: result.content,
          renderHints: result.renderHints,
          generationModel: result.generationModel,
          generationCostUsd: result.costUsd,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        })

        // Record generation cost in the budget ledger
        await recordBudgetUsage({
          provider: "bedrock",
          model: result.generationModel,
          requestType: "media_generation",
          costUsd: result.costUsd,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        })

        cumulativeCostUsd += result.costUsd
        assetsGenerated += 1
      } catch (assetError) {
        // Mark individual asset as FAILED but continue with others
        const assetErrorMessage =
          assetError instanceof Error
            ? assetError.message
            : "Unknown generation error"

        await updateMediaAssetStatus(asset.id, MediaAssetStatus.FAILED, {
          rejectionReason: assetErrorMessage,
        })

        assetsFailed += 1
      }
    }

    // -- Determine final job status ---------------------------------------
    let finalStatus: EnrichmentJobStatus

    if (budgetExceeded) {
      finalStatus = EnrichmentJobStatus.PARTIALLY_COMPLETED
    } else if (assetsFailed > 0 && assetsGenerated === 0) {
      finalStatus = EnrichmentJobStatus.FAILED
    } else if (assetsFailed > 0) {
      finalStatus = EnrichmentJobStatus.PARTIALLY_COMPLETED
    } else {
      finalStatus = EnrichmentJobStatus.COMPLETED
    }

    // -- Update job with final counters -----------------------------------
    const errorMessage = budgetExceeded
      ? `Budget limit reached ($${MEDIA_BUDGET_PER_ENRICHMENT_USD}). Some assets were not generated.`
      : assetsFailed > 0
        ? `${assetsFailed} asset(s) failed during generation.`
        : null

    await updateEnrichmentJob(jobId, {
      status: finalStatus,
      assetsGenerated,
      assetsFailed,
      totalCostUsd: cumulativeCostUsd,
      errorMessage,
      completedAt: new Date(),
    })

    // -- Return the updated job detail ------------------------------------
    const updatedJob = await getEnrichmentJob(jobId)

    if (!updatedJob) {
      throw new Error(`Failed to retrieve enrichment job after generation: ${jobId}`)
    }

    return updatedJob
  } catch (error) {
    // -- On unexpected failure, mark job as FAILED ------------------------
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during generation"

    await updateEnrichmentJob(jobId, {
      status: EnrichmentJobStatus.FAILED,
      assetsGenerated,
      assetsFailed,
      totalCostUsd: cumulativeCostUsd,
      errorMessage,
      completedAt: new Date(),
    })

    throw error
  }
}
