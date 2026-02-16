import { listReadyCurriculumChunks } from "@/lib/curriculum/repository";
import type { CurriculumChunkContext } from "@/lib/curriculum/types";
import type {
  AssistantReference,
  ScopeConstrainedReply,
  ScopeConstrainedReplyInput
} from "@/lib/assistant/types";

type ScoredChunk = {
  chunk: CurriculumChunkContext;
  score: number;
  matchedTokens: number;
};

const MAX_CHUNK_SCAN = 160;
const MAX_REFERENCES = 3;
const MIN_MATCHED_TOKENS = 2;
const MIN_SCOPE_SCORE = 6;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "from",
  "that",
  "this",
  "with",
  "have",
  "your",
  "what",
  "when",
  "where",
  "which",
  "about",
  "into",
  "a",
  "an",
  "to",
  "of",
  "in",
  "on",
  "is",
  "are",
  "be",
  "can",
  "will",
  "how",
  "why",
  "bu",
  "ve",
  "icin",
  "ile",
  "bir",
  "ne",
  "neden",
  "nasil",
  "hangi",
  "olan",
  "gibi",
  "ama",
  "daha",
  "olan",
  "mi",
  "mu",
  "midir",
  "midir",
  "icin",
  "kadar",
  "gore",
  "gorev",
  "ders",
  "lesson",
  "track"
]);

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

function clip(value: string, maxLength = 180) {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3).trim()}...`;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function buildBigrams(tokens: string[]) {
  const bigrams: string[] = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }

  return bigrams;
}

function scoreChunk(questionTokens: string[], questionBigrams: string[], chunk: CurriculumChunkContext) {
  const haystack = normalizeText(chunk.content);

  let matchedTokens = 0;

  for (const token of questionTokens) {
    if (haystack.includes(token)) {
      matchedTokens += 1;
    }
  }

  let bigramHits = 0;

  for (const bigram of questionBigrams) {
    if (haystack.includes(bigram)) {
      bigramHits += 1;
    }
  }

  const score = matchedTokens * 3 + bigramHits * 2;

  return {
    chunk,
    score,
    matchedTokens
  };
}

function toReference(item: ScoredChunk): AssistantReference {
  return {
    documentId: item.chunk.documentId,
    documentTitle: item.chunk.documentTitle,
    chunkOrdinal: item.chunk.chunkOrdinal,
    excerpt: clip(item.chunk.content),
    track: item.chunk.track,
    score: item.score
  };
}

function inScopeAnswer(locale: "tr" | "en", references: AssistantReference[]) {
  const points = references.map((item, index) => `${index + 1}) ${item.excerpt}`);

  if (locale === "tr") {
    return `Sorunu yalnizca yuklu mufredat iceriginden yanitliyorum:\n${points.join("\n")}`;
  }

  return `Answering only from uploaded curriculum content:\n${points.join("\n")}`;
}

function outOfScopeAnswer(locale: "tr" | "en") {
  if (locale === "tr") {
    return "Bu soru secilen ders izindeki yuklu mufredatla eslesmiyor. Yalnizca mufredat ve AI modulu icerigine dayali yanit verebilirim.";
  }

  return "This question does not match the uploaded content for the selected track. I can only answer from curriculum and AI module content.";
}

function suggestedPrompt(locale: "tr" | "en", references: AssistantReference[]) {
  const anchor = references[0]?.excerpt;

  if (!anchor) {
    return locale === "tr"
      ? "Yuklu mufredattaki bir kavrami sec ve onu aciklamami iste."
      : "Pick one concept from the uploaded curriculum and ask me to explain it.";
  }

  if (locale === "tr") {
    return `"${clip(anchor, 80)}" fikrini adim adim aciklar misin?`;
  }

  return `Can you explain "${clip(anchor, 80)}" step by step?`;
}

export async function respondWithScopeGuard(
  input: ScopeConstrainedReplyInput
): Promise<ScopeConstrainedReply> {
  const allSources = await listReadyCurriculumChunks(MAX_CHUNK_SCAN);

  if (allSources.length === 0) {
    throw new Error(
      "No READY curriculum chunks found. Upload and process curriculum before using the assistant."
    );
  }

  const trackSources = allSources.filter((chunk) => chunk.track === input.track);
  const sources = trackSources.length > 0 ? trackSources : allSources;
  const questionTokens = [...new Set(tokenize(input.question))];
  const questionBigrams = buildBigrams(questionTokens);

  if (questionTokens.length === 0) {
    return {
      status: "OUT_OF_SCOPE",
      answer: outOfScopeAnswer(input.locale),
      references: [],
      redirect: {
        recommendedAction: "RETURN_TO_CURRICULUM",
        suggestedPrompt: suggestedPrompt(input.locale, [])
      },
      guardrail: {
        sourcePolicy: "curriculum_only",
        track: input.track,
        matchedTokenCount: 0,
        scannedChunks: sources.length
      }
    };
  }

  const ranked = sources
    .map((chunk) => scoreChunk(questionTokens, questionBigrams, chunk))
    .sort((left, right) => right.score - left.score || right.chunk.chunkOrdinal - left.chunk.chunkOrdinal);

  const best = ranked[0];
  const matchedTokenCount = best?.matchedTokens ?? 0;
  const isInScope = Boolean(
    best && best.matchedTokens >= MIN_MATCHED_TOKENS && best.score >= MIN_SCOPE_SCORE
  );

  if (!isInScope) {
    const redirectReferences = ranked.filter((item) => item.score > 0).slice(0, 1).map(toReference);

    return {
      status: "OUT_OF_SCOPE",
      answer: outOfScopeAnswer(input.locale),
      references: redirectReferences,
      redirect: {
        recommendedAction: "RETURN_TO_CURRICULUM",
        suggestedPrompt: suggestedPrompt(input.locale, redirectReferences)
      },
      guardrail: {
        sourcePolicy: "curriculum_only",
        track: input.track,
        matchedTokenCount,
        scannedChunks: sources.length
      }
    };
  }

  const references = ranked
    .filter((item) => item.score > 0)
    .slice(0, MAX_REFERENCES)
    .map(toReference);

  return {
    status: "IN_SCOPE",
    answer: inScopeAnswer(input.locale, references),
    references,
    redirect: {
      recommendedAction: "RETURN_TO_CURRICULUM",
      suggestedPrompt: suggestedPrompt(input.locale, references)
    },
    guardrail: {
      sourcePolicy: "curriculum_only",
      track: input.track,
      matchedTokenCount,
      scannedChunks: sources.length
    }
  };
}
