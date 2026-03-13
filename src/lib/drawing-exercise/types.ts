export type ExerciseSpec = {
  targetDescription: string;
  elements: ExerciseElement[];
  layers: TemplateLayer[];
  clues: ExerciseClue[];
  agentConfig?: { maxResponseTokens?: number; personality?: string };
};

export type ExerciseElement = {
  id: string;
  labelTr: string;
  labelEn?: string;
  category: "required" | "bonus";
  detectionHints: string[];
  activatesLayers: string[];
  dependsOn?: string;
};

export type TemplateLayer = {
  id: string;
  imageKey: string;
  zIndex: number;
  defaultVisible: boolean;
  mutuallyExclusive?: string[];
};

export type ExerciseClue = {
  elementId: string;
  order: number;
  highlightArea: { x: number; y: number; width: number; height: number };
  hintTextTr?: string;
  hintTextEn?: string;
};

export type ElementStatus = "present" | "partial" | "missing";

export type PromptAnalysis = {
  message: string;
  detectedElements: Record<string, ElementStatus>;
  confidence: number;
};
