"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FlowState = "landing" | "nickname" | "code";

export default function LaunchPage() {
  const [flow, setFlow] = useState<FlowState>("landing");
  const [nickname, setNickname] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleStart() {
    if (nickname.trim().length < 2) {
      setError("Takma ad en az 2 karakter olmalı.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/learner/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.errors?.[0] || "Bir hata oluştu.");
        return;
      }

      setRecoveryCode(data.recoveryCode);
      setFlow("code");
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    router.push("/student");
  }

  if (flow === "code") {
    return (
      <main className="launch-wrap">
        <div className="launch-aurora" aria-hidden="true">
          <div className="aurora-blob blob-1" />
          <div className="aurora-blob blob-2" />
          <div className="aurora-blob blob-3" />
        </div>
        <div className="launch-grid-overlay" aria-hidden="true" />
        <div className="launch-grain" aria-hidden="true" />

        <section className="launch-content">
          <h1 className="launch-title" style={{ fontSize: "2rem" }}>
            Hoş geldin, {nickname}!
          </h1>

          <p className="launch-subtitle">Kurtarma Kodun</p>

          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "12px",
              padding: "1.25rem 2rem",
              margin: "1rem auto",
              maxWidth: "360px",
              textAlign: "center",
            }}
          >
            <code
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#fff",
              }}
            >
              {recoveryCode}
            </code>
          </div>

          <p
            className="launch-mission"
            style={{ fontSize: "0.85rem", maxWidth: "400px" }}
          >
            Bu kodu bir yere yaz! Başka bir cihazdan giriş yaparken lazım olacak.
            Ayarlar sayfasında PIN de belirleyebilirsin.
          </p>

          <button
            className="launch-start-btn"
            onClick={handleContinue}
            title="Öğrenmeye başla"
          >
            Öğrenmeye Başla
          </button>
        </section>
      </main>
    );
  }

  if (flow === "nickname") {
    return (
      <main className="launch-wrap">
        <div className="launch-aurora" aria-hidden="true">
          <div className="aurora-blob blob-1" />
          <div className="aurora-blob blob-2" />
          <div className="aurora-blob blob-3" />
        </div>
        <div className="launch-grid-overlay" aria-hidden="true" />
        <div className="launch-grain" aria-hidden="true" />

        <section className="launch-content">
          <h1 className="launch-title" style={{ fontSize: "2rem" }}>
            Sana ne diyelim?
          </h1>

          <p className="launch-subtitle">Bir takma ad seç</p>

          <div style={{ maxWidth: "320px", margin: "1rem auto" }}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Takma adın..."
              maxLength={30}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: "1.1rem",
                outline: "none",
                textAlign: "center",
              }}
            />
            {error && (
              <p style={{ color: "#ff8a8a", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                {error}
              </p>
            )}
          </div>

          <button
            className="launch-start-btn"
            onClick={handleStart}
            disabled={loading}
            title="Hesap oluştur ve başla"
          >
            {loading ? "Hazırlanıyor..." : "Devam"}
          </button>

          <button
            className="launch-link-btn"
            onClick={() => {
              setFlow("landing");
              setError("");
            }}
            title="Geri dön"
          >
            Geri
          </button>
        </section>
      </main>
    );
  }

  // Landing state
  return (
    <main className="launch-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <section className="launch-content">
        <div className="launch-badge">
          <span className="launch-badge-dot" />
          yakında
        </div>

        <h1 className="launch-title">mürebbiye</h1>

        <p className="launch-subtitle">Yapay Zeka Eğitim Platformu</p>

        <div className="launch-divider" />

        <p className="launch-mission">
          Türkiye&apos;nin ilk ücretsiz, açık kaynak, Türkçe yapay zeka eğitim
          platformu. Çocuklarımız yapay zekayı anlamayı, onunla düşünmeyi ve
          geleceği şekillendirmeyi burada öğrenecek.
        </p>

        <div className="launch-features">
          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2.5 2.5L16 9" />
              </svg>
            </span>
            <div>
              <strong>Ücretsiz</strong>
              <span>Her zaman, her çocuk için</span>
            </div>
          </div>

          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <div>
              <strong>Türkçe</strong>
              <span>Ana dilde, kültürel bağlamda</span>
            </div>
          </div>

          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div>
              <strong>Yaparak Öğren</strong>
              <span>Tüketme değil, üretme</span>
            </div>
          </div>
        </div>

        <div className="launch-buttons">
          <button
            className="launch-start-btn launch-btn-hero"
            onClick={() => setFlow("nickname")}
            title="Hemen öğrenmeye başla"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Başla
          </button>
          <button
            className="launch-link-btn launch-btn-secondary"
            onClick={() => router.push("/recover")}
            title="Kurtarma kodunla giriş yap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Kod ile Bağlan
          </button>
        </div>

        <footer className="launch-footer">
          <p className="launch-quote">
            &ldquo;Hayatta en hakiki mürşit ilimdir, fendir.&rdquo;
          </p>
        </footer>
      </section>
    </main>
  );
}
