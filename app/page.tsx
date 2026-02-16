import { pilotConfig } from "@/config/pilot";

export default function HomePage() {
  return (
    <main className="page-wrap">
      <section className="shell">
        <article className="hero">
          <span className="label">Phase 1 / Bootstrap</span>
          <h1>murebbiye - TR + EN Pilot</h1>
          <p>
            Bu ekran, 14 gunluk MVP pilotunun temel kurulumunu dogrular. This page confirms
            the baseline app is ready for auth, curriculum ingestion, and lesson features.
          </p>
        </article>

        <section className="grid">
          <article className="card">
            <h2>Roles</h2>
            <p>Admin and Student authentication is active via email/password.</p>
            <p className="mono">auth.mode: {pilotConfig.auth.mode}</p>
          </article>

          <article className="card">
            <h2>Budget Policy</h2>
            <p>
              Monthly cap: <strong>${pilotConfig.budget.monthlyCapUsd}</strong>, per lesson:
              <strong> ${pilotConfig.budget.perLessonCapUsd}</strong>
            </p>
            <p className="warn">80% and 100% mode gates are pre-configured in source.</p>
          </article>

          <article className="card">
            <h2>Routes</h2>
            <p>
              <a href="/login">/login</a> ile giris yapin. Protected routes:
              <a href="/admin"> /admin</a> and <a href="/student"> /student</a>.
            </p>
            <p>
              Admin uploads are live at <span className="mono">/api/admin/curriculum/upload</span>
            </p>
            <p>
              Health check endpoint: <span className="mono">/api/health</span>
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
