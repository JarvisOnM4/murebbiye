import type { BudgetMode } from "@prisma/client";

export type BudgetModeLabel = "normal" | "short_response_low_cost_model" | "review_only";

export type BudgetStatus = {
  monthlySpentUsd: number;
  monthlyCapUsd: number;
  perLessonCapUsd: number;
  monthlyPercent: number;
  mode: BudgetModeLabel;
  budgetModeEnum: BudgetMode;
  shortResponseMode: boolean;
  shouldBlockNewGeneration: boolean;
};

export type BudgetLedgerEntry = {
  id: string;
  lessonId: string | null;
  provider: string;
  model: string;
  requestType: string;
  costUsd: number;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
};
