import type { LessonTrack } from "@prisma/client";
import type { LessonMetrics, ParentSummaryDraft, SupportedLocale } from "@/lib/reporting/types";

function metricPercent(value: number) {
  return Math.round(value * 100);
}

function evaluateStrengths(locale: SupportedLocale, metrics: LessonMetrics) {
  const strengths: string[] = [];

  if (metrics.accuracyRatio >= 0.75) {
    strengths.push(locale === "tr" ? "Dogru cevap orani guclu." : "Accuracy is strong.");
  }

  if (metrics.hintDependency <= 0.35) {
    strengths.push(locale === "tr" ? "Ipucu bagimliligi dusuk." : "Hint dependency is low.");
  }

  if (metrics.interactionQuality >= 0.7) {
    strengths.push(
      locale === "tr"
        ? "Etkilesim kalitesi net ve baglama uygun." 
        : "Interaction quality is clear and context-aligned."
    );
  }

  if (metrics.timeManagement >= 0.65) {
    strengths.push(
      locale === "tr"
        ? "Yanitlama hizi hedef zaman araligina yakin." 
        : "Response pace is close to the target window."
    );
  }

  if (strengths.length === 0) {
    strengths.push(
      locale === "tr"
        ? "Derse katilim duzeyi korunuyor; temel kazanimi guclendirme firsati var."
        : "Lesson engagement is stable; there is room to strengthen core mastery."
    );
  }

  return strengths;
}

function evaluateImprovements(locale: SupportedLocale, metrics: LessonMetrics) {
  const improvements: string[] = [];

  if (metrics.accuracyRatio < 0.7) {
    improvements.push(
      locale === "tr"
        ? "Dogruluk oranini artirmak icin temel kavram tekrarina ihtiyac var."
        : "Core concept review is needed to improve accuracy."
    );
  }

  if (metrics.hintDependency > 0.45) {
    improvements.push(
      locale === "tr"
        ? "Ipucu olmadan bagimsiz cevap denemeleri artirilabilir."
        : "More independent answers without hints would help progress."
    );
  }

  if (metrics.repetitionPerformance < 0.65) {
    improvements.push(
      locale === "tr"
        ? "Tekrar eden sorularda dogru stratejiyi kalici hale getirme calisilmali."
        : "Repeated-question strategy needs reinforcement for consistency."
    );
  }

  if (metrics.interactionQuality < 0.65) {
    improvements.push(
      locale === "tr"
        ? "Yanitlarda gerekce ve ornek kullanimi artirilmali."
        : "Answers should include clearer reasoning and examples."
    );
  }

  if (metrics.timeManagement < 0.6) {
    improvements.push(
      locale === "tr"
        ? "Zaman yonetimi icin kisa sureli soru cozum alistirmalari onerilir."
        : "Short timed drills are recommended to improve time management."
    );
  }

  if (improvements.length === 0) {
    improvements.push(
      locale === "tr"
        ? "Mevcut ilerleme olumlu; bir sonraki derste zorluk seviyesi kademeli artirilabilir."
        : "Current progress is strong; the next lesson can raise difficulty gradually."
    );
  }

  return improvements;
}

function nextRecommendation(locale: SupportedLocale, track: LessonTrack, metrics: LessonMetrics) {
  const ranking: Array<[string, number]> = [
    ["accuracy", metrics.accuracyRatio],
    ["hint", metrics.hintDependency <= 0 ? 1 : 1 - metrics.hintDependency],
    ["repetition", metrics.repetitionPerformance],
    ["quality", metrics.interactionQuality],
    ["time", metrics.timeManagement]
  ];

  const weakestMetric = ranking.sort((left, right) => left[1] - right[1])[0]?.[0] ?? "accuracy";

  const trackLabel = track === "AI_MODULE" ? "AI module" : "English";

  if (locale === "tr") {
    if (weakestMetric === "time") {
      return `${trackLabel} odaginda zamanli mini alistirma ve kisa geri bildirim turu planlanmali.`;
    }

    if (weakestMetric === "hint") {
      return `${trackLabel} odaginda ipucusuz deneme adimlarini artiran yonlendirilmis pratik onerilir.`;
    }

    return `${trackLabel} odaginda zayif kalan kazanima yonelik kisa tekrar + mini degerlendirme uygulanmali.`;
  }

  if (weakestMetric === "time") {
    return `Plan a ${trackLabel} micro-lesson with timed drills and short feedback loops.`;
  }

  if (weakestMetric === "hint") {
    return `Increase independent practice in the next ${trackLabel} lesson before hint support.`;
  }

  return `Run a focused ${trackLabel} review on the weakest metric, then close with a mini assessment.`;
}

export function buildParentSummaryDraft(input: {
  locale: SupportedLocale;
  track: LessonTrack;
  studentLabel: string;
  metrics: LessonMetrics;
}): ParentSummaryDraft {
  const strengths = evaluateStrengths(input.locale, input.metrics);
  const improvementAreas = evaluateImprovements(input.locale, input.metrics);
  const nextLessonRecommendation = nextRecommendation(input.locale, input.track, input.metrics);

  if (input.locale === "tr") {
    const subject = `${input.studentLabel} - Ders Ozeti ve Gelisim Raporu`;
    const bodyText = [
      `Merhaba,`,
      "",
      `${input.studentLabel} bugunki dersini tamamladi. Ozet metrikler:`,
      `- Dogruluk: %${metricPercent(input.metrics.accuracyRatio)}`,
      `- Ipucu bagimliligi: %${metricPercent(input.metrics.hintDependency)}`,
      `- Tekrar performansi: %${metricPercent(input.metrics.repetitionPerformance)}`,
      `- Etkilesim kalitesi: %${metricPercent(input.metrics.interactionQuality)}`,
      `- Zaman yonetimi: %${metricPercent(input.metrics.timeManagement)}`,
      "",
      "Guclu yonler:",
      ...strengths.map((item) => `- ${item}`),
      "",
      "Gelisim alanlari:",
      ...improvementAreas.map((item) => `- ${item}`),
      "",
      `Sonraki ders onerisi: ${nextLessonRecommendation}`,
      "",
      "Tesekkurler."
    ].join("\n");

    return {
      subject,
      bodyText,
      strengths,
      improvementAreas,
      nextLessonRecommendation
    };
  }

  const subject = `${input.studentLabel} - Lesson Summary and Progress Report`;
  const bodyText = [
    "Hello,",
    "",
    `${input.studentLabel} has completed today's lesson. Key metrics:`,
    `- Accuracy: ${metricPercent(input.metrics.accuracyRatio)}%`,
    `- Hint dependency: ${metricPercent(input.metrics.hintDependency)}%`,
    `- Repetition performance: ${metricPercent(input.metrics.repetitionPerformance)}%`,
    `- Interaction quality: ${metricPercent(input.metrics.interactionQuality)}%`,
    `- Time management: ${metricPercent(input.metrics.timeManagement)}%`,
    "",
    "Strengths:",
    ...strengths.map((item) => `- ${item}`),
    "",
    "Improvement areas:",
    ...improvementAreas.map((item) => `- ${item}`),
    "",
    `Next lesson recommendation: ${nextLessonRecommendation}`,
    "",
    "Thank you."
  ].join("\n");

  return {
    subject,
    bodyText,
    strengths,
    improvementAreas,
    nextLessonRecommendation
  };
}
