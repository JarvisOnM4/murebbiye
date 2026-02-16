"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type BudgetStatus = {
  monthlySpentUsd: number;
  monthlyCapUsd: number;
  monthlyPercent: number;
  mode: "normal" | "short_response_low_cost_model" | "review_only";
};

type PerformanceSummary = {
  count: number;
  medianMs: number;
  p95Ms: number;
  targetMs: number;
  passesTarget: boolean;
};

function modeClass(mode: BudgetStatus["mode"]) {
  if (mode === "review_only") {
    return "status-pill status-failed";
  }

  if (mode === "short_response_low_cost_model") {
    return "status-pill status-processing";
  }

  return "status-pill status-ready";
}

export function OpsPanel() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error">("ok");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const [budgetResponse, performanceResponse] = await Promise.all([
      fetch("/api/admin/budget/status?perLessonEstimateUsd=0.05", {
        method: "GET",
        credentials: "same-origin"
      }),
      fetch("/api/admin/performance/summary?windowMinutes=60&targetMs=3000", {
        method: "GET",
        credentials: "same-origin"
      })
    ]);

    if (!budgetResponse.ok || !performanceResponse.ok) {
      setFeedback("Ops panel data could not be loaded.");
      setFeedbackType("error");
      return;
    }

    const budgetPayload = (await budgetResponse.json()) as { status: BudgetStatus };
    const performancePayload = (await performanceResponse.json()) as {
      summary: PerformanceSummary;
    };

    setBudget(budgetPayload.status);
    setPerformance(performancePayload.summary);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetOpsData() {
    startTransition(() => {
      void (async () => {
        const [budgetReset, perfReset] = await Promise.all([
          fetch("/api/admin/budget/reset", {
            method: "POST",
            credentials: "same-origin"
          }),
          fetch("/api/admin/performance/reset", {
            method: "POST",
            credentials: "same-origin"
          })
        ]);

        if (!budgetReset.ok || !perfReset.ok) {
          setFeedback("Reset failed.");
          setFeedbackType("error");
          await load();
          return;
        }

        setFeedback("Ops data reset completed.");
        setFeedbackType("ok");
        await load();
      })();
    });
  }

  return (
    <section className="card ops-panel">
      <div className="ops-head">
        <h2>Ops Controls</h2>
        <div className="ops-actions">
          <button className="btn btn-secondary" type="button" onClick={() => void load()} disabled={isPending}>
            Refresh
          </button>
          <button className="btn btn-secondary" type="button" onClick={resetOpsData} disabled={isPending}>
            Reset Budget + Perf
          </button>
        </div>
      </div>

      {feedback ? (
        <p className={feedbackType === "error" ? "warn" : "success-text"}>{feedback}</p>
      ) : null}

      <div className="grid">
        <article className="card">
          <h3>Budget Status</h3>
          {budget ? (
            <>
              <p className="mono">
                spent=${budget.monthlySpentUsd} / cap=${budget.monthlyCapUsd} ({budget.monthlyPercent}%)
              </p>
              <p>
                mode <span className={modeClass(budget.mode)}>{budget.mode}</span>
              </p>
            </>
          ) : (
            <p>Loading budget...</p>
          )}
        </article>

        <article className="card">
          <h3>Performance Window</h3>
          {performance ? (
            <>
              <p className="mono">
                count={performance.count} median={performance.medianMs}ms p95={performance.p95Ms}ms
              </p>
              <p>
                target={performance.targetMs}ms pass={String(performance.passesTarget)}
              </p>
            </>
          ) : (
            <p>Loading performance...</p>
          )}
        </article>
      </div>
    </section>
  );
}
