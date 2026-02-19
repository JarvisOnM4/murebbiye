import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AssistantPanel } from "./assistant-panel";
import { LessonMediaPanel } from "./lesson-media-panel";

export default async function StudentPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.STUDENT) {
    redirect("/admin");
  }

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="page-wrap">
      <section className="shell">
        <article className="hero">
          <span className="label">Student Surface</span>
          <h1>Student Panel</h1>
          <p>
            Hos geldiniz, <strong>{session.user.email}</strong>. Bu alan sadece student
            kullanicilar icindir. This route is restricted to student users.
          </p>
          <form action={handleSignOut}>
            <button className="btn" type="submit">
              Cikis Yap / Sign Out
            </button>
          </form>
        </article>

        <AssistantPanel />
        <LessonMediaPanel lessonId="demo" />
      </section>
    </main>
  );
}
