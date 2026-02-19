import { MediaAssetType } from "@prisma/client"
import { callLlmJson } from "@/lib/media-agent/llm"
import type {
  MediaGeneratorInput,
  MediaGeneratorOutput,
} from "@/lib/media-agent/types"

// ---------------------------------------------------------------------------
// DIAGRAM GENERATOR
// ---------------------------------------------------------------------------

async function generateDiagram(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Use Turkish labels in the diagram."
      : "Use English labels."

  const result = await callLlmJson<{
    mermaidSyntax: string;
    diagramType: string;
  }>({
    messages: [
      {
        role: "system",
        content: `You are a Mermaid.js diagram expert. Generate valid Mermaid syntax based on the storyboard description. ${localeNote}
Output valid JSON: { "mermaidSyntax": "graph TD\\n  A[...] --> B[...]\\n  ...", "diagramType": "graph|classDiagram|mindmap|sequenceDiagram" }
IMPORTANT: Ensure the Mermaid syntax is valid and will render without errors. Use simple node IDs (A, B, C, etc.). Escape special characters in labels.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the Mermaid diagram.`,
      },
    ],
    maxTokens: input.compactMode ? 800 : 1500,
    temperature: 0.4,
  })

  return {
    content: {
      mermaidSyntax: result.parsed.mermaidSyntax,
      diagramType: result.parsed.diagramType,
    },
    renderHints: { renderer: "mermaid", theme: "default" },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// SLIDE DECK GENERATOR
// ---------------------------------------------------------------------------

async function generateSlides(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Write all slide content in Turkish."
      : "Write all slide content in English."

  const result = await callLlmJson<{
    slides: Array<{ title: string; bullets: string[]; notes?: string }>;
  }>({
    messages: [
      {
        role: "system",
        content: `You are an educational slide deck designer. Create a structured slide deck based on the storyboard. ${localeNote}
Output valid JSON: { "slides": [{ "title": "...", "bullets": ["..."], "notes": "optional speaker notes" }] }
Create 3-5 slides. Each slide should have a clear title and 3-4 bullet points. Keep bullets concise.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the slide deck.`,
      },
    ],
    maxTokens: input.compactMode ? 1000 : 2000,
    temperature: 0.5,
  })

  return {
    content: { slides: result.parsed.slides },
    renderHints: {
      renderer: "slide-carousel",
      slideCount: result.parsed.slides.length,
    },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// INTERACTIVE EXERCISE GENERATOR
// ---------------------------------------------------------------------------

async function generateInteractive(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Write all content in Turkish."
      : "Write all content in English."

  const result = await callLlmJson<{
    exerciseType: "fill_in_blank" | "matching" | "ordering";
    instructions: string;
    items: Array<{
      id: string;
      prompt: string;
      correctAnswer: string;
      options?: string[];
      feedback?: string;
    }>;
  }>({
    messages: [
      {
        role: "system",
        content: `You are an educational exercise designer. Create ONE interactive exercise based on the storyboard. ${localeNote}
Choose the most appropriate type: fill_in_blank, matching, or ordering.
Output valid JSON: {
  "exerciseType": "fill_in_blank|matching|ordering",
  "instructions": "Instructions for the student",
  "items": [{ "id": "q1", "prompt": "...", "correctAnswer": "...", "options": ["...", "..."], "feedback": "Why this is correct" }]
}
Create 3-5 items per exercise. Include clear feedback for correct answers.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the interactive exercise.`,
      },
    ],
    maxTokens: input.compactMode ? 800 : 1500,
    temperature: 0.5,
  })

  return {
    content: {
      exerciseType: result.parsed.exerciseType,
      instructions: result.parsed.instructions,
      items: result.parsed.items,
    },
    renderHints: {
      renderer: "interactive-exercise",
      exerciseType: result.parsed.exerciseType,
      itemCount: result.parsed.items.length,
    },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// VIDEO SCRIPT GENERATOR
// ---------------------------------------------------------------------------

async function generateVideoScript(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Write all narration in Turkish."
      : "Write all narration in English."

  const result = await callLlmJson<{
    scenes: Array<{
      sceneNumber: number;
      narration: string;
      visualDescription: string;
      durationSeconds: number;
    }>;
    totalDurationSeconds: number;
  }>({
    messages: [
      {
        role: "system",
        content: `You are an educational video script writer. Create a structured video script based on the storyboard. ${localeNote}
Output valid JSON: {
  "scenes": [{ "sceneNumber": 1, "narration": "What the narrator says", "visualDescription": "What is shown on screen", "durationSeconds": 30 }],
  "totalDurationSeconds": 120
}
Create 3-5 scenes. Keep total duration under 3 minutes. Narration should be clear and educational.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the video script.`,
      },
    ],
    maxTokens: input.compactMode ? 1000 : 2000,
    temperature: 0.6,
  })

  return {
    content: {
      scenes: result.parsed.scenes,
      totalDurationSeconds: result.parsed.totalDurationSeconds,
    },
    renderHints: {
      renderer: "video-script",
      sceneCount: result.parsed.scenes.length,
    },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// CARTOON NARRATIVE GENERATOR
// ---------------------------------------------------------------------------

async function generateCartoon(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Write all dialogue and descriptions in Turkish."
      : "Write all dialogue and descriptions in English."

  const result = await callLlmJson<{
    panels: Array<{
      panelNumber: number;
      setting: string;
      characters: string;
      dialogue: string;
      teachingPoint: string;
    }>;
  }>({
    messages: [
      {
        role: "system",
        content: `You are a comic/cartoon storyboard artist. Create panel descriptions for a teaching cartoon. ${localeNote}
Output valid JSON: {
  "panels": [{ "panelNumber": 1, "setting": "Visual setting description", "characters": "Who appears", "dialogue": "What they say (speech bubbles)", "teachingPoint": "The concept being taught" }]
}
Create 4-6 panels that tell a short teaching story. Make characters relatable for students.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the cartoon narrative.`,
      },
    ],
    maxTokens: input.compactMode ? 1000 : 2000,
    temperature: 0.7,
  })

  return {
    content: { panels: result.parsed.panels },
    renderHints: {
      renderer: "cartoon-panels",
      panelCount: result.parsed.panels.length,
    },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// ILLUSTRATION GENERATOR
// ---------------------------------------------------------------------------

async function generateIllustration(
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const localeNote =
    input.locale === "tr"
      ? "Write labels and annotations in Turkish."
      : "Write labels and annotations in English."

  const result = await callLlmJson<{
    composition: string;
    subjects: string[];
    labels: Array<{ text: string; position: string }>;
    colorPalette: string[];
    style: string;
    svgPlaceholder: string;
  }>({
    messages: [
      {
        role: "system",
        content: `You are an educational illustrator. Create a detailed visual description for an illustration. ${localeNote}
Since we cannot render actual images yet, provide a detailed text description and a simple SVG placeholder.
Output valid JSON: {
  "composition": "Overall layout description",
  "subjects": ["Main subject 1", "Main subject 2"],
  "labels": [{ "text": "Label text", "position": "top-left|top-right|center|bottom-left|bottom-right" }],
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "style": "flat|hand-drawn|technical|cartoon",
  "svgPlaceholder": "<svg>simple placeholder SVG</svg>"
}
The SVG should be a simple geometric placeholder suggesting the layout, not a full illustration.`,
      },
      {
        role: "user",
        content: `Document: "${input.documentTitle}"\n\nStoryboard:\n${input.storyboard}\n\nGenerate the illustration description.`,
      },
    ],
    maxTokens: input.compactMode ? 800 : 1500,
    temperature: 0.5,
  })

  return {
    content: {
      composition: result.parsed.composition,
      subjects: result.parsed.subjects,
      labels: result.parsed.labels,
      colorPalette: result.parsed.colorPalette,
      style: result.parsed.style,
      svgPlaceholder: result.parsed.svgPlaceholder,
    },
    renderHints: {
      renderer: "illustration-viewer",
      style: result.parsed.style,
    },
    generationModel: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  }
}

// ---------------------------------------------------------------------------
// GENERATOR REGISTRY
// ---------------------------------------------------------------------------

const generators: Record<
  string,
  (input: MediaGeneratorInput) => Promise<MediaGeneratorOutput>
> = {
  [MediaAssetType.DIAGRAM]: generateDiagram,
  [MediaAssetType.FLOWCHART]: generateDiagram, // Same Mermaid renderer, different prompt context
  [MediaAssetType.SLIDE_DECK]: generateSlides,
  [MediaAssetType.INTERACTIVE]: generateInteractive,
  [MediaAssetType.VIDEO_SCRIPT]: generateVideoScript,
  [MediaAssetType.CARTOON_NARRATIVE]: generateCartoon,
  [MediaAssetType.ILLUSTRATION]: generateIllustration,
}

export async function generateMediaContent(
  type: MediaAssetType,
  input: MediaGeneratorInput
): Promise<MediaGeneratorOutput> {
  const generator = generators[type]

  if (!generator) {
    throw new Error(`No generator registered for media type: ${type}`)
  }

  return generator(input)
}
