"use client";

type Step = {
  number: number;
  title: string;
};

type StepIndicatorProps = {
  steps: Step[];
  currentStep: number;
};

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav
      className="step-indicator"
      aria-label="Ders adımları"
    >
      {steps.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const isConnector = index < steps.length - 1;

        let dotClass = "step-dot";
        if (isActive) dotClass += " active";
        else if (isCompleted) dotClass += " completed";

        return (
          <div key={step.number} style={{ display: "contents" }}>
            <div
              className={dotClass}
              title={step.title}
              aria-label={`${step.number}. adım: ${step.title}${isActive ? " (şu an)" : isCompleted ? " (tamamlandı)" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              {isCompleted ? "✓" : step.number}
            </div>

            {isConnector && (
              <div
                className={`step-connector${isCompleted ? " completed" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
