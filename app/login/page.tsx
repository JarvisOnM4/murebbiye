import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.role === UserRole.ADMIN) {
    redirect("/admin");
  }

  if (session?.user?.role === UserRole.STUDENT) {
    redirect("/student");
  }

  return (
    <main className="page-wrap">
      <section className="shell auth-shell">
        <article className="hero">
          <span className="label">Phase 2 / Auth</span>
          <h1>murebbiye Login</h1>
          <p>
            Admin ve Student rollerine e-posta/sifre ile giris yapin. Sign in with
            email/password for admin and student roles.
          </p>
          <LoginForm />
        </article>
      </section>
    </main>
  );
}
