"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecoverPage() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pinRequired, setPinRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRecover() {
    if (code.trim().length < 5) {
      setError("Kurtarma kodunu girin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/learner/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryCode: code.trim().toUpperCase(),
          ...(pin ? { pin } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.pinRequired) {
          setPinRequired(true);
          setError("Bu hesap için PIN gerekli.");
        } else {
          setError(data.error || data.errors?.[0] || "Bir hata oluştu.");
        }
        return;
      }

      router.push("/student");
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="recover-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <div className="recover-card">
        <h1>Tekrar Hoş Geldin!</h1>
        <p>Kurtarma kodunu girerek kaldığın yerden devam et.</p>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MAVI-KEDI-042"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && !pinRequired && handleRecover()}
            className="settings-input"
            style={{ letterSpacing: "0.08em" }}
          />

          {pinRequired && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4 haneli PIN"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRecover()}
              className="settings-input"
            />
          )}

          {error && (
            <p style={{ color: "#ff8a8a", fontSize: "0.85rem", margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        <button
          className="launch-start-btn"
          onClick={handleRecover}
          disabled={loading}
          title="Hesabına geri dön"
          style={{ width: "100%" }}
        >
          {loading ? "Kontrol ediliyor..." : "Devam Et"}
        </button>

        <button
          className="launch-link-btn"
          onClick={() => router.push("/")}
          title="Ana sayfaya dön"
          style={{ width: "100%" }}
        >
          Ana Sayfa
        </button>
      </div>
    </main>
  );
}
