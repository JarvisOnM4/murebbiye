import type { LessonInteractionInput, LessonMetrics } from "@/lib/reporting/types";

function clamp01(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function round4(value: number) {
  return Number(clamp01(value).toFixed(4));
}

function normalizePrompt(promptText: string) {
  return promptText.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

function computeAccuracyRatio(interactions: LessonInteractionInput[]) {
  const answered = interactions.filter((item) => typeof item.isCorrect === "boolean");

  if (answered.length === 0) {
    return 0;
  }

  const correct = answered.filter((item) => item.isCorrect === true).length;
  return correct / answered.length;
}

function computeHintDependency(interactions: LessonInteractionInput[]) {
  if (interactions.length === 0) {
    return 0;
  }

  const hintCount = interactions.filter((item) => item.usedHint === true).length;
  return hintCount / interactions.length;
}

function computeRepetitionPerformance(interactions: LessonInteractionInput[]) {
  const promptMap = new Map<string, LessonInteractionInput[]>();

  for (const interaction of interactions) {
    const key = normalizePrompt(interaction.promptText);
    const bucket = promptMap.get(key) ?? [];
    bucket.push(interaction);
    promptMap.set(key, bucket);
  }

  let repeatedPromptCount = 0;
  let repeatedPromptCorrectCount = 0;

  for (const bucket of promptMap.values()) {
    if (bucket.length < 2) {
      continue;
    }

    repeatedPromptCount += 1;

    if (bucket.some((interaction) => interaction.isCorrect === true)) {
      repeatedPromptCorrectCount += 1;
    }
  }

  if (repeatedPromptCount === 0) {
    return 1;
  }

  return repeatedPromptCorrectCount / repeatedPromptCount;
}

function computeInteractionQuality(interactions: LessonInteractionInput[]) {
  if (interactions.length === 0) {
    return 0;
  }

  const total = interactions.reduce((sum, interaction) => {
    let score = 0;

    if (interaction.responseText.trim().length >= 24) {
      score += 0.45;
    }

    if (interaction.outOfScopeQuery !== true) {
      score += 0.3;
    }

    if (typeof interaction.responseMs === "number" && interaction.responseMs > 0 && interaction.responseMs <= 120000) {
      score += 0.25;
    }

    return sum + Math.min(score, 1);
  }, 0);

  return total / interactions.length;
}

function computeTimeManagement(interactions: LessonInteractionInput[]) {
  if (interactions.length === 0) {
    return 0;
  }

  const withResponseTime = interactions.filter(
    (interaction) => typeof interaction.responseMs === "number" && interaction.responseMs > 0
  );

  if (withResponseTime.length === 0) {
    return 0;
  }

  const targetWindowCount = withResponseTime.filter((interaction) => (interaction.responseMs ?? 0) <= 60000).length;

  return targetWindowCount / withResponseTime.length;
}

export function computeLessonMetrics(interactions: LessonInteractionInput[]): LessonMetrics {
  return {
    accuracyRatio: round4(computeAccuracyRatio(interactions)),
    hintDependency: round4(computeHintDependency(interactions)),
    repetitionPerformance: round4(computeRepetitionPerformance(interactions)),
    interactionQuality: round4(computeInteractionQuality(interactions)),
    timeManagement: round4(computeTimeManagement(interactions)),
    interactionCount: interactions.length
  };
}
