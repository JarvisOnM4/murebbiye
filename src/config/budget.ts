import { pilotConfig } from "@/config/pilot";

export type BudgetMode = "normal" | "short_response_low_cost_model" | "review_only";

export type BudgetSnapshot = {
  monthlySpentUsd: number;
  perLessonEstimateUsd: number;
};

export function resolveBudgetMode(snapshot: BudgetSnapshot): BudgetMode {
  const monthlyPercent =
    (snapshot.monthlySpentUsd / pilotConfig.budget.monthlyCapUsd) * 100;

  if (
    monthlyPercent >= 100 ||
    snapshot.perLessonEstimateUsd > pilotConfig.budget.perLessonCapUsd
  ) {
    return "review_only";
  }

  if (monthlyPercent >= 80) {
    return "short_response_low_cost_model";
  }

  return "normal";
}
