"use client";

import { useEffect, useRef } from "react";

type Props = {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
};

export function VoiceVisualizer({ audioElement, isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const connectedRef = useRef(false);

  // Connect audio element to Web Audio API analyser
  useEffect(() => {
    if (!audioElement || connectedRef.current) return;

    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      ctxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      connectedRef.current = true;
    } catch {
      // Audio context failed — silent fail
    }
  }, [audioElement]);

  // Resume audio context on play (browser autoplay policy)
  useEffect(() => {
    if (isPlaying && ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }
  }, [isPlaying]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Clear fully transparent
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!analyser || !isPlaying) {
        // Idle — subtle breathing flat line clipped to circle
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(cx, cy) - 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.beginPath();
        ctx.strokeStyle = "rgba(45, 212, 168, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const t = Date.now() * 0.002;
        const padding = r * 0.35;
        const startX = cx - r + padding;
        const drawWidth = r * 2 - padding * 2;
        ctx.moveTo(startX, cy);
        for (let px = 1; px < drawWidth; px++) {
          ctx.lineTo(startX + px, cy + Math.sin(px * 0.04 + t) * 2);
        }
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Get waveform
      analyser.getByteTimeDomainData(dataArray);

      // Clip to circle
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Draw waveform centered in circle
      const padding = r * 0.35;
      const drawWidth = r * 2 - padding * 2;
      const startX = cx - r + padding;
      const sliceWidth = drawWidth / bufferLength;

      // Glow layer
      ctx.beginPath();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(45, 212, 168, 0.12)";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const x = startX + i * sliceWidth;
        const y = cy + (v - 1) * r * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Main line
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2dd4a8";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const x = startX + i * sliceWidth;
        const y = cy + (v - 1) * r * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="visualizer-container">
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
