"use client";

import { type FormEvent, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function getAuthErrorMessage(code: string | null) {
  if (!code) {
    return null;
  }

  if (code === "CredentialsSignin") {
    return "E-posta veya şifre geçersiz.";
  }

  if (code === "AccessDenied") {
    return "Bu sayfaya erişim yetkiniz yok.";
  }

  return "Giriş başarısız oldu.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const errorMessage = getAuthErrorMessage(searchParams.get("error"));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return;
    }

    startTransition(() => {
      void signIn("credentials", {
        email,
        password,
        callbackUrl
      });
    });
  }

  return (
    <form style={{ display: "grid", gap: "0.8rem" }} onSubmit={handleSubmit}>
      <div style={{ display: "grid", gap: "0.3rem" }}>
        <label htmlFor="email" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#8a8a9a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="settings-input"
          style={{ textAlign: "left", letterSpacing: "normal" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.3rem" }}>
        <label htmlFor="password" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#8a8a9a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="settings-input"
          style={{ textAlign: "left", letterSpacing: "normal" }}
        />
      </div>

      {errorMessage ? (
        <p style={{ color: "#ff8a8a", fontSize: "0.85rem", margin: 0 }}>
          {errorMessage}
        </p>
      ) : null}

      <button
        className="launch-start-btn"
        type="submit"
        disabled={isPending}
        title="Giriş yap"
        style={{ width: "100%" }}
      >
        {isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
