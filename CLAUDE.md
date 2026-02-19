# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Murebbiye is a bilingual (Turkish/English) AI tutoring platform built with Next.js 15, React 19, Tailwind CSS, and Prisma ORM. It uses AWS Bedrock (Claude Haiku) for LLM, S3 for file storage, and RDS PostgreSQL for the database.

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript check (tsc --noEmit)
npm run check            # Lint + typecheck + build + prisma validate
npm test                 # Run all tests (vitest)
npm run test:watch       # Watch mode

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate:dev   # Create + apply dev migration
npm run db:migrate:deploy # Apply migrations (production)
npm run db:push          # Push schema without migration
npm run db:seed          # Seed admin + student users
npm run docker:up        # Start local PostgreSQL
npm run docker:down      # Stop local PostgreSQL

# Infrastructure
cd infra && npx cdk deploy  # Deploy AWS stack
./scripts/deploy.sh         # One-command infra deploy
```

## Architecture

- **App Router**: `app/` directory with `[locale]` for i18n (tr, en)
- **API Routes**: `app/api/` — all server endpoints (auth, curriculum, lesson, budget, health, media-agent, performance, queue, reporting)
- **Business Logic**: `src/lib/` — each domain has its own directory with `repository.ts`, `types.ts`, and optionally `service.ts`
- **LLM Client**: `src/lib/media-agent/llm.ts` wraps `@aws-sdk/client-bedrock-runtime` with `callLlm()` and `callLlmJson<T>()`
- **Storage**: `src/lib/storage/s3.ts` wraps `@aws-sdk/client-s3` with `uploadToS3()` and `downloadFromS3()`
- **Environment**: `src/lib/env.ts` uses Zod to validate all env vars at startup
- **Database**: `src/lib/prisma.ts` exports a singleton `prisma` client
- **Infrastructure**: `infra/` contains AWS CDK stack (RDS + S3 + IAM)

## Key Patterns

- All repositories use Prisma directly (no fallback persistence)
- Budget tracking via `BudgetLedger` records per LLM request
- Curriculum files are parsed into chunks (`CurriculumChunk`) for LLM context
- Performance metrics stored in DB via `PerformanceMetric` model
- NextAuth v5 beta with bcrypt passwords and JWT sessions
- The `env.ts` module eagerly parses `process.env` — all required vars must be set

## Testing

Tests are in `tests/` and `src/lib/**/__tests__/`. They use Vitest with node environment. Tests for pure functions don't require a database. Config is in `vitest.config.ts`.

## Deployment

- **Vercel**: Hosts the Next.js app. Config in `vercel.json`. Auto-deploys from `main`.
- **AWS**: RDS PostgreSQL + S3 + Bedrock + IAM. Managed via CDK in `infra/`.
- **CI**: GitHub Actions in `.github/workflows/ci.yml` runs lint, typecheck, test, build.
