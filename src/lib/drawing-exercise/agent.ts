import { callLlmJson } from "@/lib/media-agent/llm";
import type { DrawingMessage } from "@prisma/client";
import type { ElementStatus, ExerciseElement, ExerciseSpec, PromptAnalysis } from "./types";

const OLLAMA_BASE_URL = "http://localhost:11434";
const OLLAMA_MODEL = "qwen3:32b";

type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmAgentResponse = {
  message: string;
  detectedElements: Record<string, ElementStatus>;
  confidence: number;
};

function buildSystemPrompt(spec: ExerciseSpec): string {
  const elementList = spec.elements
    .map((el: ExerciseElement) => {
      const hints = el.detectionHints.join(", ");
      const dep = el.dependsOn ? ` (bağımlılık: ${el.dependsOn})` : "";
      return `  - id: "${el.id}", etiket: "${el.labelTr}"${dep}, ipuçları: [${hints}]`;
    })
    .join("\n");

  const elementIds = spec.elements.map((e: ExerciseElement) => `"${e.id}"`).join(", ");

  return `Sen 8-14 yaş arası çocuklar için tasarlanmış bir çizim asistanısın. Görevin, çocuğun verdiği açıklamayı analiz etmek ve sadece açıkça belirtilen unsurları çizmektir.

ÖNEMLİ KURALLAR:
- SADECE çocuğun açıkça tarif ettiği şeyleri çiz. Tarif edilmeyen detaylar ekleme.
- Hedef resmi veya hangi detayların eksik olduğunu ASLA açıklama.
- Yazım hatalarını ve Türkçe eş anlamlıları kabul et.
- Yanıtın sıcak, teşvik edici ve 1-2 cümle olsun.

HEDEF RESMİN UNSURLARI:
${elementList}

YANIT FORMATI (JSON):
{
  "message": "Türkçe, sıcak ve teşvik edici mesaj (1-2 cümle)",
  "detectedElements": {
    ${elementIds.split(", ").map((id: string) => `${id}: "present" | "partial" | "missing"`).join(",\n    ")}
  },
  "confidence": 0.0-1.0
}

Her unsur için:
- "present": Açıkça ve doğru tarif edilmiş
- "partial": Kısmen tarif edilmiş veya belirsiz
- "missing": Hiç bahsedilmemiş`;
}

async function callOllamaJson(
  systemPrompt: string,
  messages: OllamaMessage[]
): Promise<LlmAgentResponse> {
  const allMessages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: allMessages,
      format: "json",
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string = data.message?.content ?? "";
  return JSON.parse(content) as LlmAgentResponse;
}

function buildConversationHistory(
  recentMessages: DrawingMessage[]
): OllamaMessage[] {
  return recentMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}

function validateAnalysisResponse(
  raw: unknown,
  spec: ExerciseSpec
): LlmAgentResponse {
  const validStatuses = new Set<string>(["present", "partial", "missing"]);
  const result = raw as Partial<LlmAgentResponse>;

  const message =
    typeof result.message === "string" && result.message.trim().length > 0
      ? result.message.trim()
      : "Harika! Çizimin güncelleniyor.";

  const confidence =
    typeof result.confidence === "number" &&
    result.confidence >= 0 &&
    result.confidence <= 1
      ? result.confidence
      : 0.5;

  const detectedElements: Record<string, ElementStatus> = {};
  const rawDetected = result.detectedElements ?? {};

  for (const element of spec.elements) {
    const rawStatus = (rawDetected as Record<string, unknown>)[element.id];
    if (typeof rawStatus === "string" && validStatuses.has(rawStatus)) {
      detectedElements[element.id] = rawStatus as ElementStatus;
    } else {
      detectedElements[element.id] = "missing";
    }
  }

  return { message, detectedElements, confidence };
}

/**
 * Analyzes a child's prompt against the exercise elements.
 * Tries the configured LLM provider first, falls back to Ollama if it fails.
 */
export async function analyzePrompt(
  spec: ExerciseSpec,
  userMessage: string,
  recentMessages: DrawingMessage[]
): Promise<PromptAnalysis & { costUsd: number }> {
  const systemPrompt = buildSystemPrompt(spec);
  const history = buildConversationHistory(recentMessages);
  const maxTokens = spec.agentConfig?.maxResponseTokens ?? 512;

  const conversationMessages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ];

  // Try primary LLM provider first
  try {
    const result = await callLlmJson<LlmAgentResponse>({
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
      ],
      maxTokens,
      temperature: 0.3,
      jsonMode: true,
    });

    const validated = validateAnalysisResponse(result.parsed, spec);
    return {
      message: validated.message,
      detectedElements: validated.detectedElements,
      confidence: validated.confidence,
      costUsd: result.costUsd,
    };
  } catch (primaryError) {
    // Fall back to local Ollama
    console.warn("[drawing-agent] Primary LLM failed, falling back to Ollama:", primaryError);

    try {
      const raw = await callOllamaJson(systemPrompt, conversationMessages);
      const validated = validateAnalysisResponse(raw, spec);
      return {
        message: validated.message,
        detectedElements: validated.detectedElements,
        confidence: validated.confidence,
        costUsd: 0,
      };
    } catch (ollamaError) {
      console.error("[drawing-agent] Ollama fallback also failed:", ollamaError);
      // Return a graceful degradation response
      const fallbackElements: Record<string, ElementStatus> = {};
      for (const element of spec.elements) {
        fallbackElements[element.id] = "missing";
      }
      return {
        message: "Çiziminizi aldım! Devam edin.",
        detectedElements: fallbackElements,
        confidence: 0,
        costUsd: 0,
      };
    }
  }
}
