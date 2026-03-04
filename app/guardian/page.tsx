"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function GuardianContent() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLink() {
    if (code.trim().length < 5) {
      setError("Çocuğunuzun kurtarma kodunu girin.");
      return;
    }
    if (!email.includes("@")) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (!consent) {
      setError("Devam etmek için onay kutusunu işaretleyin.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/guardian/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryCode: code.trim().toUpperCase(),
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.errors?.[0] || "Bir hata oluştu.");
        return;
      }

      setSuccess(
        "Doğrulama e-postası gönderildi! Lütfen e-postanızı kontrol edin."
      );
      setCode("");
      setEmail("");
      setConsent(false);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  if (verified === "true") {
    return (
      <main className="guardian-wrap">
        <div className="launch-aurora" aria-hidden="true">
          <div className="aurora-blob blob-1" />
          <div className="aurora-blob blob-2" />
          <div className="aurora-blob blob-3" />
        </div>
        <div className="launch-grid-overlay" aria-hidden="true" />
        <div className="launch-grain" aria-hidden="true" />

        <div className="guardian-card">
          <h1>Doğrulama Başarılı!</h1>
          <p style={{ color: "#2dd4a8" }}>
            E-posta adresiniz doğrulandı. Artık çocuğunuzun ders raporlarını
            e-posta ile alacaksınız.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="guardian-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <div className="guardian-card">
        <h1>Veli Portalı</h1>
        <p>
          Çocuğunuzun kurtarma kodunu ve e-posta adresinizi girerek
          ders raporlarını alabilirsiniz.
        </p>

        <div style={{ display: "grid", gap: "0.75rem", textAlign: "left" }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Kurtarma kodu (ör. MAVI-KEDI-042)"
            className="settings-input"
            style={{ letterSpacing: "0.08em" }}
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta adresiniz"
            className="settings-input"
            style={{ letterSpacing: "normal" }}
          />

          <label
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-start",
              fontSize: "0.8rem",
              color: "#8a8a9a",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: "0.15rem" }}
            />
            <span>
              Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında e-posta
              adresimin çocuğumun eğitim raporlarını almak amacıyla
              işlenmesine onay veriyorum.
            </span>
          </label>

          {error && (
            <p style={{ color: "#ff8a8a", fontSize: "0.85rem", margin: 0 }}>
              {error}
            </p>
          )}
          {success && (
            <p style={{ color: "#2dd4a8", fontSize: "0.85rem", margin: 0 }}>
              {success}
            </p>
          )}
        </div>

        <button
          className="launch-start-btn"
          onClick={handleLink}
          disabled={loading}
          title="Bağlantı isteği gönder"
          style={{ width: "100%" }}
        >
          {loading ? "Gönderiliyor..." : "Doğrulama Gönder"}
        </button>
      </div>
    </main>
  );
}

export default function GuardianPage() {
  return (
    <Suspense>
      <GuardianContent />
    </Suspense>
  );
}
