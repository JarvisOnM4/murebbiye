import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { CurriculumPanel } from "./curriculum-panel";
import { OpsPanel } from "./ops-panel";
import { ParentReportsPanel } from "./parent-reports-panel";
import { MediaAgentPanel } from "./media-agent-panel";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect("/student");
  }

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="page-wrap">
      <section className="shell">
        <article className="hero">
          <span className="label">Admin Surface</span>
          <h1>Admin Panel</h1>
          <p>
            Hos geldiniz, <strong>{session.user.email}</strong>. Bu alan sadece admin
            kullanicilar icindir. This route is restricted to admin users.
          </p>
          <form action={handleSignOut}>
            <button className="btn" type="submit">
              Cikis Yap / Sign Out
            </button>
          </form>
        </article>

        <CurriculumPanel />
        <OpsPanel />
        <ParentReportsPanel />
        <MediaAgentPanel />
      </section>
    </main>
  );
}
