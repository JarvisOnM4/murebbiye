export const pilotConfig = {
  projectName: "murebbiye",
  timelineDays: 14,
  languages: ["tr", "en"],
  auth: {
    mode: "email_password",
    roles: ["admin", "student"]
  },
  uploadFormats: ["md", "pdf"],
  lesson: {
    durationMinutes: 35,
    explainMinutes: 7,
    guidedPracticeMinutes: 20,
    independentMinutes: 8,
    englishRatio: "30_70",
    aiModuleRatio: "20_80"
  },
  budget: {
    monthlyCapUsd: 10,
    perLessonCapUsd: 0.2,
    modeAt80Percent: "short_response_low_cost_model",
    modeAt100Percent: "stop_new_generation_review_only"
  },
  targets: {
    emailDeliveryRateMin: 0.95,
    medianApiResponseSecondsMax: 3,
    outOfScopeLeakageMax: 0.02
  }
} as const;
