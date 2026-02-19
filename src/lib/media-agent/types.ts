import type { MediaAssetStatus, MediaAssetType, EnrichmentJobStatus } from "@prisma/client"

export type SupportedLocale = "tr" | "en"

export type MediaRecommendation = {
  type: MediaAssetType;
  reason: string;
  priority: number; // 1 = highest
  estimatedCostUsd: number;
}

export type ContentCharacteristics = {
  hasSequentialSteps: boolean;
  hasHierarchicalConcepts: boolean;
  hasVisualSubject: boolean;
  hasDenseInformation: boolean;
  hasNarrativeContent: boolean;
  hasTestableKnowledge: boolean;
}

export type ChunkAnalysis = {
  chunkOrdinal: number;
  documentId: string;
  characteristics: ContentCharacteristics;
  recommendations: MediaRecommendation[];
  storyboards: StoryboardPreview[];
}

export type StoryboardPreview = {
  mediaType: MediaAssetType;
  title: string;
  altText: string;
  detailedDescription: string; // the rich text-based storyboard preview
  estimatedCostUsd: number;
}

export type MediaAssetSummary = {
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

export type EnrichmentJobSummary = {
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

export type EnrichmentJobDetail = EnrichmentJobSummary & {
  assets: MediaAssetSummary[];
}

export type EnrichDocumentInput = {
  documentId: string;
  locale?: SupportedLocale;
  mediaTypes?: MediaAssetType[];
}

export type ReviewAssetInput = {
  assetId: string;
  action: "approve" | "reject";
  reviewedBy: string;
  rejectionReason?: string;
}

export type MediaGeneratorInput = {
  chunkContent: string;
  documentTitle: string;
  locale: SupportedLocale;
  storyboard: string;
  compactMode: boolean;
}

export type MediaGeneratorOutput = {
  content: Record<string, unknown>;
  renderHints: Record<string, unknown>;
  generationModel: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export const MEDIA_BUDGET_PER_ENRICHMENT_USD = Number(
  process.env.MEDIA_BUDGET_PER_LESSON_USD ?? "0.06"
)

export const MAX_ASSETS_PER_DOCUMENT = 10
