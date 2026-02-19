"use client"

import { useCallback, useEffect, useState } from "react"

type AssetType =
  | "DIAGRAM"
  | "FLOWCHART"
  | "SLIDE_DECK"
  | "INTERACTIVE"
  | "VIDEO_SCRIPT"
  | "CARTOON_NARRATIVE"
  | "ILLUSTRATION"

type Slide = {
  title: string
  bullets: string[]
}

type Exercise = {
  type: "fill_in_blank" | "matching"
  prompt: string
  blanks?: string[]
  pairs?: { left: string; right: string }[]
}

type Scene = {
  sceneNumber: number
  narration: string
  visualDescription: string
}

type CartoonPanel = {
  panelNumber: number
  sceneDescription: string
  dialogue: string
}

type MediaAsset = {
  id: string
  type: AssetType
  title: string
  generatedContent: string
}

type MediaPayload = {
  assets: MediaAsset[]
}

function parseSlides(content: string): Slide[] {
  try {
    const parsed = JSON.parse(content) as Slide[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseExercises(content: string): Exercise[] {
  try {
    const parsed = JSON.parse(content) as Exercise[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseScenes(content: string): Scene[] {
  try {
    const parsed = JSON.parse(content) as Scene[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseCartoonPanels(content: string): CartoonPanel[] {
  try {
    const parsed = JSON.parse(content) as CartoonPanel[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseIllustration(content: string): { composition: string; svg: string } {
  try {
    const parsed = JSON.parse(content) as { composition: string; svg: string }
    return {
      composition: parsed.composition || "",
      svg: parsed.svg || ""
    }
  } catch {
    return { composition: content, svg: "" }
  }
}

function assetTypeBadge(type: AssetType) {
  return "status-pill status-processing"
}

function SlideDeckViewer({ content }: { content: string }) {
  const slides = parseSlides(content)
  const [currentSlide, setCurrentSlide] = useState(0)

  if (slides.length === 0) {
    return <p>Could not parse slide content.</p>
  }

  const slide = slides[currentSlide]

  return (
    <div className="media-slide-viewer">
      <div className="media-slide-nav">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          Prev
        </button>
        <span className="mono">
          {currentSlide + 1} / {slides.length}
        </span>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
          disabled={currentSlide === slides.length - 1}
          aria-label="Next slide"
        >
          Next
        </button>
      </div>
      <div className="media-slide-content">
        <h4>{slide.title}</h4>
        <ul>
          {slide.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function InteractiveViewer({ content }: { content: string }) {
  const exercises = parseExercises(content)

  if (exercises.length === 0) {
    return <p>Could not parse exercise content.</p>
  }

  return (
    <div className="media-exercises">
      {exercises.map((exercise, index) => (
        <div className="media-exercise-item" key={index}>
          <p><strong>{exercise.prompt}</strong></p>
          {exercise.type === "fill_in_blank" && exercise.blanks ? (
            <div className="media-blanks">
              {exercise.blanks.map((blank, blankIndex) => (
                <div className="field" key={blankIndex}>
                  <label htmlFor={`blank-${index}-${blankIndex}`}>Blank {blankIndex + 1}</label>
                  <input
                    id={`blank-${index}-${blankIndex}`}
                    type="text"
                    placeholder={`Answer for blank ${blankIndex + 1}`}
                    readOnly
                    defaultValue={blank}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {exercise.type === "matching" && exercise.pairs ? (
            <div className="media-matching-pairs">
              {exercise.pairs.map((pair, pairIndex) => (
                <div className="media-matching-row" key={pairIndex}>
                  <span className="media-match-left">{pair.left}</span>
                  <span className="mono">--</span>
                  <span className="media-match-right">{pair.right}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function VideoScriptViewer({ content }: { content: string }) {
  const scenes = parseScenes(content)

  if (scenes.length === 0) {
    return <p>Could not parse video script content.</p>
  }

  return (
    <div className="media-scenes">
      {scenes.map((scene) => (
        <div className="media-scene-item" key={scene.sceneNumber}>
          <div className="record-head">
            <strong>Scene {scene.sceneNumber}</strong>
          </div>
          <p><strong>Narration:</strong> {scene.narration}</p>
          <p><strong>Visual:</strong> {scene.visualDescription}</p>
        </div>
      ))}
    </div>
  )
}

function CartoonViewer({ content }: { content: string }) {
  const panels = parseCartoonPanels(content)

  if (panels.length === 0) {
    return <p>Could not parse cartoon content.</p>
  }

  return (
    <div className="media-cartoon-panels">
      {panels.map((panel) => (
        <div className="media-cartoon-panel" key={panel.panelNumber}>
          <div className="record-head">
            <strong>Panel {panel.panelNumber}</strong>
          </div>
          <p><strong>Scene:</strong> {panel.sceneDescription}</p>
          {panel.dialogue ? <p><strong>Dialogue:</strong> {panel.dialogue}</p> : null}
        </div>
      ))}
    </div>
  )
}

function IllustrationViewer({ content }: { content: string }) {
  const illustration = parseIllustration(content)

  return (
    <div className="media-illustration">
      <p><strong>Composition:</strong> {illustration.composition}</p>
      {illustration.svg ? (
        <div className="media-svg-placeholder">
          <pre className="media-code-block">{illustration.svg}</pre>
        </div>
      ) : (
        <div className="media-svg-placeholder">
          <p className="mono">[SVG placeholder]</p>
        </div>
      )}
    </div>
  )
}

export function LessonMediaPanel({ lessonId }: { lessonId: string }) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await fetch(`/api/student/lessons/${lessonId}/media`, {
      method: "GET",
      credentials: "same-origin"
    })

    if (!response.ok) {
      setError("Medya icerigi yuklenemedi. / Could not load media assets.")
      setLoading(false)
      return
    }

    const payload = (await response.json()) as MediaPayload
    setAssets(payload.assets)
    setLoading(false)
  }, [lessonId])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  function renderAsset(asset: MediaAsset) {
    switch (asset.type) {
      case "DIAGRAM":
      case "FLOWCHART":
        return (
          <div className="media-mermaid-block">
            <p className="mono">Mermaid Diagram</p>
            <pre className="media-code-block">{asset.generatedContent}</pre>
          </div>
        )

      case "SLIDE_DECK":
        return <SlideDeckViewer content={asset.generatedContent} />

      case "INTERACTIVE":
        return <InteractiveViewer content={asset.generatedContent} />

      case "VIDEO_SCRIPT":
        return <VideoScriptViewer content={asset.generatedContent} />

      case "CARTOON_NARRATIVE":
        return <CartoonViewer content={asset.generatedContent} />

      case "ILLUSTRATION":
        return <IllustrationViewer content={asset.generatedContent} />

      default:
        return <pre className="media-code-block">{asset.generatedContent}</pre>
    }
  }

  if (loading) {
    return (
      <section className="card lesson-media-panel">
        <h2>Lesson Media</h2>
        <p>Medya yukleniyor... / Loading media assets...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card lesson-media-panel">
        <h2>Lesson Media</h2>
        <p className="warn">{error}</p>
      </section>
    )
  }

  if (assets.length === 0) {
    return (
      <section className="card lesson-media-panel">
        <h2>Lesson Media</h2>
        <p>Bu ders icin medya icerigi henuz mevcut degil. / No media assets available for this lesson yet.</p>
      </section>
    )
  }

  return (
    <section className="card lesson-media-panel">
      <h2>Lesson Media</h2>

      <div className="records-grid">
        {assets.map((asset) => (
          <div className="record" key={asset.id}>
            <div className="record-head">
              <span>
                <span className={assetTypeBadge(asset.type)}>{asset.type}</span>{" "}
                {asset.title}
              </span>
            </div>
            {renderAsset(asset)}
          </div>
        ))}
      </div>
    </section>
  )
}
