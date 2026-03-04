import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getLearnerCookie, verifyLearnerToken, clearLearnerCookie } from "@/lib/learner/token";
import { prisma } from "@/lib/prisma";
import { AssistantPanel } from "./assistant-panel";
import { LessonMediaPanel } from "./lesson-media-panel";

async function resolveStudent(): Promise<{
  id: string;
  nickname: string | null;
  authMode: "CREDENTIALS" | "LEARNER_TOKEN";
  recoveryCode: string | null;
} | null> {
  // Try NextAuth first
  const session = await auth();
  if (session?.user && session.user.role === UserRole.STUDENT) {
    return {
      id: session.user.id,
      nickname: session.user.nickname ?? null,
      authMode: "CREDENTIALS",
      recoveryCode: null,
    };
  }

  // Try learner cookie
  const cookie = await getLearnerCookie();
  if (!cookie) return null;

  const payload = await verifyLearnerToken(cookie);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, nickname: true, recoveryCode: true },
  });

  if (!user) return null;

  // Update lastActiveAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  }).catch(() => { /* non-critical */ });

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
    <main className="page-wrap">
      <section className="shell">
        <article className="hero">
          <span className="label">Student Surface</span>
          <h1>Hoş geldin, {displayName}!</h1>
          <p>
            Bu alan senin öğrenme alanın. Asistan ile soru sorabilir,
            derslere katılabilirsin.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <form action={handleSignOut}>
              <button className="btn" type="submit" title="Çıkış yap">
                Çıkış Yap
              </button>
            </form>
            {student.authMode === "LEARNER_TOKEN" && (
              <a href="/student/settings" className="btn btn-secondary" title="Ayarlar">
                Ayarlar
              </a>
            )}
          </div>
          {student.recoveryCode && (
            <script
              dangerouslySetInnerHTML={{
                __html: `try{sessionStorage.setItem("recoveryCode",${JSON.stringify(student.recoveryCode)})}catch(e){}`,
              }}
            />
          )}
        </article>

        <AssistantPanel />
        <LessonMediaPanel lessonId="demo" />
      </section>
    </main>
  );
}
