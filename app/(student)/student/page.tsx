import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getLearnerCookie, verifyLearnerToken, clearLearnerCookie } from "@/lib/learner/token";
import { prisma } from "@/lib/prisma";
import { AssistantPanel } from "./assistant-panel";
import { RecoverySync } from "./recovery-sync";

async function resolveStudent(): Promise<{
  id: string;
  nickname: string | null;
  authMode: "CREDENTIALS" | "LEARNER_TOKEN";
  recoveryCode: string | null;
} | null> {
  const session = await auth();
  if (session?.user && session.user.role === UserRole.STUDENT) {
    return {
      id: session.user.id,
      nickname: session.user.nickname ?? null,
      authMode: "CREDENTIALS",
      recoveryCode: null,
    };
  }

  const cookie = await getLearnerCookie();
  if (!cookie) return null;

  const payload = await verifyLearnerToken(cookie);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, nickname: true, recoveryCode: true },
  });

  if (!user) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  }).catch(() => {});

  return {
    id: user.id,
    nickname: user.nickname,
    authMode: "LEARNER_TOKEN",
    recoveryCode: user.recoveryCode,
  };
}

export default async function StudentPage() {
  const student = await resolveStudent();

  if (!student) {
    redirect("/");
  }

  async function handleSignOut() {
    "use server";

    const s = await auth();
    if (s?.user) {
      await signOut({ redirectTo: "/" });
    } else {
      await clearLearnerCookie();
      redirect("/");
    }
  }

  const displayName = student.nickname || "Öğrenci";

  return (
    <main className="dark-theme app-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <section className="shell">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: "1.3rem",
            color: "#f0ede6",
          }}>
            Merhaba, {displayName}
          </h1>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {student.authMode === "LEARNER_TOKEN" && (
              <a href="/student/settings" className="launch-link-btn" title="Ayarlar" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                Ayarlar
              </a>
            )}
            <form action={handleSignOut}>
              <button className="launch-link-btn" type="submit" title="Çıkış yap" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                Çıkış
              </button>
            </form>
          </div>
        </div>

        <AssistantPanel />

        {student.recoveryCode && (
          <RecoverySync code={student.recoveryCode} />
        )}
      </section>
    </main>
  );
}
