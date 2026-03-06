"use client";

import { type FormEvent, useRef, useEffect, useState, useCallback } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  outOfScope?: boolean;
  streaming?: boolean;
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
      content:
        "Merhaba! Yapay zeka hakkında birlikte keşif yapalım. Aşağıdaki konulardan birini seç ya da kendi sorunu yaz!",
      suggestions: WELCOME_SUGGESTIONS,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: question.trim(),
      };

      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
        },
      ]);
      setInput("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/student/assistant/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            track: "AI_MODULE",
            locale: "tr",
          }),
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      payload.error ||
                      payload.errors?.[0] ||
                      "Bir hata oluştu. Tekrar dene.",
                    streaming: false,
                  }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        // Check if response is JSON (non-streaming, e.g. quota exceeded)
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = await response.json();
          const reply = payload.reply;
          if (reply) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: reply.answer,
                      suggestions:
                        reply.suggestions?.length > 0
                          ? reply.suggestions
                          : undefined,
                      outOfScope: reply.status === "OUT_OF_SCOPE",
                      streaming: false,
                    }
                  : m
              )
            );
          }
          setIsStreaming(false);
          return;
        }

        // SSE streaming
        const reader = response.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("event: text")) {
              // Next data line will have the token
              continue;
            }

            if (trimmed.startsWith("event: done")) {
              continue;
            }

            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.token !== undefined) {
                  // Text token
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + parsed.token }
                        : m
                    )
                  );
                }

                if (parsed.status !== undefined) {
                  // Done event
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            streaming: false,
                            suggestions:
                              parsed.suggestions?.length > 0
                                ? parsed.suggestions
                                : undefined,
                            outOfScope: parsed.status === "OUT_OF_SCOPE",
                          }
                        : m
                    )
                  );
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Bağlantı hatası. Tekrar dene.",
                    streaming: false,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming]
  );

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
    setUsedSuggestions((prev) => new Set(prev).add(suggestion));
    sendQuestion(suggestion);
  }

  return (
    <section className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === "assistant" &&
            !msg.streaming &&
            idx === messages.findLastIndex((m) => m.role === "assistant" && !m.streaming);

          const visibleSuggestions = isLastAssistant
            ? msg.suggestions?.filter((s) => !usedSuggestions.has(s))
            : undefined;

          return (
            <div key={msg.id}>
              <div
                className={`chat-bubble ${msg.role === "user" ? "chat-user" : "chat-assistant"}`}
              >
                <p className="chat-text">
                  {msg.content}
                  {msg.streaming && <span className="chat-cursor" />}
                </p>
              </div>
              {visibleSuggestions && visibleSuggestions.length > 0 && (
                <div className="chat-suggestions">
                  {visibleSuggestions.map((s, i) => (
                    <button
                      key={i}
                      className="chat-suggestion"
                      onClick={() => handleSuggestionClick(s)}
                      disabled={isStreaming}
                      title={s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
          disabled={isStreaming}
        />
        <button
          className="chat-send"
          type="submit"
          disabled={isStreaming || !input.trim()}
          title="Gönder"
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
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </section>
  );
}
