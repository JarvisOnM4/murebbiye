import { LessonTrack } from "@prisma/client";
import type { CurriculumChunkContext } from "@/lib/curriculum/types";
import type {
  LessonDraftRatio,
  LessonDraftTemplate,
  LessonSourceReference,
  SupportedLocale
} from "@/lib/lesson/types";

type BuildLessonTemplateInput = {
  track: LessonTrack;
  locale: SupportedLocale;
  focusTopic?: string;
  sources: CurriculumChunkContext[];
  compactMode?: boolean;
};

type SourceSentence = {
  text: string;
  source: LessonSourceReference;
};

export const LESSON_TEMPLATE_MINUTES = {
  total: 35,
  explain: 7,
  guidedPractice: 20,
  independentTask: 8
} as const;

const CONTENT_ITEM_BASELINE = 10;

const TRACK_RATIOS: Record<LessonTrack, { explainPercent: number; practicePercent: number }> = {
  ENGLISH: {
    explainPercent: 30,
    practicePercent: 70
  },
  AI_MODULE: {
    explainPercent: 20,
    practicePercent: 80
  }
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, maxLength = 180) {
  const normalized = compactWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function splitSentences(content: string) {
  const rawParts = content
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/));

  return rawParts
    .map((part) => compactWhitespace(part))
    .filter((part) => part.length >= 24 && part.length <= 260);
}

function buildSentencePool(sources: CurriculumChunkContext[]): SourceSentence[] {
  const pool: SourceSentence[] = [];

  for (const chunk of sources) {
    const sentences = splitSentences(chunk.content);
    const fallbackExcerpt = clip(chunk.content, 220);

    if (sentences.length === 0 && fallbackExcerpt) {
      pool.push({
        text: fallbackExcerpt,
        source: {
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          chunkOrdinal: chunk.chunkOrdinal,
          excerpt: fallbackExcerpt
        }
      });
      continue;
    }

    for (const sentence of sentences) {
      pool.push({
        text: sentence,
        source: {
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          chunkOrdinal: chunk.chunkOrdinal,
          excerpt: clip(sentence)
        }
      });
    }
  }

  return pool;
}

function pickSeries(pool: SourceSentence[], count: number, offset = 0): SourceSentence[] {
  const selected: SourceSentence[] = [];

  for (let index = 0; index < count; index += 1) {
    const target = pool[(offset + index) % pool.length];
    selected.push(target);
  }

  return selected;
}

function deriveTopic(
  locale: SupportedLocale,
  providedTopic: string | undefined,
  sentencePool: SourceSentence[]
) {
  const fromInput = compactWhitespace(providedTopic ?? "");

  if (fromInput) {
    return clip(fromInput, 80);
  }

  const firstSentence = sentencePool[0]?.text ?? "";
  const keywords = compactWhitespace(firstSentence)
    .split(" ")
    .slice(0, 6)
    .join(" ");

  if (keywords) {
    return clip(keywords, 80);
  }

  return locale === "tr" ? "temel mufredat becerisi" : "core curriculum skill";
}

function copyForLocale(locale: SupportedLocale) {
  if (locale === "tr") {
    return {
      explainTitle: "Aciklama (7 dk)",
      guidedTitle: "Yonlendirilmis Pratik (20 dk)",
      independentTitle: "Bagimsiz Gorev (8 dk)",
      assessmentTitle: "Mini Degerlendirme",
      objectivePrefix: "Hedef",
      guidedPromptPrefix: "Mufredat fikrini kendi cumlenle acikla ve bir yeni ornek ekle",
      independentPrompt: (topic: string) =>
        `Konu: ${topic}. En az iki mufredat bilgisini kullanarak kisa bir aciklama hazirla ve bir gercek yasam ornegi ekle.`,
      checklist: [
        "Iki dogru kavram kullandim.",
        "En az bir ornek verdim.",
        "Cevabimi anlasilir ve duzenli yazdim."
      ],
      assessmentHint: "Cevapta mufredat terimi + bir ornek olmasi beklenir."
    };
  }

  return {
    explainTitle: "Explain (7 min)",
    guidedTitle: "Guided Practice (20 min)",
    independentTitle: "Independent Task (8 min)",
    assessmentTitle: "Mini Assessment",
    objectivePrefix: "Objective",
    guidedPromptPrefix: "Use this curriculum idea in your own words and add one fresh example",
    independentPrompt: (topic: string) =>
      `Topic: ${topic}. Write a short response using at least two curriculum facts, then add one real-life example.`,
    checklist: [
      "I used at least two accurate curriculum facts.",
      "I included one concrete example.",
      "My response is clear and logically ordered."
    ],
    assessmentHint: "Expected answer includes a curriculum keyword and one example."
  };
}

export function resolveTrackRatio(track: LessonTrack): LessonDraftRatio {
  const ratio = TRACK_RATIOS[track];
  const explainItems = Math.max(2, Math.round((CONTENT_ITEM_BASELINE * ratio.explainPercent) / 100));
  const practiceItems = Math.max(1, CONTENT_ITEM_BASELINE - explainItems);

  return {
    explainPercent: ratio.explainPercent,
    practicePercent: ratio.practicePercent,
    explainItems,
    practiceItems
  };
}

export function buildLessonTemplate(input: BuildLessonTemplateInput): LessonDraftTemplate {
  if (input.sources.length === 0) {
    throw new Error("No curriculum source chunks available for lesson generation.");
  }

  const ratio = resolveTrackRatio(input.track);
  const pool = buildSentencePool(input.sources);

  if (pool.length === 0) {
    throw new Error("Curriculum sources did not produce reusable lesson content.");
  }

  const copy = copyForLocale(input.locale);
  const focusTopic = deriveTopic(input.locale, input.focusTopic, pool);
  const explainCount = input.compactMode ? Math.min(2, ratio.explainItems) : ratio.explainItems;
  const guidedCount = input.compactMode ? Math.min(3, ratio.practiceItems) : ratio.practiceItems;
  const assessmentCount = input.compactMode ? 2 : 3;

  const explainSources = pickSeries(pool, explainCount, 0);
  const guidedSources = pickSeries(pool, guidedCount, ratio.explainItems);
  const assessmentSources = pickSeries(
    pool,
    assessmentCount,
    ratio.explainItems + ratio.practiceItems
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    track: input.track,
    focusTopic,
    ratio,
    schedule: {
      totalMinutes: LESSON_TEMPLATE_MINUTES.total,
      explainMinutes: LESSON_TEMPLATE_MINUTES.explain,
      guidedPracticeMinutes: LESSON_TEMPLATE_MINUTES.guidedPractice,
      independentTaskMinutes: LESSON_TEMPLATE_MINUTES.independentTask
    },
    sections: {
      explain: {
        title: copy.explainTitle,
        objectives: explainSources.map(
          (item, index) => `${copy.objectivePrefix} ${index + 1}: ${clip(item.text, 120)}`
        ),
        keyPoints: explainSources.map((item, index) => `${index + 1}. ${clip(item.text, 180)}`)
      },
      guidedPractice: {
        title: copy.guidedTitle,
        activities: guidedSources.map((item, index) => ({
          id: `guided-${index + 1}`,
          prompt: `${copy.guidedPromptPrefix}: "${clip(item.text, 140)}".`,
          source: item.source
        }))
      },
      independentTask: {
        title: copy.independentTitle,
        prompt: copy.independentPrompt(focusTopic),
        checklist: input.compactMode ? copy.checklist.slice(0, 2) : copy.checklist
      },
      miniAssessment: {
        title: copy.assessmentTitle,
        questions: assessmentSources.map((item, index) => ({
          id: `quiz-${index + 1}`,
          prompt: `Q${index + 1}: ${clip(item.text, 120)}`,
          expectedAnswerHint: copy.assessmentHint,
          source: item.source
        }))
      }
    }
  };
}
