"use client";

import { useState } from "react";
import { TargetImagePanel } from "./target-image-panel";
import { CanvasPanel } from "./canvas-panel";
import { ChatPanel } from "./chat-panel";
import { CompletionModal } from "./completion-modal";

type TemplateLayer = {
  id: string;
  imageKey: string;
  zIndex: number;
  defaultVisible: boolean;
  mutuallyExclusive?: string[];
};

type ExerciseData = {
  id: string;
  slug: string;
  titleTr: string | null;
  titleEn: string | null;
  descriptionTr: string | null;
  targetImageKey: string | null;
  maxAttempts: number;
  elements: {
    id: string;
    labelTr: string;
    labelEn?: string | null;
    category: string;
    activatesLayers: string[];
    dependsOn?: string | null;
  }[];
  layers: TemplateLayer[];
};

type AttemptData = {
  attemptCount: number;
  hintsUsed: number;
  matchedElements: Record<string, string>;
  status: string;
};

type DrawingExerciseProps = {
  exerciseId: string;
  attemptId: string;
  exercise: ExerciseData;
  attempt: AttemptData;
};

type ActiveClue = {
  highlightArea: { x: number; y: number; width: number; height: number };
  hintTextTr: string | null;
};

export function DrawingExercise({
  exerciseId,
  attemptId,
  exercise,
  attempt: initialAttempt,
}: DrawingExerciseProps) {
  const defaultVisibleLayers = exercise.layers
    .filter((l) => l.defaultVisible)
    .map((l) => l.id);

  const [visibleLayers, setVisibleLayers] = useState<string[]>(defaultVisibleLayers);
  const [isComplete, setIsComplete] = useState(
    initialAttempt.status === "completed"
  );
  const [attemptCount, setAttemptCount] = useState(initialAttempt.attemptCount);
  const [hintsUsed, setHintsUsed] = useState(initialAttempt.hintsUsed);
  const [activeClue, setActiveClue] = useState<ActiveClue | null>(null);
  const [loading] = useState(false);

  const totalClues = exercise.elements.length; // one potential clue per element

  function handleAgentReply(reply: {
    agentMessage: string;
    matchedElements: Record<string, string>;
    visibleLayers: string[];
    isComplete: boolean;
    attemptCount: number;
  }) {
    setVisibleLayers(reply.visibleLayers);
    setAttemptCount(reply.attemptCount);
    if (reply.isComplete) {
      setIsComplete(true);
      // Clear any active clue
      setActiveClue(null);
    }
  }

  function handleHintReceived(
    hint: {
      highlightArea: { x: number; y: number; width: number; height: number };
      hintTextTr: string | null;
    } | null
  ) {
    if (!hint) {
      setActiveClue(null);
      return;
    }
    setActiveClue({
      highlightArea: hint.highlightArea,
      hintTextTr: hint.hintTextTr,
    });

    // Auto-clear clue highlight after 8 seconds
    setTimeout(() => setActiveClue(null), 8000);
  }

  return (
    <>
      <div className="exercise-header">
        <h1 className="exercise-title">
          {exercise.titleTr ?? "Resim Çizdir"}
        </h1>
      </div>

      <div className="exercise-layout">
        {/* Left column: target image (top) + chat (bottom) */}
        <div className="exercise-left">
          <TargetImagePanel
            targetImageKey={exercise.targetImageKey}
            activeClue={activeClue}
          />

          <ChatPanel
            exerciseId={exerciseId}
            attemptId={attemptId}
            descriptionTr={exercise.descriptionTr}
            totalClues={totalClues}
            hintsUsed={hintsUsed}
            isComplete={isComplete}
            loading={loading}
            onAgentReply={handleAgentReply}
            onHintReceived={handleHintReceived}
            onHintsUsedChange={setHintsUsed}
          />
        </div>

        {/* Right column: canvas */}
        <div className="exercise-right">
          <CanvasPanel
            layers={exercise.layers}
            visibleLayers={visibleLayers}
          />
        </div>
      </div>

      <CompletionModal
        isOpen={isComplete}
        attemptCount={attemptCount}
        hintsUsed={hintsUsed}
        lessonHref="/student"
      />
    </>
  );
}
