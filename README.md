# Murebbiye

Bilingual AI tutoring platform (Turkish/English) powered by AWS Bedrock, deployed on Vercel + AWS.

Murebbiye generates personalized lessons from uploaded curriculum documents, provides an interactive student assistant, tracks learning metrics, enforces LLM budget caps, and sends parent summary emails.

---

## Architecture

```
                  murebbiye.org
                       |
                  Vercel Edge
                       |
            Next.js 15 (App Router)
             /         |          \
    RDS PostgreSQL   S3 Bucket   AWS Bedrock
      (us-east-1)   (us-east-1)  (Claude 3.5 Haiku)
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web App | Next.js 15, React 19, Tailwind CSS | UI + API routes |
| Database | PostgreSQL 16 | All application data (14 models) |
| File Storage | AWS S3 | Curriculum uploads (PDF, Markdown) |
| LLM | AWS Bedrock (Claude 3.5 Haiku) | Lesson generation, student assistant, media agent |
| Auth | NextAuth v5 | JWT sessions, bcrypt passwords |
| Email | Nodemailer (SMTP) | Parent summary emails |
| Queue | Upstash QStash | Async job processing |
| Infrastructure | AWS CDK (TypeScript) | RDS + S3 + IAM provisioning |
| CI | GitHub Actions | Lint, typecheck, test, build |

---

## Features

- **Curriculum Upload** -- Admin uploads PDF or Markdown files, which are parsed and chunked for LLM context
- **Lesson Generation** -- AI generates structured lessons (explain, guided practice, independent task phases) from curriculum chunks
- **Student Assistant** -- Interactive Q&A within lesson scope with out-of-scope detection
- **AI Media Agent** -- Two-stage pipeline (storyboard then generation) for diagrams, flowcharts, illustrations
- **Budget Tracking** -- Per-request LLM cost tracking with monthly and per-lesson caps, automatic mode degradation at 80%/100% thresholds
- **Parent Reporting** -- Automated email summaries with accuracy, hint dependency, and quality metrics
- **Bilingual** -- Full Turkish/English i18n for UI and reports
- **Performance Monitoring** -- API response time recording with median/p95 analysis

---

## Project Structure

```
murebbiye/
├── app/                         # Next.js App Router
│   ├── (admin)/admin/           # Admin dashboard panels
│   ├── (student)/student/       # Student lesson UI
│   ├── api/
│   │   ├── admin/               # Admin API routes
│   │   │   ├── budget/          #   Budget status, simulate, reset
│   │   │   ├── curriculum/      #   Upload, list, retry
│   │   │   ├── lessons/         #   Draft generation
│   │   │   ├── media-agent/     #   Enrich, generate, review assets
│   │   │   ├── performance/     #   Summary, reset
│   │   │   └── reports/         #   Parent email dispatch
│   │   ├── auth/[...nextauth]/  # NextAuth endpoints
│   │   ├── health/              # Health check (DB connectivity)
│   │   └── student/             # Student-facing API
│   │       ├── assistant/       #   AI assistant Q&A
│   │       └── lessons/         #   Complete lesson, view media
│   ├── login/                   # Login page
│   └── layout.tsx               # Root layout
├── src/
│   ├── auth.ts                  # NextAuth configuration
│   ├── config/
│   │   ├── budget.ts            # Budget configuration
│   │   └── pilot.ts             # Pilot scope constants
│   ├── lib/
│   │   ├── assistant/           # Student assistant service
│   │   ├── budget/              # Budget tracking + ledger
│   │   ├── curriculum/          # Parser (PDF/MD), repository, service
│   │   ├── env.ts               # Zod-validated environment config
│   │   ├── i18n/                # Translation helpers
│   │   ├── lesson/              # Lesson generation + templates
│   │   ├── media-agent/         # AI media enrichment pipeline
│   │   │   ├── llm.ts           # Bedrock client wrapper
│   │   │   ├── orchestrator.ts  # Storyboard-to-generation pipeline
│   │   │   └── analyzer.ts      # Content analysis for media needs
│   │   ├── performance/         # Response time metrics
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── reporting/           # Parent email composition + scoring
│   │   └── storage/s3.ts        # S3 upload/download wrapper
│   └── types/                   # Auth + vendor type declarations
├── prisma/
│   ├── schema.prisma            # Database schema (14 models, 10 enums)
│   ├── seed.ts                  # Seed admin + student users
│   └── migrations/              # SQL migration files
├── infra/                       # AWS CDK stack
│   ├── bin/                     # CDK app entry point
│   └── lib/                     # Stack definition (RDS + S3 + IAM)
├── scripts/
│   └── deploy.sh                # One-command infra deploy
├── tests/                       # Vitest test suite
├── docs/                        # Deployment + maintenance docs
├── docker-compose.yml           # Local dev PostgreSQL
├── vercel.json                  # Vercel deployment config
├── vitest.config.ts             # Test configuration
└── .github/workflows/ci.yml    # CI pipeline
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js >= 20.17.0
- Docker (for local PostgreSQL)
- AWS credentials (for Bedrock LLM features)

### Setup

```bash
# Clone
git clone https://github.com/JarvisOnM4/murebbiye.git
cd murebbiye

# Install dependencies
npm install

# Start local PostgreSQL
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# Run database migrations
npx prisma migrate dev

# Seed initial users
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

The app runs at http://localhost:3000.

Default seed credentials (configure via `.env`):
- Admin: `admin@murebbiye.local` / `ChangeMe123!`
- Student: `student@murebbiye.local` / `ChangeMe123!`

---

## Deployment

### Option A: Production (Vercel + AWS)

This is the recommended production setup. Vercel hosts the Next.js app (free tier), AWS provides the database, file storage, and LLM.

#### Step 1: Deploy AWS Infrastructure

The `infra/` directory contains an AWS CDK stack that creates:
- RDS PostgreSQL 16 (db.t4g.micro, SSL enforced)
- S3 bucket (versioned, encrypted, CORS configured)
- IAM user with Bedrock + S3 permissions
- Secrets stored in AWS Secrets Manager

```bash
# Prerequisites
npm install -g aws-cdk
aws configure  # Set up AWS credentials

# Bootstrap CDK (first time only)
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1

# Deploy
npx cdk deploy --require-approval broadening
```

Or use the convenience script from the project root:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Save the CDK outputs:

| Output | Use |
|--------|-----|
| `DatabaseEndpoint` | Host for DATABASE_URL |
| `DatabaseSecretArn` | Retrieve DB password |
| `S3BucketName` | S3_BUCKET_NAME env var |
| `IamAccessKeyId` | AWS_ACCESS_KEY_ID env var |
| `IamSecretKeyArn` | Retrieve IAM secret key |

Retrieve secrets:

```bash
# DB password
aws secretsmanager get-secret-value \
  --secret-id murebbiye/db-credentials \
  --query 'SecretString' --output text | jq -r '.password'

# IAM secret key
aws secretsmanager get-secret-value \
  --secret-id murebbiye/iam-secret-key \
  --query 'SecretString' --output text
```

#### Step 2: Enable Bedrock Model Access

1. AWS Console > **Amazon Bedrock** > **Model access**
2. Request access to `anthropic.claude-3-5-haiku-20241022-v1:0`
3. Wait for approval (usually instant)

#### Step 3: Run Database Migrations

```bash
DATABASE_URL="postgresql://murebbiye_admin:<PASSWORD>@<ENDPOINT>:5432/murebbiye?schema=public&sslmode=require" \
  npx prisma migrate deploy
```

#### Step 4: Seed Users

```bash
DATABASE_URL="<connection-string>" \
SEED_ADMIN_EMAIL="admin@murebbiye.org" \
SEED_ADMIN_PASSWORD="<STRONG_PASSWORD>" \
SEED_STUDENT_EMAIL="student@murebbiye.org" \
SEED_STUDENT_PASSWORD="<STRONG_PASSWORD>" \
SEED_STUDENT_NICKNAME="Pilot Student" \
SEED_STUDENT_PARENT_EMAIL="parent@example.com" \
  npx tsx prisma/seed.ts
```

#### Step 5: Deploy to Vercel

```bash
# Link project
npx vercel link

# Deploy
npx vercel --prod
```

Set these environment variables in Vercel dashboard (Settings > Environment Variables):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://murebbiye_admin:<PWD>@<ENDPOINT>:5432/murebbiye?schema=public&sslmode=require` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://murebbiye.org` |
| `APP_BASE_URL` | `https://murebbiye.org` |
| `AWS_ACCESS_KEY_ID` | From CDK output |
| `AWS_SECRET_ACCESS_KEY` | From Secrets Manager |
| `AWS_REGION` | `us-east-1` |
| `S3_BUCKET_NAME` | From CDK output |
| `PRIMARY_MODEL_PROVIDER` | `bedrock` |
| `PRIMARY_MODEL_NAME` | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| `MONTHLY_CAP_USD` | `10` |
| `PER_LESSON_CAP_USD` | `0.2` |
| `BUDGET_MODE_AT_80_PERCENT` | `short_response_low_cost_model` |
| `BUDGET_MODE_AT_100_PERCENT` | `stop_new_generation_review_only` |
| `DEFAULT_LOCALE` | `tr` |
| `UPLOAD_MAX_MB` | `20` |

#### Step 6: Configure Domain

In Vercel dashboard: Settings > Domains > Add `murebbiye.org`

Update your DNS registrar with the records Vercel provides (typically an A record or CNAME).

#### Step 7: Verify

```bash
curl https://murebbiye.org/api/health
# {"status":"ok","service":"murebbiye","db":"connected","timestamp":"..."}
```

---

### Option B: Local Development with Docker

For developing without AWS (LLM features will not work):

```bash
docker compose up -d          # Start PostgreSQL
cp .env.example .env          # Configure environment
npx prisma migrate dev        # Run migrations
npx tsx prisma/seed.ts        # Seed users
npm run dev                   # Start dev server
```

Note: Bedrock-dependent features (lesson generation, student assistant, media agent) require valid AWS credentials even in local dev.

---

## Environment Variables

See `.env.example` for the complete list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `NEXTAUTH_URL` | Yes | Application URL |
| `APP_BASE_URL` | Yes | Application URL (same as NEXTAUTH_URL) |
| `AWS_ACCESS_KEY_ID` | Yes | IAM credentials for S3 + Bedrock |
| `AWS_SECRET_ACCESS_KEY` | Yes | IAM credentials for S3 + Bedrock |
| `AWS_REGION` | No | Default: `us-east-1` |
| `S3_BUCKET_NAME` | Yes | Curriculum file bucket |
| `PRIMARY_MODEL_NAME` | No | Default: `anthropic.claude-3-5-haiku-20241022-v1:0` |
| `MONTHLY_CAP_USD` | Yes | Monthly LLM budget cap |
| `PER_LESSON_CAP_USD` | Yes | Per-lesson LLM budget cap |
| `DEFAULT_LOCALE` | No | Default: `tr` (Turkish) |
| `SMTP_HOST` | No | SMTP server for parent emails |
| `AUTH_ALLOW_ENV_FALLBACK` | No | Allow seed user login without DB (dev only) |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm run check` | Lint + typecheck + build + prisma validate |
| `npm test` | Run test suite (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate:dev` | Create and apply dev migration |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:push` | Push schema without migration file |
| `npm run db:seed` | Seed admin + student users |
| `npm run docker:up` | Start local PostgreSQL container |
| `npm run docker:down` | Stop local PostgreSQL container |

---

## Database

### Schema Overview

14 models across the following domains:

| Model | Purpose |
|-------|---------|
| `User` | Admin or Student with bcrypt password |
| `CurriculumDocument` | Uploaded PDF/MD metadata + S3 storage key |
| `CurriculumChunk` | Text chunks extracted from documents |
| `Lesson` | Generated lesson with timing and track |
| `LessonInteraction` | Student Q&A exchanges |
| `LessonMetricSnapshot` | Accuracy, hint dependency, quality scores |
| `BudgetLedger` | Per-request LLM cost tracking |
| `ParentSummaryEmail` | Email sent to parents after lessons |
| `MediaAsset` | AI-generated diagrams/illustrations |
| `EnrichmentJob` | Media generation job status |
| `PerformanceMetric` | API response time records |
| `QueueJob` | Async job queue entries |
| `SystemSetting` | Key-value config store |

### Migrations

```bash
# Create new migration (development)
npx prisma migrate dev --name <migration_name>

# Apply migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

---

## Testing

88 tests across 10 test files using Vitest.

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

Tests cover: environment validation, curriculum parser, LLM cost computation, budget service logic, and performance metrics. All tests are pure-function unit tests that run without a database or AWS credentials.

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and on pull requests:

1. Install dependencies (`npm ci`)
2. Generate Prisma client
3. Validate Prisma schema
4. Lint (`next lint`)
5. Type check (`tsc --noEmit`)
6. Test (`vitest run`)
7. Build (`next build`)

Vercel auto-deploys from `main` when the GitHub repo is connected.

---

## Budget System

The budget system tracks LLM costs per request and enforces caps:

| Threshold | Mode | Behavior |
|-----------|------|----------|
| 0-79% | `normal` | Full generation, default model |
| 80-99% | `short_response_low_cost_model` | Shorter responses, cheapest model |
| 100%+ | `stop_new_generation_review_only` | No new LLM calls, review only |

Caps reset at the start of each calendar month.

---

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Vercel (free tier) | $0 |
| RDS db.t4g.micro | ~$13 |
| S3 (< 1GB) | ~$0.03 |
| Bedrock (Claude Haiku, pay-per-token) | ~$5-10 |
| **Total** | **~$18-24** |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System architecture and component map |
| [docs/setup-guide.md](docs/setup-guide.md) | Step-by-step deployment guide |
| [docs/maintenance-guide.md](docs/maintenance-guide.md) | Production maintenance procedures |
| [docs/runbook.md](docs/runbook.md) | Troubleshooting procedures for common issues |

---

## License

Private project.
