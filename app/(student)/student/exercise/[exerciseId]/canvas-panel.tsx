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

// Generate a consistent placeholder color from a string
function layerColor(id: string): string {
  const colors = [
    "#1a3a4a",
    "#2a4a3a",
    "#3a3a5a",
    "#4a3a2a",
    "#2a3a4a",
    "#3a4a2a",
    "#4a2a3a",
    "#2a4a4a",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length] ?? "#2a3a4a";
}

export function CanvasPanel({ layers, visibleLayers }: CanvasPanelProps) {
  const visibleSet = new Set(visibleLayers);

  // Sort layers by zIndex ascending
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="canvas-panel" aria-label="Çizim tuvalı">
      <p className="canvas-panel-label">Çizim</p>
      <div className="canvas-stage">
        {sortedLayers.map((layer) => {
          const isVisible = visibleSet.has(layer.id);
          return (
            <div
              key={layer.id}
              className="canvas-layer"
              style={{
                zIndex: layer.zIndex,
                opacity: isVisible ? 1 : 0,
              }}
              aria-hidden={!isVisible}
            >
              {/* Dev placeholder: colored rectangle with layer ID */}
              <div
                className="canvas-layer-placeholder"
                style={{ background: layerColor(layer.id) }}
              >
                <span className="canvas-layer-id">{layer.id}</span>
              </div>
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
