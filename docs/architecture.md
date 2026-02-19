# Murebbiye Architecture

> **Audience:** r2-assistant, developers, and ops personnel maintaining this system.

---

## System Overview

Murebbiye is a bilingual (Turkish/English) AI tutoring platform. It generates personalized lessons from uploaded curriculum documents, provides an interactive student assistant, tracks learning metrics, and sends parent summary emails.

```
                 murebbiye.org (DNS via Vercel)
                        |
                   Vercel Edge
                        |
              Next.js 15 (App Router)
               /        |         \
     RDS PostgreSQL   S3 Bucket   AWS Bedrock
       (us-east-1)   (us-east-1)  (Claude Haiku)
```

---

## Component Map

| Component | Technology | Location | Purpose |
|-----------|-----------|----------|---------|
| Web App | Next.js 15, React 19, Tailwind | Vercel | UI + API routes |
| Database | PostgreSQL 16 | AWS RDS (db.t4g.micro) | All application data |
| File Storage | S3 | AWS S3 bucket | Curriculum uploads (PDF/MD) |
| LLM | Claude 3.5 Haiku | AWS Bedrock | Lesson generation, student assistant, media agent |
| Auth | NextAuth v5 (beta) | Vercel (serverless) | JWT sessions, bcrypt passwords |
| Email | Nodemailer via SMTP | External SMTP provider | Parent summary emails |
| Queue | Upstash QStash | Upstash cloud | Async job processing |
| Infra-as-Code | AWS CDK (TypeScript) | `infra/` directory | RDS + S3 + IAM provisioning |

---

## Directory Structure

```
murebbiye/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth endpoints
│   │   ├── curriculum/    # Upload, list, parse
│   │   ├── lesson/        # Generate, interact, complete
│   │   ├── budget/        # Spend tracking
│   │   ├── health/        # Health check (DB connectivity)
│   │   ├── media-agent/   # AI media enrichment
│   │   ├── performance/   # Response time metrics
│   │   ├── queue/         # QStash job processing
│   │   └── reporting/     # Parent email reports
│   ├── [locale]/          # i18n routing (tr, en)
│   └── layout.tsx         # Root layout
├── src/lib/               # Business logic (server-side only)
│   ├── auth/              # Auth config, session helpers
│   ├── budget/            # Budget tracking, cost ledger
│   ├── curriculum/        # Parser (PDF/MD), repository, types
│   ├── lesson/            # Lesson generation, interactions
│   ├── media-agent/       # AI-powered media enrichment
│   │   ├── llm.ts         # Bedrock client wrapper
│   │   └── orchestrator.ts# Media enrichment pipeline
│   ├── performance/       # Response time recording
│   ├── reporting/         # Parent email composition
│   ├── storage/           # S3 upload/download wrapper
│   ├── env.ts             # Zod-validated environment config
│   └── prisma.ts          # Prisma client singleton
├── prisma/
│   ├── schema.prisma      # Database schema (14 models)
│   ├── seed.ts            # Seed admin + student users
│   └── migrations/        # SQL migration files
├── infra/                 # AWS CDK stack
│   ├── bin/               # CDK app entry point
│   └── lib/               # Stack definition + config
├── scripts/
│   └── deploy.sh          # One-command infra deploy
├── tests/                 # Vitest test suite
├── messages/              # i18n translation files
├── docker-compose.yml     # Local dev PostgreSQL
├── vercel.json            # Vercel deployment config
└── .github/workflows/     # CI pipeline
```

---

## Database Schema (Key Models)

| Model | Purpose |
|-------|---------|
| User | Admin or Student, with bcrypt password |
| CurriculumDocument | Uploaded PDF/MD file metadata + S3 key |
| CurriculumChunk | Text chunks extracted from documents |
| Lesson | Generated lesson with timing, track, status |
| LessonInteraction | Student Q&A exchanges during a lesson |
| LessonMetricSnapshot | Accuracy, hint dependency, quality scores |
| BudgetLedger | Per-request LLM cost tracking |
| ParentSummaryEmail | Email sent to parents after lessons |
| MediaAsset | AI-generated diagrams/illustrations |
| EnrichmentJob | Media generation job status |
| PerformanceMetric | API response time records |
| QueueJob | Async job queue entries |
| SystemSetting | Key-value config store |

---

## Data Flow: Lesson Generation

```
1. Admin uploads PDF/MD → API parses → chunks stored in DB, file in S3
2. Admin creates lesson → API selects relevant chunks
3. Bedrock (Claude Haiku) generates lesson content from chunks
4. Student interacts → each Q&A stored as LessonInteraction
5. On completion → metrics snapshot calculated
6. Parent email composed and queued via SMTP
7. Budget ledger updated with LLM token costs
```

---

## Environment Variables (Critical)

| Variable | Source | Description |
|----------|--------|-------------|
| DATABASE_URL | AWS Secrets Manager | PostgreSQL connection string |
| NEXTAUTH_SECRET | Vercel env | JWT signing secret |
| AWS_ACCESS_KEY_ID | CDK output | IAM user for S3 + Bedrock |
| AWS_SECRET_ACCESS_KEY | AWS Secrets Manager | IAM secret key |
| AWS_REGION | Static | `us-east-1` |
| S3_BUCKET_NAME | CDK output | Curriculum file bucket |
| PRIMARY_MODEL_NAME | Static | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| MONTHLY_CAP_USD | Static | Budget cap (e.g., `10`) |

---

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Vercel (free tier) | $0 |
| RDS db.t4g.micro | ~$13 |
| S3 (< 1GB) | ~$0.03 |
| Bedrock (Claude Haiku) | ~$5-10 |
| **Total** | **~$18-24** |
