# Security Audit Decisions — 2026-03-07

3 audit turu yapildi: genel guvenlik, blackbox+whitebox, AI/LLM (OWASP LLM Top 10 + EU AI Act).

## Urun Karari Gerektiren Bulgular ve Alinan Kararlar

| Bulgu | Kaynak | Karar | Gerekce |
|-------|--------|-------|---------|
| Yas dogrulama / veli onayi | EU AI Act, KVKK | **ASIS** | Prototip asamasinda. Kullanici tabani buyudugunde yeniden degerlendirilecek. Guardian link mevcut ama zorunlu degil. |
| Konusma loglama (audit trail) | NIST AI RMF - Accountability | **YOK** | Cocuk gizliligi oncelikli. Sorulari ve yanitlari loglamak KVKK riski olusturur. Ileride anonim aggregate metrikler dusunulebilir. |
| Client-side logging | Genel | **YOK** | Ayni gizlilik gerekceleri. |
| OpenRouter API key rotasyonu | OWASP LLM05, NIST Security | **BEKLEMEDE** | Management key yok, dashboard'dan manual yapilmasi gerekiyor. Risk degerlendirmesi asagida. |
| Gunluk soru limiti | OWASP LLM04, maliyet kontrolu | **500 -> 100** | Cocuk kullanimi icin 100 yeterli. Maliyet kontrolu saglar. |
| Veri silme / disa aktarma | EU AI Act, KVKK | **ERTELENDI** | Kullanici tabani kucuk. Buyume ile birlikte DELETE /api/learner/delete ve GET /api/learner/export endpointleri eklenecek. |

## OpenRouter API Key Rotasyon Riski

### Mevcut Durum
- Key `.env` dosyasinda (git'te DEGIL, .gitignore'da)
- Key Vercel env vars'da (encrypted, production)
- Key bu session'da context window'da gorundu (conversation log)

### Rotate Etmemenin Riskleri
1. **Dusuk risk**: `.env` dosyasi sadece local makinede. Git'e commit edilmemis. Makineye fiziksel erisim veya remote exploit gerekir.
2. **Dusuk risk**: Vercel env vars encrypted ve sadece proje sahibi gorebilir.
3. **Orta risk**: Bu conversation logu Claude'un sunucularinda saklanir. Anthropic'in data retention policy'sine tabi. Bir veri ihlali durumunda key expose olabilir.
4. **Dusuk etki**: Key ele gecirilse bile sadece OpenRouter API erisimi saglar. Qwen3-235B maliyeti dusuk ($0.07/$0.10 per 1M token). Monthly cap $10. Saldirgan max $10/ay zarar verebilir.

### Sonuc
**Genel risk: DUSUK-ORTA.** Key rotate edilmese de finansal etki sinirli ($10/ay cap). Ancak best practice olarak rotate edilmesi onerilir. OpenRouter dashboard'dan yapilmasi gerekir (API desteklemiyor).

## Uygulanan Guvenlik Onlemleri (Ozet)

### Audit 1 — Genel Guvenlik
- Nickname XSS: HTML tag stripping
- Rate limiter: in-memory fallback (Redis yokken)
- dangerouslySetInnerHTML: React component ile degistirildi
- CSP + security headers (next.config.ts + vercel.json)
- Error message sanitization (production'da generic mesaj)
- Assistant endpoint: 10 req/min rate limit

### Audit 2 — Blackbox + Whitebox
- Prompt injection: XML delimiters + anti-injection system prompt
- Guardian token: sadece dev'de loglanir
- IDOR: lesson media ownership check
- Quota: DB hatasinda fail-closed
- Recovery code oracle: birlestik hata mesaji (403)
- PIN endpoint: rate limiting (3/saat)
- JWT: 1 yil -> 30 gun
- CORS: murebbiye.org'a kisitlandi
- Auth error logging: error object kaldirildi
- Health: production'da minimal bilgi

### Audit 3 — AI/LLM (OWASP LLM Top 10 + EU AI Act)
- LLM01: Input sanitizer (XML tags, injection patterns, code blocks)
- LLM02: Unsafe content filter (child safety keyword blocking)
- LLM05: API key validation (fail fast if missing)
- LLM06: Internal metadata stripped from client responses
- LLM09: LLM fallback FALLBACK status sinyali
- EU AI Act Art. 52: AI disclosure banner
- Rate limiter production warning

## Veli Onayi: Kademeli Erisim Modeli

**Tetikleyici**: 100 distinct kullanici (Vercel Analytics)
**Durum**: BEKLEMEDE — prototip asamasinda zorunlu degil

### Tasarim: Graduated Access

1. **Deneme (5 soru)**: Kayit olmadan 5 soru sorabilir. Iyi bir ilk izlenim icin yeterli.
2. **Guardian Gate**: 5. sorudan sonra veli onayi zorunlu. Cocuk devam edemez.
3. **Tam Erisim**: Veli onayladiginda gunluk 100 soru limiti aktif.

### Veli Onay Yontemleri (en seamless → en guvenli)

| Yontem | UX | Guvenlik | Notlar |
|--------|-----|----------|--------|
| **QR Kod** | Cocuk ekraninda QR → veli telefonla tarar → onay sayfasi | Orta | En hizli, fiziksel yakinlik gerektirir |
| **E-posta linki** | Cocuk veli e-postasini girer → veli maile gelen linke tiklar | Yuksek | Standart, e-posta dogrulamasi dahil |
| **SMS kodu** | Cocuk veli telefonunu girer → SMS ile 6 haneli kod | Yuksek | Maliyet var (Twilio/similar), en taninir UX |
| **Paylasim linki** | Cocuk "Velime gonder" butonuna basar → WhatsApp/iMessage ile link paylasir | Dusuk-Orta | En dusuk friction, ama cocuk kendisi onaylayabilir |

### Onerilen Uygulama Sirasi
1. **MVP**: E-posta linki (sifir maliyet, yuksek guvenlik)
2. **V2**: QR kod eklenir (sinif ortami icin ideal)
3. **V3**: SMS (kullanici tabani buyurse)

### Teknik Notlar
- Guardian modeli zaten mevcut (`Guardian` Prisma model, `/api/guardian/link`)
- Mevcut guardian link akisi genisletilecek, sifirdan yazilmayacak
- Deneme sayaci: `sessionStorage` veya anonim cookie (kayitsiz kullanici icin)
- Onay sonrasi: guardian kaydı olusur, cocuk profili guardian'a baglanir

## Gelecekte Yapilacaklar
- [ ] **100 kullanici milestone**: Veli onayi kademeli erisim implementasyonu (yukaridaki tasarim)
- [ ] KVKK compliance: veri silme + disa aktarma endpointleri
- [ ] Anonim aggregate metrikler (audit trail yerine)
- [ ] OpenRouter key rotasyonu (dashboard'dan manual)
- [ ] CSP: unsafe-inline/unsafe-eval -> nonce-based (Next.js destegi gerekli)
- [ ] Upstash Redis: production rate limiting icin zorunlu
