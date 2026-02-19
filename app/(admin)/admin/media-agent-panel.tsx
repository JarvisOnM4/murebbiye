"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import type { FormEvent } from "react"

type JobStatus =
  | "PENDING"
  | "ANALYZING"
  | "STORYBOARD_READY"
  | "GENERATING"
  | "COMPLETED"
  | "FAILED"

type AssetType =
  | "DIAGRAM"
  | "FLOWCHART"
  | "SLIDE_DECK"
  | "INTERACTIVE"
  | "VIDEO_SCRIPT"
  | "CARTOON_NARRATIVE"
  | "ILLUSTRATION"

type AssetStatus =
  | "STORYBOARD_PENDING"
  | "STORYBOARD_APPROVED"
  | "STORYBOARD_REJECTED"
  | "GENERATING"
  | "GENERATED"
  | "FAILED"

type MediaAsset = {
  id: string
  type: AssetType
  title: string
  storyboard: string
  status: AssetStatus
  generatedContent: string | null
  costUsd: number | null
}

type EnrichmentJob = {
  id: string
  documentId: string
  locale: "tr" | "en"
  status: JobStatus
  assetsGenerated: number
  assetsFailed: number
  totalCostUsd: number
  createdAt: string
  updatedAt: string
  assets: MediaAsset[]
}

type JobsPayload = {
  jobs: EnrichmentJob[]
}

type EnrichPayload = {
  job?: EnrichmentJob
  errors?: string[]
}

type ReviewPayload = {
  asset?: MediaAsset
  errors?: string[]
}

type GeneratePayload = {
  job?: EnrichmentJob
  errors?: string[]
}

function jobStatusClass(status: JobStatus) {
  if (status === "COMPLETED") {
    return "status-pill status-ready"
  }

  if (status === "FAILED") {
    return "status-pill status-failed"
  }

  return "status-pill status-processing"
}

function assetStatusClass(status: AssetStatus) {
  if (status === "GENERATED" || status === "STORYBOARD_APPROVED") {
    return "status-pill status-ready"
  }

  if (status === "FAILED" || status === "STORYBOARD_REJECTED") {
    return "status-pill status-failed"
  }

  return "status-pill status-processing"
}

function assetTypeBadge(type: AssetType) {
  return "status-pill status-processing"
}

export function MediaAgentPanel() {
  const [documentId, setDocumentId] = useState("")
  const [locale, setLocale] = useState<"tr" | "en">("en")
  const [jobs, setJobs] = useState<EnrichmentJob[]>([])
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<"ok" | "error">("ok")
  const [isPending, startTransition] = useTransition()

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/admin/media-agent/jobs", {
      method: "GET",
      credentials: "same-origin"
    })

    if (!response.ok) {
      setFeedback("Medya is listesi yuklenemedi. / Could not load media jobs.")
      setFeedbackType("error")
      return
    }

    const payload = (await response.json()) as JobsPayload
    setJobs(payload.jobs)
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  function handleEnrich(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!documentId.trim()) {
      setFeedback("Lutfen bir dokuman ID girin. / Please enter a document ID.")
      setFeedbackType("error")
      return
    }

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/admin/media-agent/enrich", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            documentId: documentId.trim(),
            locale
          }),
          credentials: "same-origin"
        })

        const payload = (await response.json()) as EnrichPayload

        if (!response.ok) {
          const message = payload.errors?.join(" ") || "Enrichment request failed."
          setFeedback(message)
          setFeedbackType("error")
          await loadJobs()
          return
        }

        setFeedback("Analiz basladi. / Analysis started successfully.")
        setFeedbackType("ok")
        setDocumentId("")
        await loadJobs()
      })()
    })
  }

  function reviewAsset(assetId: string, action: "approve" | "reject") {
    startTransition(() => {
      void (async () => {
        const response = await fetch(`/api/admin/media-agent/assets/${assetId}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ action }),
          credentials: "same-origin"
        })

        const payload = (await response.json()) as ReviewPayload

        if (!response.ok) {
          const message = payload.errors?.join(" ") || "Review action failed."
          setFeedback(message)
          setFeedbackType("error")
          await loadJobs()
          return
        }

        setFeedback(
          action === "approve"
            ? "Storyboard onaylandi. / Storyboard approved."
            : "Storyboard reddedildi. / Storyboard rejected."
        )
        setFeedbackType(action === "approve" ? "ok" : "error")
        await loadJobs()
      })()
    })
  }

  function approveAllAndGenerate(jobId: string) {
    startTransition(() => {
      void (async () => {
        const job = jobs.find((j) => j.id === jobId)
        if (!job) return

        const pendingAssets = job.assets.filter(
          (a) => a.status === "STORYBOARD_PENDING"
        )

        for (const asset of pendingAssets) {
          const response = await fetch(`/api/admin/media-agent/assets/${asset.id}/review`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "approve" }),
            credentials: "same-origin"
          })

          if (!response.ok) {
            setFeedback(`Asset ${asset.id} approval failed.`)
            setFeedbackType("error")
            await loadJobs()
            return
          }
        }

        const generateResponse = await fetch("/api/admin/media-agent/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ jobId }),
          credentials: "same-origin"
        })

        const generatePayload = (await generateResponse.json()) as GeneratePayload

        if (!generateResponse.ok) {
          const message = generatePayload.errors?.join(" ") || "Generation failed."
          setFeedback(message)
          setFeedbackType("error")
          await loadJobs()
          return
        }

        setFeedback("Tum storyboard'lar onaylandi ve uretim basladi. / All storyboards approved and generation started.")
        setFeedbackType("ok")
        await loadJobs()
      })()
    })
  }

  function toggleJobExpand(jobId: string) {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId))
  }

  const storyboardReadyJobs = jobs.filter((j) => j.status === "STORYBOARD_READY")
  const generatedAssets = jobs.flatMap((j) =>
    j.assets.filter((a) => a.status === "GENERATED" || a.status === "STORYBOARD_APPROVED")
  )

  return (
    <section className="media-agent-panel">
      {/* Enrichment Trigger */}
      <form className="card upload-form" onSubmit={handleEnrich}>
        <h2>Media Enrichment</h2>

        <div className="form-row">
          <div className="field">
            <label htmlFor="media-doc-id">Document ID</label>
            <input
              id="media-doc-id"
              type="text"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
              placeholder="clx1abc..."
              required
            />
          </div>

          <div className="field">
            <label htmlFor="media-locale">Locale</label>
            <select
              id="media-locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value as "tr" | "en")}
            >
              <option value="en">EN</option>
              <option value="tr">TR</option>
            </select>
          </div>
        </div>

        <button className="btn" type="submit" disabled={isPending || !documentId.trim()}>
          {isPending ? "Analiz ediliyor... / Analyzing..." : "Analyze & Generate Storyboards"}
        </button>

        {feedback ? (
          <p className={feedbackType === "error" ? "warn" : "success-text"}>{feedback}</p>
        ) : null}
      </form>

      {/* Jobs Dashboard */}
      <article className="card">
        <div className="media-head">
          <h2>Enrichment Jobs</h2>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void loadJobs()}
            disabled={isPending}
          >
            Refresh
          </button>
        </div>

        <div className="records-grid">
          {jobs.length === 0 ? (
            <p>Henuz medya isi yok. / No enrichment jobs yet.</p>
          ) : (
            jobs.map((job) => (
              <div className="record" key={job.id}>
                <div className="record-head">
                  <strong
                    className="media-job-toggle"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleJobExpand(job.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        toggleJobExpand(job.id)
                      }
                    }}
                  >
                    {expandedJobId === job.id ? "[-]" : "[+]"} doc={job.documentId}
                  </strong>
                  <span className={jobStatusClass(job.status)}>{job.status}</span>
                </div>
                <p className="mono">
                  locale={job.locale} assets={job.assetsGenerated}/{job.assetsFailed} cost=${job.totalCostUsd.toFixed(4)}
                </p>
                <p>Updated: {new Date(job.updatedAt).toLocaleString()}</p>

                {expandedJobId === job.id && job.assets.length > 0 ? (
                  <div className="media-assets-list">
                    {job.assets.map((asset) => (
                      <div className="media-asset-item" key={asset.id}>
                        <div className="record-head">
                          <span>
                            <span className={assetTypeBadge(asset.type)}>{asset.type}</span>{" "}
                            {asset.title}
                          </span>
                          <span className={assetStatusClass(asset.status)}>{asset.status}</span>
                        </div>
                        {asset.storyboard ? (
                          <p className="media-storyboard-text">{asset.storyboard}</p>
                        ) : null}
                        {asset.generatedContent ? (
                          <pre className="media-code-block">{asset.generatedContent}</pre>
                        ) : null}
                        {asset.costUsd != null ? (
                          <p className="mono">cost=${asset.costUsd.toFixed(4)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </article>

      {/* Storyboard Review Queue */}
      {storyboardReadyJobs.length > 0 ? (
        <article className="card">
          <h2>Storyboard Review Queue</h2>

          {storyboardReadyJobs.map((job) => {
            const pendingAssets = job.assets.filter(
              (a) => a.status === "STORYBOARD_PENDING"
            )

            if (pendingAssets.length === 0) return null

            return (
              <div className="media-review-job" key={job.id}>
                <div className="record-head">
                  <strong>doc={job.documentId}</strong>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => approveAllAndGenerate(job.id)}
                    disabled={isPending}
                  >
                    {isPending ? "Processing..." : "Approve All & Generate"}
                  </button>
                </div>

                <div className="records-grid">
                  {pendingAssets.map((asset) => (
                    <div className="record" key={asset.id}>
                      <div className="record-head">
                        <span>
                          <span className={assetTypeBadge(asset.type)}>{asset.type}</span>{" "}
                          {asset.title}
                        </span>
                        <span className={assetStatusClass(asset.status)}>{asset.status}</span>
                      </div>
                      {asset.storyboard ? (
                        <p className="media-storyboard-text">{asset.storyboard}</p>
                      ) : null}
                      <div className="media-review-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => reviewAsset(asset.id, "approve")}
                          disabled={isPending}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => reviewAsset(asset.id, "reject")}
                          disabled={isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </article>
      ) : null}

      {/* Generated Assets Library */}
      {generatedAssets.length > 0 ? (
        <article className="card">
          <h2>Generated Assets Library</h2>

          <div className="media-assets-grid">
            {generatedAssets.map((asset) => (
              <div className="record" key={asset.id}>
                <div className="record-head">
                  <span>
                    <span className={assetTypeBadge(asset.type)}>{asset.type}</span>{" "}
                    {asset.title}
                  </span>
                  <span className={assetStatusClass(asset.status)}>{asset.status}</span>
                </div>
                {asset.generatedContent ? (
                  <pre className="media-code-block">{asset.generatedContent}</pre>
                ) : null}
                {asset.costUsd != null ? (
                  <p className="mono">cost=${asset.costUsd.toFixed(4)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  )
}
