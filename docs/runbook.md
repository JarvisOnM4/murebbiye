# Murebbiye Runbook

> **Audience:** r2-assistant or any operator troubleshooting Murebbiye issues.
> Each section is a self-contained procedure for a specific problem.

---

## Problem: Health endpoint returns 503 (DB unreachable)

**Symptoms:** `/api/health` returns `{"status":"degraded","db":"unreachable"}`

**Steps:**

1. Check RDS instance status:
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier murebbiye-database \
     --query 'DBInstances[0].DBInstanceStatus'
   ```

2. If status is `stopped`:
   ```bash
   aws rds start-db-instance --db-instance-identifier murebbiye-database
   ```
   Wait 5-10 minutes for the instance to become `available`.

3. If status is `available`, check security group allows inbound 5432:
   ```bash
   aws ec2 describe-security-groups \
     --group-ids <sg-id> \
     --query 'SecurityGroups[0].IpPermissions'
   ```

4. Test connectivity:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

5. If connection works from CLI but not from Vercel, check if DATABASE_URL env var is correctly set in Vercel dashboard.

---

## Problem: Bedrock returns AccessDeniedException

**Symptoms:** Lesson generation or media agent fails with AWS access denied.

**Steps:**

1. Verify model access is enabled:
   - AWS Console > Bedrock > Model access
   - Ensure `anthropic.claude-3-5-haiku-20241022-v1:0` shows "Access granted"

2. Verify IAM policy:
   ```bash
   aws iam list-attached-user-policies --user-name murebbiye-app
   aws iam list-user-policies --user-name murebbiye-app
   ```

3. Check the policy allows `bedrock:InvokeModel` on the correct model ARN.

4. Verify credentials in Vercel:
   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must match the murebbiye-app IAM user
   - AWS_REGION must be `us-east-1`

---

## Problem: S3 upload fails

**Symptoms:** Curriculum upload returns an error about S3.

**Steps:**

1. Verify S3_BUCKET_NAME is set in Vercel env vars.

2. Check bucket exists:
   ```bash
   aws s3 ls s3://murebbiye-curriculum/
   ```

3. Check IAM permissions include s3:PutObject on the bucket.

4. If bucket doesn't exist, redeploy CDK:
   ```bash
   cd infra && npx cdk deploy
   ```

---

## Problem: Budget limit reached

**Symptoms:** Students see "review only" mode, no new LLM generation.

**Steps:**

1. Check current spend:
   ```bash
   curl https://murebbiye.org/api/budget
   ```

2. If spend is near/at the monthly cap, options:
   - Wait for the next calendar month (auto-resets)
   - Increase `MONTHLY_CAP_USD` in Vercel env vars and redeploy
   - Manually clear the ledger (destructive, not recommended)

---

## Problem: Prisma migration fails

**Symptoms:** `prisma migrate deploy` errors out.

**Steps:**

1. Check migration status:
   ```bash
   npx prisma migrate status
   ```

2. If "failed" migrations exist:
   ```bash
   npx prisma migrate resolve --applied <migration_name>
   ```

3. For schema drift, reset (DESTRUCTIVE - only for dev):
   ```bash
   npx prisma migrate reset
   ```

4. For production, fix the migration SQL manually and re-run deploy.

---

## Problem: Vercel deployment fails

**Symptoms:** Build error in Vercel dashboard.

**Steps:**

1. Check Vercel build logs for the specific error.

2. Common causes:
   - Missing env var: Add it in Vercel dashboard
   - TypeScript error: Run `npm run typecheck` locally to see the error
   - Prisma generation: Ensure `buildCommand` in vercel.json includes `prisma generate`

3. Verify locally:
   ```bash
   npm run check
   ```

---

## Problem: Emails not sending

**Symptoms:** Parent summary emails stuck in QUEUED status.

**Steps:**

1. Check SMTP configuration in Vercel env vars:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

2. Test SMTP connectivity from a machine with the same credentials.

3. Check email status in database:
   ```sql
   SELECT id, status, attempts, last_error
   FROM "ParentSummaryEmail"
   WHERE status != 'SENT'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## Routine: Rotate Database Password

1. Generate new password in Secrets Manager:
   ```bash
   aws secretsmanager rotate-secret --secret-id murebbiye/db-credentials
   ```

2. Retrieve the new password:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id murebbiye/db-credentials \
     --query 'SecretString' --output text | jq -r '.password'
   ```

3. Build new DATABASE_URL and update in Vercel.

4. Redeploy: `npx vercel --prod`

---

## Routine: Monthly Cost Review

```bash
# Bedrock costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "first day of this month" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Bedrock"]}}' \
  --metrics BlendedCost

# RDS costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "first day of this month" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}' \
  --metrics BlendedCost
```

Expected: ~$18-24/month total.
