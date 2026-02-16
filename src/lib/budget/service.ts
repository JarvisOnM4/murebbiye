import { BudgetMode } from "@prisma/client";
import { resolveBudgetMode } from "@/config/budget";
import { env } from "@/lib/env";
import {
  createBudgetLedgerEntry,
  listBudgetLedgerEntriesSince,
  resetBudgetLedgerSince
} from "@/lib/budget/repository";
import type { BudgetModeLabel, BudgetStatus } from "@/lib/budget/types";

function monthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function round4(value: number) {
  return Number(value.toFixed(4));
}

function toEnumMode(mode: BudgetModeLabel): BudgetMode {
  if (mode === "review_only") {
    return BudgetMode.REVIEW_ONLY;
  }

  if (mode === "short_response_low_cost_model") {
    return BudgetMode.SHORT_RESPONSE_LOW_COST;
  }

  return BudgetMode.NORMAL;
}

export async function getBudgetStatus(perLessonEstimateUsd: number): Promise<BudgetStatus> {
  const startAt = monthStart();
  const entries = await listBudgetLedgerEntriesSince(startAt);
  const monthlySpentUsd = round4(entries.reduce((sum, entry) => sum + entry.costUsd, 0));
  const monthlyPercent = round4((monthlySpentUsd / env.MONTHLY_CAP_USD) * 100);

  const mode = resolveBudgetMode({
    monthlySpentUsd,
    perLessonEstimateUsd
  });

  return {
    monthlySpentUsd,
    monthlyCapUsd: env.MONTHLY_CAP_USD,
    perLessonCapUsd: env.PER_LESSON_CAP_USD,
    monthlyPercent,
    mode,
    budgetModeEnum: toEnumMode(mode),
    shortResponseMode: mode === "short_response_low_cost_model",
    shouldBlockNewGeneration: mode === "review_only"
  };
}

export async function assertBudgetAllowsGeneration(perLessonEstimateUsd: number) {
  const status = await getBudgetStatus(perLessonEstimateUsd);

  if (status.shouldBlockNewGeneration) {
    throw new Error(
      "Budget cap reached. New lesson generation is disabled (review mode only)."
    );
  }

  return status;
}

export async function recordBudgetUsage(input: {
  lessonId?: string;
  provider: string;
  model: string;
  requestType: string;
  costUsd: number;
  tokensIn?: number;
  tokensOut?: number;
}) {
  return createBudgetLedgerEntry(input);
}

export async function simulateBudgetUsage(input: {
  totalCostUsd: number;
  count: number;
  requestType?: string;
}) {
  const totalCost = Math.max(0, input.totalCostUsd);
  const count = Math.max(1, Math.floor(input.count));
  const perItemCost = round4(totalCost / count);

  for (let index = 0; index < count; index += 1) {
    await createBudgetLedgerEntry({
      provider: "simulation",
      model: "simulation",
      requestType: input.requestType?.trim() || "simulation",
      costUsd: perItemCost
    });
  }

  return getBudgetStatus(env.PER_LESSON_CAP_USD);
}

export async function resetCurrentMonthBudgetUsage() {
  await resetBudgetLedgerSince(monthStart());
  return getBudgetStatus(env.PER_LESSON_CAP_USD);
}
