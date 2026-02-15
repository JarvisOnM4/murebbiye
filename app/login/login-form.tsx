"use client";

import { type FormEvent, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function getAuthErrorMessage(code: string | null) {
  if (!code) {
    return null;
  }

  if (code === "CredentialsSignin") {
    return "E-posta veya sifre gecersiz. / Invalid email or password.";
  }

  if (code === "AccessDenied") {
    return "Bu sayfaya erisim yetkiniz yok. / You do not have permission for this page.";
  }

  return "Giris basarisiz oldu. / Sign in failed.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/student";
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
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">E-posta / Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="password">Sifre / Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {errorMessage ? <p className="warn auth-error">{errorMessage}</p> : null}

      <button className="btn" type="submit" disabled={isPending}>
        {isPending ? "Giris yapiliyor... / Signing in..." : "Giris Yap / Sign In"}
      </button>
    </form>
  );
}
