export default function LaunchPage() {
  return (
    <main className="launch-wrap">
      {/* Aurora background blobs */}
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>

      {/* Subtle grid overlay */}
      <div className="launch-grid-overlay" aria-hidden="true" />

      {/* Film grain */}
      <div className="launch-grain" aria-hidden="true" />

      <section className="launch-content">
        <div className="launch-badge">
          <span className="launch-badge-dot" />
          yakında
        </div>

        <h1 className="launch-title">mürebbiye</h1>

        <p className="launch-subtitle">Yapay Zeka Eğitim Platformu</p>

        <div className="launch-divider" />

        <p className="launch-mission">
          Türkiye&apos;nin ilk ücretsiz, açık kaynak, Türkçe yapay zeka eğitim
          platformu. Çocuklarımız yapay zekayı anlamayı, onunla düşünmeyi ve
          geleceği şekillendirmeyi burada öğrenecek.
        </p>

        <div className="launch-features">
          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l2.5 2.5L16 9" />
              </svg>
            </span>
            <div>
              <strong>Ücretsiz</strong>
              <span>Her zaman, her çocuk için</span>
            </div>
          </div>

          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <div>
              <strong>Türkçe</strong>
              <span>Ana dilde, kültürel bağlamda</span>
            </div>
          </div>

          <div className="launch-feature">
            <div className="launch-feature-glow" />
            <span className="launch-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div>
              <strong>Yaparak Öğren</strong>
              <span>Tüketme değil, üretme</span>
            </div>
          </div>
        </div>

        <footer className="launch-footer">
          <p className="launch-quote">
            &ldquo;Hayatta en hakiki mürşit ilimdir, fendir.&rdquo;
          </p>
        </footer>
      </section>
    </main>
  );
}
