"use client";

import { useEffect, useRef } from "react";

type CompletionModalProps = {
  isOpen: boolean;
  attemptCount: number;
  hintsUsed: number;
  lessonHref?: string;
};

export function CompletionModal({
  isOpen,
  attemptCount,
  hintsUsed,
  lessonHref = "/student",
}: CompletionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="completion-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
    >
      {/* Sparkle confetti layer */}
      <div className="completion-confetti" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="confetti-piece" style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      <div
        className="completion-card"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="completion-icon" aria-hidden="true">🎉</div>

        <h2 id="completion-title" className="completion-title">
          Tebrikler!
        </h2>

        <p className="completion-stat">
          {attemptCount} denemede başardın!
        </p>

        {hintsUsed > 0 && (
          <p className="completion-stat completion-stat-minor">
            {hintsUsed} ipucu kullandın
          </p>
        )}

        <a
          href={lessonHref}
          className="completion-return-btn"
          title="Derse dön"
          aria-label="Derse geri dön"
        >
          Derse Dön
        </a>
      </div>
    </div>
  );
}
