# Murebbiye Maintenance Guide

> **Audience:** r2-assistant or any operator managing Murebbiye in production.

---

## Health Monitoring

### Health endpoint

```bash
curl https://murebbiye.org/api/health
```

| Response | Meaning | Action |
|----------|---------|--------|
| `200 {"status":"ok","db":"connected"}` | All systems healthy | None |
| `503 {"status":"degraded","db":"unreachable"}` | Database unreachable | Check RDS (see Runbook) |

### Vercel dashboard

Monitor at: https://vercel.com/dashboard
- Check deployment status
- View function logs (Logs tab)
- Monitor function invocation counts and errors

---

## Database Maintenance

### Connection details

```bash
# Retrieve current DB credentials
aws secretsmanager get-secret-value \
  --secret-id murebbiye/db-credentials \
  --query 'SecretString' --output text
```

### Apply new migrations

When schema changes are pushed:

```bash
export DATABASE_URL="<connection-string>"
npx prisma migrate deploy
```

### Check migration status

```bash
npx prisma migrate status
```

### Direct DB access (for debugging)

```bash
psql "$DATABASE_URL"
```

### Backup

RDS automated backups are configured with 7-day retention.
For manual snapshots:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier murebbiye-database \
  --db-snapshot-identifier murebbiye-manual-$(date +%Y%m%d)
```

---

## Updating the Application

### Standard update flow

```bash
git pull origin main
npm install
npx prisma generate

# If there are new migrations:
DATABASE_URL="<connection-string>" npx prisma migrate deploy

# Redeploy to Vercel
npx vercel --prod
```

### Vercel auto-deploys

If the GitHub repo is connected to Vercel, pushing to `main` triggers automatic deployment. No manual steps needed.

---

## Budget Monitoring

The budget system tracks LLM costs per request.

### Check current spend

```bash
curl https://murebbiye.org/api/budget
```

### Key environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MONTHLY_CAP_USD` | Hard monthly limit | 10 |
| `PER_LESSON_CAP_USD` | Per-lesson limit | 0.2 |
| `BUDGET_MODE_AT_80_PERCENT` | Action at 80% spend | short_response_low_cost_model |
| `BUDGET_MODE_AT_100_PERCENT` | Action at 100% spend | stop_new_generation_review_only |

### Budget modes

| Mode | Behavior |
|------|----------|
| `normal` | Full generation with default model |
| `short_response_low_cost_model` | Shorter responses, cheapest model |
| `stop_new_generation_review_only` | No new LLM calls, review existing content only |

---

## AWS Infrastructure Changes

### Modify infrastructure

Edit `infra/lib/murebbiye-stack.ts`, then:

```bash
cd infra
npx cdk diff      # Preview changes
npx cdk deploy     # Apply changes
```

### Scale database

Edit `infra/lib/config.ts`:

```typescript
db: {
  instanceClass: "db.t4g.small",  // upgrade from micro
  allocatedStorage: 50,           // increase storage
}
```

Then `npx cdk deploy`.

### Rotate IAM credentials

1. Create new access key in AWS Console (IAM > Users > murebbiye-app)
2. Update Vercel env vars with new key
3. Redeploy: `npx vercel --prod`
4. Delete old access key from IAM

---

## Log Access

### Vercel function logs

```bash
npx vercel logs --follow
```

### RDS logs

```bash
aws rds describe-db-log-files --db-instance-identifier murebbiye-database
aws rds download-db-log-file-portion \
  --db-instance-identifier murebbiye-database \
  --log-file-name <log-file-name> \
  --output text
```

---

## Dependency Updates

```bash
# Check for outdated packages
npm outdated

# Update non-breaking changes
npm update

# For major version updates, update package.json manually then:
npm install

# Always run checks after updates
npm run check
npm test
```

---

## Cost Optimization

| Action | Savings |
|--------|---------|
| Use Vercel free tier | ~$20/mo |
| Keep RDS at db.t4g.micro | cheapest option |
| S3 lifecycle (IA after 90 days) | already configured |
| Bedrock pay-per-token | no idle cost |
| Stop RDS when not in use | `aws rds stop-db-instance --db-instance-identifier <id>` (restarts after 7 days) |
