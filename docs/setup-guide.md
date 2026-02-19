# Murebbiye Setup Guide

> **Audience:** r2-assistant or any operator deploying Murebbiye from scratch.
> Follow sections in order. Each step is self-contained.

---

## Prerequisites

- AWS account with admin access
- AWS CLI v2 installed and configured (`aws configure`)
- Node.js >= 20.17.0
- Git
- A Vercel account (free tier works)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/<org>/murebbiye.git
cd murebbiye
npm install
```

---

## Step 2: Deploy AWS Infrastructure

The `infra/` directory contains an AWS CDK stack that creates:
- RDS PostgreSQL 16 (db.t4g.micro, publicly accessible, SSL enforced)
- S3 bucket for curriculum files (versioned, encrypted)
- IAM user with Bedrock + S3 permissions
- Access key stored in Secrets Manager

### 2a. Bootstrap CDK (first time only)

```bash
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

### 2b. Deploy the stack

```bash
npx cdk deploy --require-approval broadening
```

Or use the convenience script from the project root:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 2c. Collect outputs

After deploy, CDK prints outputs. Save these values:

| Output | Use |
|--------|-----|
| `DatabaseEndpoint` | Host for DATABASE_URL |
| `DatabasePort` | Port for DATABASE_URL (usually 5432) |
| `DatabaseSecretArn` | Retrieve DB password |
| `S3BucketName` | S3_BUCKET_NAME env var |
| `IamAccessKeyId` | AWS_ACCESS_KEY_ID env var |
| `IamSecretKeyArn` | Retrieve IAM secret key |

### 2d. Retrieve secrets

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

### 2e. Build DATABASE_URL

```
postgresql://murebbiye_admin:<PASSWORD>@<DatabaseEndpoint>:5432/murebbiye?schema=public&sslmode=require
```

---

## Step 3: Run Database Migrations

From the project root, with DATABASE_URL set:

```bash
export DATABASE_URL="postgresql://murebbiye_admin:<PASSWORD>@<ENDPOINT>:5432/murebbiye?schema=public&sslmode=require"
npx prisma migrate deploy
```

---

## Step 4: Seed Initial Users

```bash
export SEED_ADMIN_EMAIL="admin@murebbiye.org"
export SEED_ADMIN_PASSWORD="<STRONG_PASSWORD>"
export SEED_STUDENT_EMAIL="student@murebbiye.org"
export SEED_STUDENT_PASSWORD="<STRONG_PASSWORD>"
export SEED_STUDENT_NICKNAME="Pilot Student"
export SEED_STUDENT_PARENT_EMAIL="parent@example.com"

npx tsx prisma/seed.ts
```

---

## Step 5: Deploy to Vercel

### 5a. Link project

```bash
npx vercel link
```

### 5b. Set environment variables

In Vercel dashboard (Settings > Environment Variables), add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (from Step 2e) |
| `NEXTAUTH_SECRET` | (generate: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://murebbiye.org` |
| `APP_BASE_URL` | `https://murebbiye.org` |
| `AWS_ACCESS_KEY_ID` | (from CDK output) |
| `AWS_SECRET_ACCESS_KEY` | (from Step 2d) |
| `AWS_REGION` | `us-east-1` |
| `S3_BUCKET_NAME` | (from CDK output) |
| `PRIMARY_MODEL_PROVIDER` | `bedrock` |
| `PRIMARY_MODEL_NAME` | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| `MONTHLY_CAP_USD` | `10` |
| `PER_LESSON_CAP_USD` | `0.2` |
| `BUDGET_MODE_AT_80_PERCENT` | `short_response_low_cost_model` |
| `BUDGET_MODE_AT_100_PERCENT` | `stop_new_generation_review_only` |
| `DEFAULT_LOCALE` | `tr` |
| `UPLOAD_MAX_MB` | `20` |

### 5c. Deploy

```bash
npx vercel --prod
```

### 5d. Set custom domain

In Vercel dashboard: Settings > Domains > Add `murebbiye.org`

Update your DNS registrar with the records Vercel provides.

---

## Step 6: Enable Bedrock Model Access

In the AWS Console:
1. Go to **Amazon Bedrock** > **Model access**
2. Request access to `anthropic.claude-3-5-haiku-20241022-v1:0`
3. Wait for approval (usually instant for Haiku)

---

## Step 7: Verify Deployment

```bash
# Health check
curl https://murebbiye.org/api/health

# Expected response (200 OK):
# {"status":"ok","service":"murebbiye","db":"connected","timestamp":"..."}
```

---

## Local Development

For local development without AWS:

```bash
# Start local PostgreSQL
docker compose up -d

# Copy env file
cp .env.example .env
# Edit .env with local values

# Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev

# Seed database
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

Note: LLM features require AWS credentials even for local dev (Bedrock).
