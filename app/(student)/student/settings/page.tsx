"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AVATARS = ["🦊", "🐼", "🦄", "🐬", "🦋", "🐢", "🦉", "🐧", "🐙", "🌟", "🚀", "🎨"];

export default function StudentSettingsPage() {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [pin, setPin] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Load learner info from session/localStorage
    const storedCode = sessionStorage.getItem("recoveryCode");
    const storedAvatar = sessionStorage.getItem("avatar");
    if (storedCode) setRecoveryCode(storedCode);
    if (storedAvatar) setAvatar(storedAvatar);
  }, []);

  async function handleSavePin() {
    if (!/^\d{4}$/.test(pin)) {
      setMessage("PIN 4 haneli bir sayı olmalı.");
      return;
    }

    setPinSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/learner/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || data.errors?.[0] || "PIN kaydedilemedi.");
        return;
      }

      setMessage("PIN başarıyla kaydedildi!");
      setPin("");
    } catch {
      setMessage("Bağlantı hatası.");
    } finally {
      setPinSaving(false);
    }
  }

  function handleAvatarSelect(emoji: string) {
    setAvatar(emoji);
    sessionStorage.setItem("avatar", emoji);
  }

  return (
    <main className="settings-wrap">
      <div className="settings-card">
        <h1>Ayarlar</h1>

        {recoveryCode && (
          <div className="settings-field">
            <label>Kurtarma Kodun</label>
            <code>{recoveryCode}</code>
            <p style={{ color: "#6a6a7a", fontSize: "0.8rem", margin: 0 }}>
              Bu kodu bir yere yaz — başka cihazdan giriş için lazım.
            </p>
          </div>
        )}

        <div className="settings-field">
          <label>PIN Belirle (opsiyonel)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="4 haneli PIN"
            className="settings-input"
          />
          <button
            className="launch-start-btn"
            onClick={handleSavePin}
            disabled={pinSaving}
            title="PIN kaydet"
            style={{ width: "100%", fontSize: "0.9rem", padding: "0.6rem" }}
          >
            {pinSaving ? "Kaydediliyor..." : "PIN Kaydet"}
          </button>
          {message && (
            <p
              style={{
                color: message.includes("başarı") ? "#2dd4a8" : "#ff8a8a",
                fontSize: "0.85rem",
                margin: 0,
              }}
            >
              {message}
            </p>
          )}
        </div>

        <div className="settings-field">
          <label>Avatar Seç</label>
          <div className="avatar-grid">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                className={`avatar-option ${avatar === emoji ? "selected" : ""}`}
                onClick={() => handleAvatarSelect(emoji)}
                title={`Avatar: ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button
          className="launch-link-btn"
          onClick={() => router.push("/student")}
          title="Geri dön"
          style={{ width: "100%" }}
        >
          Geri Dön
        </button>
      </div>
    </main>
  );
}
