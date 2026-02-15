# murebbiye (14-day MVP)

Phase 1 bootstrap for a Next.js + TypeScript + Prisma project targeting Vercel deployment.

## Locked Scope (Pilot)
- Roles: Admin + Student (email/password)
- Languages: Turkish + English UI/reporting
- Upload formats: Markdown + PDF
- Data policy: minimal PII only
- Budget gates:
  - monthly cap: `10 USD`
  - per lesson cap: `0.2 USD`
  - 80% mode: short-response + low-cost model
  - 100% mode: stop new generation, review-only mode

## Quick Start
```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

## Phase 1 Outputs
- Next.js app scaffold with `/`, `/admin`, `/student`, `/api/health`
- Prisma schema draft in `prisma/schema.prisma`
- Environment template in `.env.example`
- CI workflow in `.github/workflows/ci.yml`
- Auth plan and first deploy checklist in `docs/`

## Immediate Next Phase
Phase 2: email/password auth and role-protected routing.
