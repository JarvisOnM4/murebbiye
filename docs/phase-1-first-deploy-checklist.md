# First Deploy Checklist (Vercel)

## 1) Repository + Project
- Push `pilot-mvp` to a Git provider.
- Create Vercel project from repository root `pilot-mvp`.
- Confirm framework preset is Next.js.

## 2) Database
- Provision PostgreSQL (Neon/Supabase/Render).
- Set `DATABASE_URL` in Vercel environment variables.
- Run `npx prisma migrate deploy` and `npx prisma generate`.

## 3) Required Environment Variables
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `APP_BASE_URL`
- `DEFAULT_LOCALE`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `QSTASH_URL`, `QSTASH_TOKEN`
- `MONTHLY_CAP_USD=10`
- `PER_LESSON_CAP_USD=0.2`
- `BUDGET_MODE_AT_80_PERCENT=short_response_low_cost_model`
- `BUDGET_MODE_AT_100_PERCENT=stop_new_generation_review_only`

## 4) Build + Runtime Checks
- Health endpoint returns `200`: `/api/health`
- Home page loads on production URL.
- CI workflow passes (`lint`, `typecheck`, `build`).

## 5) Rollback Readiness
- Keep previous successful deployment as fallback.
- Maintain a migration backup/restore plan before schema changes.
