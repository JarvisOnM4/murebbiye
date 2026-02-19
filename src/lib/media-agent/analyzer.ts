import { MediaAssetType } from "@prisma/client"
import { callLlmJson } from "@/lib/media-agent/llm"
import type {
  ChunkAnalysis,
  ContentCharacteristics,
  MediaRecommendation,
  StoryboardPreview,
  SupportedLocale,
} from "@/lib/media-agent/types"

// ---------------------------------------------------------------------------
// Stage 1: Keyword heuristic analysis (zero cost)
// ---------------------------------------------------------------------------

function analyzeCharacteristics(content: string): ContentCharacteristics {
  return {
    hasSequentialSteps:
      /(?:step\s*\d|first.*then|ad[ıi]m\s*\d|[oö]nce.*sonra|\d\.\s+\w)/i.test(content),
    hasHierarchicalConcepts:
      /(?:types?\s+of|categories|hierarchy|s[ıi]n[ıi]fland|t[uü]rleri|alt\s*kategori)/i.test(content),
    hasVisualSubject:
      /(?:diagram|chart|graph|illustrat|g[oö]rsel|[sş]ekil|tablo|figure)/i.test(content),
    hasDenseInformation:
      content.length > 800 || (content.match(/\n/g)?.length ?? 0) > 15,
    hasNarrativeContent:
      /(?:story|example|imagine|scenario|hikaye|[oö]rnek|d[uü][sş][uü]n|senaryo)/i.test(content),
    hasTestableKnowledge:
      /(?:define|what is|explain|difference|tan[ıi]mla|nedir|a[cç][ıi]kla|fark)/i.test(content),
  }
}

// ---------------------------------------------------------------------------
// Map characteristics to recommended media types
// ---------------------------------------------------------------------------

function recommendMediaTypes(chars: ContentCharacteristics): MediaRecommendation[] {
  const recs: MediaRecommendation[] = []

  if (chars.hasSequentialSteps) {
    recs.push({
      type: MediaAssetType.FLOWCHART,
      reason: "Content contains sequential steps that can be visualized as a flow",
      priority: 1,
      estimatedCostUsd: 0.002,
    })
  }

  if (chars.hasHierarchicalConcepts) {
    recs.push({
      type: MediaAssetType.DIAGRAM,
      reason: "Content contains hierarchical concepts suitable for a concept map",
      priority: 1,
      estimatedCostUsd: 0.002,
    })
  }

  if (chars.hasTestableKnowledge) {
    recs.push({
      type: MediaAssetType.INTERACTIVE,
      reason: "Content contains testable knowledge suitable for interactive exercises",
      priority: 2,
      estimatedCostUsd: 0.003,
    })
  }

  if (chars.hasDenseInformation) {
    recs.push({
      type: MediaAssetType.SLIDE_DECK,
      reason: "Dense content benefits from structured slide presentation",
      priority: 2,
      estimatedCostUsd: 0.004,
    })
  }

  if (chars.hasNarrativeContent) {
    recs.push({
      type: MediaAssetType.CARTOON_NARRATIVE,
      reason: "Narrative content can be illustrated as a visual story",
      priority: 3,
      estimatedCostUsd: 0.004,
    })
  }

  if (chars.hasVisualSubject) {
    recs.push({
      type: MediaAssetType.ILLUSTRATION,
      reason: "Content references visual subjects that benefit from illustration",
      priority: 3,
      estimatedCostUsd: 0.003,
    })
  }

  // If nothing matched, default to a diagram and interactive exercise
  if (recs.length === 0) {
    recs.push(
      {
        type: MediaAssetType.DIAGRAM,
        reason: "Default: visualize key concepts",
        priority: 2,
        estimatedCostUsd: 0.002,
      },
      {
        type: MediaAssetType.INTERACTIVE,
        reason: "Default: create practice exercise",
        priority: 2,
        estimatedCostUsd: 0.003,
      }
    )
  }

  return recs.sort((a, b) => a.priority - b.priority)
}

// ---------------------------------------------------------------------------
// Stage 2: Generate detailed storyboard previews using LLM
// ---------------------------------------------------------------------------
// These storyboards are THE key output -- they must be incredibly detailed
// so the admin can understand exactly what will be produced.

async function generateStoryboards(
  content: string,
  documentTitle: string,
  locale: SupportedLocale,
  recommendations: MediaRecommendation[],
  compactMode: boolean
): Promise<{
  storyboards: StoryboardPreview[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}> {
  const mediaTypeDescriptions = recommendations
    .map((r) => `- ${r.type}: ${r.reason}`)
    .join("\n")

  const localeInstruction =
    locale === "tr"
      ? "Write ALL storyboard descriptions in Turkish. Use clear, educational Turkish language."
      : "Write ALL storyboard descriptions in English. Use clear, educational language."

  const compactInstruction = compactMode
    ? "Keep descriptions concise but still detailed enough to understand the final output."
    : "Be EXTREMELY detailed. Describe every visual element, every text block, every interaction. The admin must be able to picture the final product perfectly."

  const systemPrompt = `You are an expert educational content designer. Your job is to create detailed storyboard previews for educational media assets.

${localeInstruction}

For each recommended media type, produce a storyboard that describes IN DETAIL what the final media asset will contain. ${compactInstruction}

For DIAGRAM/FLOWCHART: Describe every node, every connection, every label. List the exact text that will appear in each box. Describe the layout direction (top-to-bottom, left-to-right).

For SLIDE_DECK: Write out every slide title, every bullet point, every speaker note. Describe transitions and emphasis.

For INTERACTIVE: Describe the exact exercise type (fill-in-blank, matching, ordering), every question, every answer option, the correct answer, and the feedback message.

For VIDEO_SCRIPT: Write the complete narration text, describe each scene, timing, and visual cues.

For CARTOON_NARRATIVE: Describe each panel -- who/what is shown, what they say/think, the visual setting, and the teaching point.

For ILLUSTRATION: Describe the complete visual composition -- subjects, background, labels, annotations, color palette, style.

Output MUST be valid JSON matching this schema:
{
  "storyboards": [
    {
      "mediaType": "DIAGRAM|FLOWCHART|SLIDE_DECK|INTERACTIVE|CARTOON_NARRATIVE|ILLUSTRATION|VIDEO_SCRIPT",
      "title": "Short descriptive title for this asset",
      "altText": "Accessibility text describing the asset",
      "detailedDescription": "The FULL detailed storyboard text. Multiple paragraphs. Every element described."
    }
  ]
}`

  const userPrompt = `Document: "${documentTitle}"

Curriculum content to analyze:
---
${content}
---

Recommended media types to create storyboards for:
${mediaTypeDescriptions}

Generate one detailed storyboard preview for each recommended media type above.`

  const result = await callLlmJson<{
    storyboards: StoryboardPreview[];
  }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: compactMode ? 1500 : 3000,
    temperature: 0.6,
  })

  const storyboards = result.parsed.storyboards.map((sb, idx) => ({
    mediaType: sb.mediaType as unknown as MediaAssetType,
    title: sb.title ?? `Asset ${idx + 1}`,
    altText: sb.altText ?? "",
    detailedDescription: sb.detailedDescription ?? "",
    estimatedCostUsd: recommendations[idx]?.estimatedCostUsd ?? 0.003,
  }))

  return {
    storyboards,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// Main analysis function: analyzes a single chunk
// ---------------------------------------------------------------------------

export async function analyzeChunk(input: {
  chunkOrdinal: number;
  documentId: string;
  documentTitle: string;
  content: string;
  locale: SupportedLocale;
  compactMode: boolean;
  allowedTypes?: MediaAssetType[];
}): Promise<
  ChunkAnalysis & {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
  }
> {
  // Stage 1: keyword analysis (free)
  const characteristics = analyzeCharacteristics(input.content)

  // Stage 2: determine recommendations
  let recommendations = recommendMediaTypes(characteristics)

  // Filter by allowed types if specified
  if (input.allowedTypes && input.allowedTypes.length > 0) {
    recommendations = recommendations.filter((r) =>
      input.allowedTypes!.includes(r.type)
    )
  }

  // In compact mode, limit to top 2 recommendations
  if (input.compactMode && recommendations.length > 2) {
    recommendations = recommendations.slice(0, 2)
  }

  if (recommendations.length === 0) {
    return {
      chunkOrdinal: input.chunkOrdinal,
      documentId: input.documentId,
      characteristics,
      recommendations: [],
      storyboards: [],
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
    }
  }

  // Stage 3: generate storyboards via LLM
  const { storyboards, tokensIn, tokensOut, costUsd } =
    await generateStoryboards(
      input.content,
      input.documentTitle,
      input.locale,
      recommendations,
      input.compactMode
    )

  return {
    chunkOrdinal: input.chunkOrdinal,
    documentId: input.documentId,
    characteristics,
    recommendations,
    storyboards,
    totalTokensIn: tokensIn,
    totalTokensOut: tokensOut,
    totalCostUsd: costUsd,
  }
}
