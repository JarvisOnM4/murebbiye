"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceVisualizer } from "./voice-visualizer";

type WordTiming = {
  word: string;
  start: number;
  end: number;
};

type NarratorSlideProps = {
  text: string;
  audioSrc?: string;
  timingSrc?: string;
  autoPlay?: boolean;
};

export function NarratorSlide({ text, audioSrc, timingSrc, autoPlay = true }: NarratorSlideProps) {
  const words = text.split(/\s+/);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [timings, setTimings] = useState<WordTiming[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const lastActiveRef = useRef<number>(-1);

  // Load word timings
  useEffect(() => {
    if (!timingSrc) return;
    fetch(timingSrc)
      .then((r) => r.json())
      .then((data: WordTiming[]) => setTimings(data))
      .catch(() => setTimings([]));
  }, [timingSrc]);

  const cancelRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Reset all word states via direct DOM
  const resetWords = () => {
    wordsRef.current.forEach((el) => {
      if (!el) return;
      el.classList.remove("active", "spoken");
      el.style.removeProperty("--wd");
    });
    lastActiveRef.current = -1;
  };

  // Mark all words as spoken (end state)
  const completeWords = () => {
    wordsRef.current.forEach((el) => {
      if (!el) return;
      el.classList.remove("active");
      el.classList.add("spoken");
    });
    lastActiveRef.current = -1;
  };

  // Sync loop — runs every animation frame, direct DOM manipulation (no React state)
  const syncLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const t = audio.currentTime;
    let activeIdx = -1;

    if (timings.length > 0) {
      for (let i = 0; i < timings.length; i++) {
        const w = timings[i];
        const el = wordsRef.current[i];
        if (!el) continue;

        if (t >= w.start) {
          // Word has started — make it spoken
          if (!el.classList.contains("spoken") && !el.classList.contains("active")) {
            // Calculate transition duration: proportional to word duration, clamped
            const dur = (w.end - w.start) * 1000;
            const transMs = Math.max(120, Math.min(350, dur));
            el.style.setProperty("--wd", `${transMs}ms`);
            el.classList.add("spoken");
          }

          // Is this the currently spoken word?
          if (t < w.end + 0.08) {
            activeIdx = i;
          }
        }
      }
    } else {
      // Fallback without timings
      const progress = audio.duration ? t / audio.duration : 0;
      activeIdx = Math.floor(progress * words.length);
      for (let i = 0; i <= activeIdx && i < wordsRef.current.length; i++) {
        const el = wordsRef.current[i];
        if (el && !el.classList.contains("spoken")) {
          el.style.setProperty("--wd", "200ms");
          el.classList.add("spoken");
        }
      }
    }

    // Update active highlight (only the current word)
    if (activeIdx !== lastActiveRef.current) {
      if (lastActiveRef.current >= 0) {
        const prev = wordsRef.current[lastActiveRef.current];
        if (prev) prev.classList.remove("active");
      }
      if (activeIdx >= 0) {
        const curr = wordsRef.current[activeIdx];
        if (curr) curr.classList.add("active");
      }
      lastActiveRef.current = activeIdx;
    }

    rafRef.current = requestAnimationFrame(syncLoop);
  }, [timings, words.length]);

  const play = useCallback(() => {
    resetWords();
    setIsComplete(false);
    setIsPlaying(true);
    cancelRaf();

    const audio = audioRef.current;
    if (audio && audioSrc) {
      audio.currentTime = 0;
      audio.play().then(() => {
        rafRef.current = requestAnimationFrame(syncLoop);
      }).catch(() => {
        // Autoplay blocked — stay hidden, wait for user to click play
        setIsPlaying(false);
      });
    } else {
      completeWords();
      setIsPlaying(false);
      setIsComplete(true);
    }
  }, [audioSrc, syncLoop]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    cancelRaf();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(syncLoop);
    }).catch(() => {});
  }, [syncLoop]);

  const handleToggle = () => {
    if (isPlaying) {
      pause();
    } else if (isComplete) {
      play();
    } else if (audioRef.current && audioRef.current.currentTime > 0) {
      resume();
    } else {
      play();
    }
  };

  // Audio ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      cancelRaf();
      setIsPlaying(false);
      setIsComplete(true);
      completeWords();
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  // Auto-play on mount
  useEffect(() => {
    if (!autoPlay) return;
    const id = setTimeout(() => play(), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      cancelRaf();
    };
  }, []);

  const playLabel = isPlaying ? "Duraklat" : isComplete ? "Tekrar dinle" : "Dinle";

  const iconPlay = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  );
  const iconPause = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
  );
  const iconReplay = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
  );
  const playIcon = isPlaying ? iconPause : isComplete ? iconReplay : iconPlay;

  return (
    <div className="narrator-card">
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} preload="auto" crossOrigin="anonymous" />
      )}

      <div className="narrator-layout">
        <div className="narrator-text-col">
          <div className="narrator-text" aria-live="polite" aria-label={text}>
            {words.map((word, i) => (
              <span
                key={i}
                ref={(el) => { wordsRef.current[i] = el; }}
                className="narrator-word"
              >
                {word}
              </span>
            ))}
          </div>

          <div className="narrator-controls">
            <button
              type="button"
              className="narrator-play-btn"
              onClick={handleToggle}
              title={playLabel}
              aria-label={playLabel}
            >
              {playIcon}
            </button>
          </div>
        </div>

        <div className="narrator-viz-col">
          <VoiceVisualizer
            audioElement={audioRef.current}
            isPlaying={isPlaying}
          />
        </div>
      </div>
    </div>
  );
}
