"use client";

import { type FormEvent, useRef, useEffect, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

type ChatPanelProps = {
  exerciseId: string;
  attemptId: string;
  descriptionTr: string | null;
  totalClues: number;
  hintsUsed: number;
  isComplete: boolean;
  loading: boolean;
  onAgentReply: (reply: {
    agentMessage: string;
    matchedElements: Record<string, string>;
    visibleLayers: string[];
    isComplete: boolean;
    attemptCount: number;
  }) => void;
  onHintReceived: (hint: {
    highlightArea: { x: number; y: number; width: number; height: number };
    hintTextTr: string | null;
  } | null) => void;
  onHintsUsedChange: (hintsUsed: number) => void;
};

export function ChatPanel({
  exerciseId,
  attemptId,
  descriptionTr,
  totalClues,
  hintsUsed,
  isComplete,
  loading: externalLoading,
  onAgentReply,
  onHintReceived,
  onHintsUsedChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Merhaba! Yukarıdaki resmi yapay zekaya tarif et! Ne görüyorsun?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = isSending || isHinting || externalLoading;
  const noMoreClues = hintsUsed >= totalClues;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || isComplete) return;
    if (trimmed.length < 3 || trimmed.length > 300) return;

    const userMsgId = `u-${Date.now()}`;
    const agentMsgId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
      { id: agentMsgId, role: "assistant", content: "", loading: true },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/student/exercise/${exerciseId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, message: trimmed }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const errText =
          payload.error ?? payload.errors?.[0] ?? "Bir hata oluştu. Tekrar dene.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: errText, loading: false }
              : m
          )
        );
        return;
      }

      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? { ...m, content: data.agentMessage, loading: false }
            : m
        )
      );
      onAgentReply(data);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? { ...m, content: "Bağlantı hatası. Tekrar dene.", loading: false }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleHint() {
    if (isLoading || noMoreClues || isComplete) return;
    setIsHinting(true);

    try {
      const res = await fetch(`/api/student/exercise/${exerciseId}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();

      if (data.hint) {
        onHintReceived(data.hint);
        onHintsUsedChange(hintsUsed + 1);

        const hintMsg: ChatMessage = {
          id: `hint-${Date.now()}`,
          role: "assistant",
          content: `İpucu: ${data.hint.hintTextTr ?? "Resimde bir alan işaretlendi."}`,
        };
        setMessages((prev) => [...prev, hintMsg]);
      } else {
        onHintReceived(null);
      }
    } catch {
      // silently fail hint errors
    } finally {
      setIsHinting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const inputTooShort = input.trim().length > 0 && input.trim().length < 3;
  const canSend = input.trim().length >= 3 && input.trim().length <= 300 && !isLoading && !isComplete;

  return (
    <div className="exercise-chat-panel">
      {descriptionTr && (
        <div className="exercise-instruction">
          <span className="exercise-instruction-icon" aria-hidden="true">📝</span>
          <p className="exercise-instruction-text">{descriptionTr}</p>
        </div>
      )}

      <div className="chat-messages exercise-chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.role === "user" ? "chat-user" : "chat-assistant"}`}
          >
            <p className="chat-text">
              {msg.loading ? (
                <span className="chat-typing">Düşünüyor…</span>
              ) : (
                msg.content
              )}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="exercise-chat-footer">
        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Yukarıdaki resmi yapay zekaya tarif et!"
            rows={2}
            minLength={3}
            maxLength={300}
            disabled={isLoading || isComplete}
            aria-label="Resim tarifi gir"
          />
          <button
            className="chat-send"
            type="submit"
            disabled={!canSend}
            title="Gönder"
            aria-label="Mesaj gönder"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>

        {inputTooShort && (
          <p className="exercise-input-hint" role="alert">
            En az 3 karakter yaz.
          </p>
        )}

        <div className="exercise-hint-row">
          <button
            className="hint-button"
            type="button"
            onClick={handleHint}
            disabled={isLoading || noMoreClues || isComplete}
            title={
              noMoreClues
                ? "İpucu kalmadı"
                : isComplete
                ? "Egzersiz tamamlandı"
                : `İpucu al (${totalClues - hintsUsed} kaldı)`
            }
            aria-label={`İpucu al — ${totalClues - hintsUsed} ipucu kaldı`}
          >
            <span aria-hidden="true">💡</span>{" "}
            {isHinting ? "Yükleniyor…" : "İpucu"}
            {!noMoreClues && !isComplete && (
              <span className="hint-count">{totalClues - hintsUsed}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
