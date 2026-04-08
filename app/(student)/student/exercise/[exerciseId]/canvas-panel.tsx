"use client";

type TemplateLayer = {
  id: string;
  imageKey: string;
  zIndex: number;
  defaultVisible: boolean;
  mutuallyExclusive?: string[];
};

type CanvasPanelProps = {
  layers: TemplateLayer[];
  visibleLayers: string[];
};

export function CanvasPanel({ layers, visibleLayers }: CanvasPanelProps) {
  const visibleSet = new Set(visibleLayers);
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="canvas-panel" aria-label="Çizim tuvalı">
      <p className="canvas-panel-label">Çizim</p>
      <div className="canvas-stage">
        {sortedLayers.map((layer) => {
          const isVisible = visibleSet.has(layer.id);
          // Convert imageKey like "exercises/blue-cabrio/bg.png" to "/exercises/blue-cabrio/bg.png"
          const src = layer.imageKey.startsWith("/")
            ? layer.imageKey
            : `/${layer.imageKey}`;

          return (
            <div
              key={layer.id}
              className="canvas-layer"
              style={{
                zIndex: layer.zIndex,
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.5s ease-out",
              }}
              aria-hidden={!isVisible}
            >
              <img
                src={src}
                alt={layer.id}
                className="canvas-layer-img"
                draggable={false}
              />
            </div>
          );
        })}

        {sortedLayers.length === 0 && (
          <div className="canvas-empty">
            <span>Katmanlar yükleniyor…</span>
          </div>
        )}
      </div>
    </div>
  );
}
