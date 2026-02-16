"use client";

import { type FormEvent, useState, useTransition } from "react";

type LessonTrack = "ENGLISH" | "AI_MODULE";
type SupportedLocale = "tr" | "en";
type AssistantScopeStatus = "IN_SCOPE" | "OUT_OF_SCOPE";

type AssistantReference = {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  excerpt: string;
  track: LessonTrack;
  score: number;
};

type ScopeReply = {
  status: AssistantScopeStatus;
  answer: string;
  references: AssistantReference[];
  redirect: {
    recommendedAction: "RETURN_TO_CURRICULUM";
    suggestedPrompt: string;
  };
  guardrail: {
    sourcePolicy: "curriculum_only";
    track: LessonTrack;
    matchedTokenCount: number;
    scannedChunks: number;
  };
};

type AssistantResponse = {
  reply?: ScopeReply;
  errors?: string[];
};

function statusClass(status: AssistantScopeStatus) {
  if (status === "IN_SCOPE") {
    return "status-pill status-ready";
  }

  return "status-pill status-failed";
}

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [track, setTrack] = useState<LessonTrack>("ENGLISH");
  const [locale, setLocale] = useState<SupportedLocale>("tr");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"ok" | "error">("ok");
  const [reply, setReply] = useState<ScopeReply | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim()) {
      setFeedback("Lutfen bir soru yazin. / Please enter a question.");
      setFeedbackType("error");
      return;
    }

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/student/assistant/respond", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: question.trim(),
            track,
            locale
          }),
          credentials: "same-origin"
        });

        const payload = (await response.json()) as AssistantResponse;

        if (!response.ok || !payload.reply) {
          setFeedback(payload.errors?.join(" ") || "Assistant request failed.");
          setFeedbackType("error");
          setReply(null);
          return;
        }

        setReply(payload.reply);
        setFeedback(
          payload.reply.status === "IN_SCOPE"
            ? "Yanit mufredat kapsaminda. / Response is within curriculum scope."
            : "Soru kapsam disi algilandi ve ders baglamina yonlendirildi. / Out-of-scope question redirected to curriculum context."
        );
        setFeedbackType(payload.reply.status === "IN_SCOPE" ? "ok" : "error");
      })();
    });
  }

  return (
    <section className="card assistant-panel">
      <h2>Scope-Constrained Assistant</h2>
      <p className="assistant-note">
        Assistant sadece yuklu mufredat iceriginden yanit verir. The assistant answers only
        from uploaded curriculum and AI module content.
      </p>

      <form className="assistant-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="assistant-track">Track</label>
            <select
              id="assistant-track"
              value={track}
              onChange={(event) => setTrack(event.target.value as LessonTrack)}
            >
              <option value="ENGLISH">ENGLISH</option>
              <option value="AI_MODULE">AI_MODULE</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="assistant-locale">Locale</label>
            <select
              id="assistant-locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value as SupportedLocale)}
            >
              <option value="tr">TR</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="assistant-question">Question</label>
          <textarea
            id="assistant-question"
            className="assistant-textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={600}
            placeholder="Ornek / Example: Present simple ile gunluk rutin nasil anlatilir?"
          />
        </div>

        <button className="btn" type="submit" disabled={isPending}>
          {isPending ? "Yanitlaniyor... / Responding..." : "Ask Assistant"}
        </button>
      </form>

      {feedback ? (
        <p className={feedbackType === "error" ? "warn" : "success-text"}>{feedback}</p>
      ) : null}

      {reply ? (
        <article className="assistant-result">
          <div className="assistant-result-head">
            <strong>Assistant Response</strong>
            <span className={statusClass(reply.status)}>{reply.status}</span>
          </div>

          <p className="assistant-answer">{reply.answer}</p>
          <p>
            Suggested return prompt: <span className="mono">{reply.redirect.suggestedPrompt}</span>
          </p>
          <p className="mono">
            Guardrail: policy={reply.guardrail.sourcePolicy} track={reply.guardrail.track} matches=
            {reply.guardrail.matchedTokenCount} scanned={reply.guardrail.scannedChunks}
          </p>

          <div className="assistant-references">
            <h3>References</h3>
            {reply.references.length === 0 ? (
              <p>No direct chunk match. Ask a question tied to uploaded content.</p>
            ) : (
              reply.references.map((reference) => (
                <div className="assistant-reference" key={`${reference.documentId}-${reference.chunkOrdinal}`}>
                  <p className="mono">
                    {reference.documentTitle} / chunk {reference.chunkOrdinal} / score {reference.score}
                  </p>
                  <p>{reference.excerpt}</p>
                </div>
              ))
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
