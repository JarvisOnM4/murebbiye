"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";

type DocumentStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
type LessonTrack = "ENGLISH" | "AI_MODULE";

type CurriculumItem = {
  id: string;
  title: string;
  originalName: string;
  sourceLanguage: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  updatedAt: string;
  sourceType: "markdown" | "pdf";
  persistence: "db" | "fallback";
};

type ListPayload = {
  documents: CurriculumItem[];
  counts: {
    total: number;
    ready: number;
    failed: number;
    processing: number;
  };
};

type ApiResponse = {
  document?: CurriculumItem;
  errors?: string[];
};

function statusClass(status: DocumentStatus) {
  if (status === "READY") {
    return "status-pill status-ready";
  }

  if (status === "FAILED") {
    return "status-pill status-failed";
  }

  return "status-pill status-processing";
}

export function CurriculumPanel() {
  const [records, setRecords] = useState<CurriculumItem[]>([]);
  const [summary, setSummary] = useState<ListPayload["counts"]>({
    total: 0,
    ready: 0,
    failed: 0,
    processing: 0
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"tr" | "en">("en");
  const [track, setTrack] = useState<LessonTrack>("ENGLISH");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error">("ok");
  const [isPending, startTransition] = useTransition();

  const loadRecords = useCallback(async () => {
    const response = await fetch("/api/admin/curriculum/list", {
      method: "GET",
      credentials: "same-origin"
    });

    if (!response.ok) {
      setFeedback("Dokuman listesi yuklenemedi. / Could not load upload list.");
      setFeedbackType("error");
      return;
    }

    const payload = (await response.json()) as ListPayload;
    setRecords(payload.documents);
    setSummary(payload.counts);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const hasFile = useMemo(() => Boolean(selectedFile), [selectedFile]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setFeedback("Lutfen bir dosya secin. / Please select a file.");
      setFeedbackType("error");
      return;
    }

    startTransition(() => {
      void (async () => {
        const formData = new FormData();
        formData.set("file", selectedFile);
        formData.set("track", track);
        formData.set("sourceLanguage", sourceLanguage);

        if (title.trim()) {
          formData.set("title", title.trim());
        }

        const response = await fetch("/api/admin/curriculum/upload", {
          method: "POST",
          body: formData,
          credentials: "same-origin"
        });

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok) {
          const message = payload.errors?.join(" ") || "Upload failed.";
          setFeedback(message);
          setFeedbackType("error");
          await loadRecords();
          return;
        }

        setFeedback("Yukleme tamamlandi. / Upload completed successfully.");
        setFeedbackType("ok");
        setSelectedFile(null);
        setTitle("");
        await loadRecords();
      })();
    });
  }

  function retryDocument(documentId: string) {
    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/admin/curriculum/retry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ documentId }),
          credentials: "same-origin"
        });

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok) {
          const message = payload.errors?.join(" ") || "Retry failed.";
          setFeedback(message);
          setFeedbackType("error");
          await loadRecords();
          return;
        }

        setFeedback("Yeniden isleme tamamlandi. / Retry completed.");
        setFeedbackType("ok");
        await loadRecords();
      })();
    });
  }

  return (
    <section className="ingestion-panel">
      <div className="summary-grid">
        <article className="card">
          <h3>Total Docs</h3>
          <p className="mono">{summary.total}</p>
        </article>
        <article className="card">
          <h3>Ready</h3>
          <p className="mono">{summary.ready}</p>
        </article>
        <article className="card">
          <h3>Failed</h3>
          <p className="mono">{summary.failed}</p>
        </article>
        <article className="card">
          <h3>Processing</h3>
          <p className="mono">{summary.processing}</p>
        </article>
      </div>

      <form className="card upload-form" onSubmit={handleSubmit}>
        <h2>Curriculum Upload (Markdown + PDF)</h2>

        <div className="field">
          <label htmlFor="file">File</label>
          <input
            id="file"
            type="file"
            accept=".md,.markdown,.pdf,text/markdown,application/pdf,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
            }}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            placeholder="Week 1 - Simple Present"
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="track">Track</label>
            <select
              id="track"
              value={track}
              onChange={(event) => setTrack(event.target.value as LessonTrack)}
            >
              <option value="ENGLISH">ENGLISH</option>
              <option value="AI_MODULE">AI_MODULE</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="sourceLanguage">Source Language</label>
            <select
              id="sourceLanguage"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value as "tr" | "en")}
            >
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </div>
        </div>

        <button className="btn" type="submit" disabled={isPending || !hasFile}>
          {isPending ? "Isleniyor... / Processing..." : "Upload Curriculum"}
        </button>

        {feedback ? (
          <p className={feedbackType === "error" ? "warn" : "success-text"}>{feedback}</p>
        ) : null}
      </form>

      <article className="card">
        <h2>Recent Uploads</h2>
        <div className="records-grid">
          {records.length === 0 ? (
            <p>Henüz dokuman yok. / No curriculum uploaded yet.</p>
          ) : (
            records.map((record) => (
              <div className="record" key={record.id}>
                <div className="record-head">
                  <strong>{record.title}</strong>
                  <span className={statusClass(record.status)}>{record.status}</span>
                </div>
                <p className="mono">{record.originalName}</p>
                <p>
                  Type: {record.sourceType.toUpperCase()} | Chunks: {record.chunkCount} | Store:{" "}
                  {record.persistence}
                </p>
                <p>Updated: {new Date(record.updatedAt).toLocaleString()}</p>
                {record.errorMessage ? <p className="warn">{record.errorMessage}</p> : null}
                {record.status === "FAILED" ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => retryDocument(record.id)}
                    disabled={isPending}
                  >
                    Retry Parse
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
