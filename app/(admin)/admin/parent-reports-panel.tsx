"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type EmailStatus = "QUEUED" | "SENT" | "FAILED";

type ParentSummaryItem = {
  id: string;
  lessonId: string;
  parentEmail: string;
  locale: "tr" | "en";
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
  sentAt: string | null;
  updatedAt: string;
  persistence: "db" | "fallback";
};

type ListPayload = {
  summaries: ParentSummaryItem[];
  count: number;
};

type DispatchResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
};

type DispatchPayload = {
  result: DispatchResult;
};

function statusClass(status: EmailStatus) {
  if (status === "SENT") {
    return "status-pill status-ready";
  }

  if (status === "FAILED") {
    return "status-pill status-failed";
  }

  return "status-pill status-processing";
}

export function ParentReportsPanel() {
  const [records, setRecords] = useState<ParentSummaryItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error">("ok");
  const [isPending, startTransition] = useTransition();

  const loadRecords = useCallback(async () => {
    const response = await fetch("/api/admin/reports/parent-summaries?limit=20", {
      method: "GET",
      credentials: "same-origin"
    });

    if (!response.ok) {
      setFeedback("Rapor listesi yuklenemedi. / Could not load parent reports.");
      setFeedbackType("error");
      return;
    }

    const payload = (await response.json()) as ListPayload;
    setRecords(payload.summaries);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function dispatchQueue() {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/admin/reports/parent-summaries/dispatch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ limit: 10 }),
          credentials: "same-origin"
        });

        const payload = (await response.json()) as DispatchPayload;

        if (!response.ok) {
          setFeedback("Dispatch failed.");
          setFeedbackType("error");
          await loadRecords();
          return;
        }

        setFeedback(
          `Queue dispatch done: processed=${payload.result.processed} sent=${payload.result.sent} retried=${payload.result.retried} failed=${payload.result.failed}`
        );
        setFeedbackType(payload.result.failed > 0 ? "error" : "ok");
        await loadRecords();
      })();
    });
  }

  return (
    <section className="card reports-panel">
      <div className="reports-head">
        <h2>Parent Summary Reports</h2>
        <button className="btn btn-secondary" type="button" onClick={dispatchQueue} disabled={isPending}>
          {isPending ? "Dispatching..." : "Dispatch Queue"}
        </button>
      </div>

      {feedback ? (
        <p className={feedbackType === "error" ? "warn" : "success-text"}>{feedback}</p>
      ) : null}

      <div className="records-grid">
        {records.length === 0 ? (
          <p>No parent summaries yet.</p>
        ) : (
          records.map((record) => (
            <div className="record" key={record.id}>
              <div className="record-head">
                <strong>{record.parentEmail}</strong>
                <span className={statusClass(record.status)}>{record.status}</span>
              </div>
              <p className="mono">lesson={record.lessonId}</p>
              <p>
                attempts={record.attempts} persistence={record.persistence} locale={record.locale}
              </p>
              <p>queued: {new Date(record.queuedAt).toLocaleString()}</p>
              {record.sentAt ? <p>sent: {new Date(record.sentAt).toLocaleString()}</p> : null}
              {record.lastError ? <p className="warn">{record.lastError}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
