# Project Handoff Summary

Last Updated: 2026-02-19
Project: **murebbiye**
Repository: `https://github.com/JarvisOnM4/murebbiye.git`
Status: **Production-ready, awaiting first deploy**

---

## What Is Murebbiye

Murebbiye is a bilingual (Turkish/English) AI tutoring platform. An admin uploads curriculum documents (PDF/Markdown), the system generates personalized lessons using an LLM, students interact with an AI assistant during lessons, and parents receive email summaries with learning metrics.

---

## Architecture

```
                  murebbiye.org (DNS via Vercel)
                         |
                    Vercel Edge
                         |
              Next.js 15 (App Router)
               /         |          \
      RDS PostgreSQL   S3 Bucket   AWS Bedrock
        (us-east-1)   (us-east-1)  (Claude 3.5 Haiku)
```

- **Frontend + API**: Next.js 15, React 19, Tailwind CSS on Vercel (free tier or $20/mo Pro)
- **Database**: PostgreSQL 16 on AWS RDS (db.t4g.micro)
- **File Storage**: AWS S3 (versioned, encrypted)
- **LLM**: AWS Bedrock with Claude 3.5 Haiku (pay-per-token, ~$5-10/mo)
- **Auth**: NextAuth v5 beta, bcrypt passwords, JWT sessions
- **Email**: Nodemailer via external SMTP
- **Queue**: Upstash QStash for async jobs
- **Infra-as-Code**: AWS CDK (TypeScript) in `infra/` directory
- **CI**: GitHub Actions (lint, typecheck, test, build)

Estimated monthly cost: **~$18-24** (Vercel free) or **~$38-44** (Vercel Pro)

---

## Build History

### Original Build (Phases 1-8)

The project was built iteratively over 8 phases on a Windows machine without Docker or a running database, using fallback persistence patterns (JSON files + in-memory stores) to develop features without PostgreSQL:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Bootstrap: Next.js + Prisma + health endpoint | Done |
| 2 | Auth: email/password + role routing + env-fallback | Done |
| 3 | Curriculum ingestion: PDF/MD parser + chunking | Done |
| 4 | Lesson generation: template engine + track ratios | Done |
| 5 | Student assistant: scope-constrained Q&A | Done |
| 6 | Reporting: metrics + parent email summaries | Done |
| 7 | Budget + performance: caps, mode degradation, latency tracking | Done |
| 8 | AI Media Agent: two-stage storyboard-to-generation pipeline | Done |

### Production Overhaul (This Session)

The user requested: *"I need full functional software, deployable with one line of code. Everything deployed on AWS, web UI on Vercel, maintainable by r2-assistant."*

A 9-phase production overhaul was executed:

| Phase | What Changed | Status |
|-------|-------------|--------|
| 1 | Docker Compose for local dev + Prisma migration baseline | Done |
| 2 | Replaced OpenAI fetch wrapper with `@aws-sdk/client-bedrock-runtime` (Claude Haiku) | Done |
| 3 | Replaced local filesystem with `@aws-sdk/client-s3`, removed ~1,200 lines of fallback persistence code | Done |
| 4 | Rewrote performance metrics from in-memory to Prisma, enhanced health endpoint with DB check | Done |
| 5 | Created AWS CDK stack in `infra/` (RDS + S3 + IAM + Secrets Manager) | Done |
| 6 | Created `vercel.json`, configured `serverExternalPackages` for Prisma + AWS SDKs | Done |
| 7 | Added Vitest (88 tests across 10 files), installed vitest + @vitest/coverage-v8 | Done |
| 8 | Updated CI pipeline: added test step, fixed old DB name in env | Done |
| 9 | Created 4 docs (architecture, setup-guide, maintenance-guide, runbook) + CLAUDE.md | Done |

**Key changes in the overhaul:**

1. **LLM**: `src/lib/media-agent/llm.ts` completely rewritten from OpenAI `fetch()` to AWS Bedrock `BedrockRuntimeClient`. System messages extracted to top-level `system` field per Anthropic API format. JSON mode via system prompt instruction.

2. **Storage**: `src/lib/storage/s3.ts` created with `uploadToS3()` and `downloadFromS3()`. `src/lib/curriculum/repository.ts` rewritten to use S3 instead of `fs.writeFile/readFile`.

3. **Fallback removal**: Deleted `src/lib/persistence.ts` entirely. All repositories (budget, lesson, media-agent, reporting, curriculum) simplified to direct Prisma calls. Removed `persistence: "db" | "fallback"` field from 7 type files. Removed persistence display from 2 UI panels.

4. **Database migrations**: Generated initial migration from schema (`prisma/migrations/20260219000000_init/migration.sql`) + performance metrics migration (`20260219010000_add_performance_metrics/migration.sql`).

5. **Infrastructure**: Full CDK stack in `infra/` creating RDS PostgreSQL 16, S3 bucket, IAM user with Bedrock + S3 permissions, access key in Secrets Manager. Deploy script at `scripts/deploy.sh`.

6. **Testing**: 88 tests across 10 files covering env validation, curriculum parser, LLM cost computation, budget service, and performance metrics. All pure-function unit tests (no DB or AWS needed).

---

## Current State

### What Works

- **TypeScript**: 0 errors (`tsc --noEmit`)
- **Tests**: 88/88 passing (`vitest run`)
- **Lint**: Clean (`next lint`)
- **Build**: Compiles successfully (`next build`)
- **CI**: GitHub Actions runs lint + typecheck + test + build on push to main

### What Has NOT Been Done Yet

1. **First AWS deploy**: `scripts/deploy.sh` has not been run. No RDS instance, S3 bucket, or IAM user exist yet.
2. **First Vercel deploy**: Project is not yet linked to Vercel or deployed.
3. **Domain registration**: `murebbiye.org` has not been purchased/registered.
4. **Bedrock model access**: Need to request access to Claude Haiku in AWS Console.
5. **SMTP configuration**: No real SMTP credentials configured for parent emails.
6. **Production seed**: No admin/student users created in production DB.
7. **End-to-end testing with real LLM**: All LLM-dependent features (lesson generation, student assistant, media agent) have not been tested against real Bedrock.
8. **Lesson draft files**: Still reference local filesystem (`storage/lesson-drafts/*.json`). This works on Vercel's ephemeral filesystem but drafts don't persist across deploys. May need migration to S3 or DB.

### Known Limitations

- **RDS publicly accessible**: Port 5432 open to 0.0.0.0/0 because Vercel has dynamic IPs. Compensated by SSL enforcement + Secrets Manager password.
- **IAM long-lived access keys**: Required because Vercel is not AWS compute (no IAM roles). Keys stored in Secrets Manager.
- **NextAuth beta**: Using v5.0.0-beta.25 which may have breaking changes in future releases.
- **Vitest CJS warning**: Cosmetic deprecation warning about Vite CJS build. Functional, upgrade when Node 22 is adopted.

---

## File Map (Key Files)

| File | Purpose |
|------|---------|
| `src/lib/media-agent/llm.ts` | Bedrock LLM client (`callLlm`, `callLlmJson`) |
| `src/lib/storage/s3.ts` | S3 wrapper (`uploadToS3`, `downloadFromS3`) |
| `src/lib/env.ts` | Zod-validated environment configuration |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/curriculum/parser.ts` | PDF/Markdown parser + chunker |
| `src/lib/budget/service.ts` | Budget status + mode calculation |
| `src/lib/lesson/service.ts` | Lesson generation + retrieval |
| `src/lib/assistant/service.ts` | Student assistant (scope-constrained Q&A) |
| `src/lib/media-agent/orchestrator.ts` | Two-stage media enrichment pipeline |
| `src/lib/reporting/service.ts` | Parent email composition + dispatch |
| `src/auth.ts` | NextAuth configuration |
| `middleware.ts` | Role-based route protection |
| `prisma/schema.prisma` | Database schema (14 models, 10 enums) |
| `infra/lib/murebbiye-stack.ts` | AWS CDK stack (RDS + S3 + IAM) |
| `infra/lib/config.ts` | CDK configuration constants |
| `scripts/deploy.sh` | One-command AWS deploy |
| `vercel.json` | Vercel deployment config |
| `.github/workflows/ci.yml` | CI pipeline |

---

## Environment Variables

All defined in `.env.example`. Critical ones:

| Variable | Required | Source |
|----------|----------|--------|
| `DATABASE_URL` | Yes | AWS Secrets Manager (after CDK deploy) |
| `NEXTAUTH_SECRET` | Yes | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `https://murebbiye.org` |
| `APP_BASE_URL` | Yes | `https://murebbiye.org` |
| `AWS_ACCESS_KEY_ID` | Yes | CDK output |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS Secrets Manager |
| `AWS_REGION` | No | Default: `us-east-1` |
| `S3_BUCKET_NAME` | Yes | CDK output |
| `MONTHLY_CAP_USD` | Yes | Budget cap (recommend: `10`) |
| `PER_LESSON_CAP_USD` | Yes | Per-lesson cap (recommend: `0.2`) |

---

## How to Resume Work

### On a new machine

```bash
git clone https://github.com/JarvisOnM4/murebbiye.git
cd murebbiye
npm install
cp .env.example .env
# Edit .env with your values
```

### Key commands

```bash
npm run dev              # Start dev server
npm test                 # Run 88 tests
npm run check            # Full validation (lint + typecheck + build + prisma validate)
npm run docker:up        # Start local PostgreSQL
npx prisma migrate dev   # Apply migrations locally
```

### First production deploy

Follow the step-by-step guide in `docs/setup-guide.md`:
1. Deploy AWS infra: `./scripts/deploy.sh`
2. Enable Bedrock model access in AWS Console
3. Run migrations: `DATABASE_URL=<url> npx prisma migrate deploy`
4. Seed users: `DATABASE_URL=<url> npx tsx prisma/seed.ts`
5. Deploy to Vercel: `npx vercel --prod`
6. Set env vars in Vercel dashboard
7. Configure domain DNS

### Maintenance

See `docs/maintenance-guide.md` for ongoing operations and `docs/runbook.md` for troubleshooting common issues.

---

## r2-assistant Integration

The project documentation (all files in `docs/`) is written to be understandable by r2-assistant for maintenance purposes. r2-assistant lives at `C:/Users/patcher/Documents/antigravity/r2-assistant` and has:
- AWS Bedrock integration (can invoke Claude for analysis)
- Docker management capabilities
- Structured markdown document understanding

Key docs for r2-assistant:
- `docs/architecture.md` — system overview + component map
- `docs/setup-guide.md` — deployment steps
- `docs/maintenance-guide.md` — day-to-day operations
- `docs/runbook.md` — troubleshooting procedures

---

## Git History (Recent)

```
3a7ab6b  Update README with current architecture, structure, and deployment guides
ef55f53  Production-ready: Bedrock LLM, S3 storage, AWS CDK, Vercel deploy, tests, CI/CD, docs
a0fdbb5  add Phase 8: AI media agent with two-stage storyboard-to-generation pipeline
1066acd  fix ci missing prisma env variables
ca5f754  fix ci nodemailer peer conflict
```

---

## User Preferences (Observed)

- Prefers AWS for backend infrastructure
- Chose Vercel for frontend hosting (free tier)
- Chose Bedrock (Claude Haiku) over self-hosted LLM for cost reasons (~$5-10/mo vs $220-725/mo)
- Wants everything documented for r2-assistant maintenance
- Wants minimal manual AWS setup steps
- Domain: `murebbiye.org` (not yet registered)
- Budget: $10/month LLM cap
- Primary locale: Turkish (`tr`)
