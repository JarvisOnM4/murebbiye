"use client";

type HighlightArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ActiveClue = {
  highlightArea: HighlightArea;
  hintTextTr: string | null;
};

type TargetImagePanelProps = {
  targetImageKey: string | null;
  activeClue: ActiveClue | null;
};

export function TargetImagePanel({ targetImageKey, activeClue }: TargetImagePanelProps) {
  // Build image URL — in dev, use a placeholder if no key is provided
  const imageUrl =
    targetImageKey
      ? `/api/student/media/${encodeURIComponent(targetImageKey)}`
      : null;

  return (
    <div className="target-panel" aria-label="Hedef resim">
      <p className="target-panel-label">Hedef Resim</p>
      <div className="target-image-container">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Tarif etmen gereken hedef resim"
            className="target-image"
            draggable={false}
          />
        ) : (
          <div className="target-image-placeholder" aria-label="Resim yükleniyor">
            <span className="target-placeholder-icon">🖼️</span>
            <span className="target-placeholder-text">Resim hazırlanıyor…</span>
          </div>
        )}

        {activeClue && (
          <div
            className="target-highlight"
            style={{
              left: `${activeClue.highlightArea.x}%`,
              top: `${activeClue.highlightArea.y}%`,
              width: `${activeClue.highlightArea.width}%`,
              height: `${activeClue.highlightArea.height}%`,
            }}
            aria-live="polite"
            aria-label={activeClue.hintTextTr ?? "İpucu işaretlendi"}
          >
            {activeClue.hintTextTr && (
              <div className="target-hint-tooltip">{activeClue.hintTextTr}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
