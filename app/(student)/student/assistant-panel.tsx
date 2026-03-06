"use client";

import { type FormEvent, useRef, useEffect, useState, useTransition } from "react";

type AssistantReference = {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  excerpt: string;
  track: string;
  score: number;
};

type ScopeReply = {
  status: "IN_SCOPE" | "OUT_OF_SCOPE";
  answer: string;
  references: AssistantReference[];
  suggestions: string[];
  redirect: {
    recommendedAction: string;
    suggestedPrompt: string;
  };
  guardrail: {
    sourcePolicy: string;
    track: string;
    matchedTokenCount: number;
    scannedChunks: number;
  };
};

type AssistantResponse = {
  reply?: ScopeReply;
  errors?: string[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  outOfScope?: boolean;
};

const WELCOME_SUGGESTIONS = [
  "Prompt nedir?",
  "Atatürk kimdir?",
  "İyi bir prompt nasıl yazılır?",
  "Yapay zeka yanılabilir mi?",
];

export function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Merhaba! Yapay zeka hakkında birlikte keşif yapalım. Aşağıdaki konulardan birini seç ya da kendi sorunu yaz!",
      suggestions: WELCOME_SUGGESTIONS,
    },
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendQuestion(question: string) {
    if (!question.trim() || isPending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/student/assistant/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: question.trim(),
              track: "AI_MODULE",
              locale: "tr",
            }),
            credentials: "same-origin",
          });

          const payload = (await response.json()) as AssistantResponse;

          if (!response.ok || !payload.reply) {
            setMessages((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: payload.errors?.[0] || "Bir hata oluştu. Tekrar dene.",
              },
            ]);
            return;
          }

          const reply = payload.reply;
          const assistantMsg: Message = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: reply.answer,
            suggestions: reply.suggestions.length > 0 ? reply.suggestions : undefined,
            outOfScope: reply.status === "OUT_OF_SCOPE",
          };

          setMessages((prev) => [...prev, assistantMsg]);
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Bağlantı hatası. Tekrar dene.",
            },
          ]);
        }
      })();
    });
  }

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    sendQuestion(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSuggestionClick(suggestion: string) {
    sendQuestion(suggestion);
  }

  return (
    <section className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`chat-bubble ${msg.role === "user" ? "chat-user" : "chat-assistant"}`}
            >
              <p className="chat-text">{msg.content}</p>
            </div>
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="chat-suggestions">
                {msg.suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="chat-suggestion"
                    onClick={() => handleSuggestionClick(s)}
                    disabled={isPending}
                    title={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isPending && (
          <div className="chat-bubble chat-assistant">
            <p className="chat-text chat-typing">Düşünüyorum...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Bir soru sor..."
          rows={1}
          maxLength={600}
          disabled={isPending}
        />
        <button
          className="chat-send"
          type="submit"
          disabled={isPending || !input.trim()}
          title="Gönder"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </section>
  );
}
