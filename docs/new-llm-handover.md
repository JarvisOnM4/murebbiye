# New LLM Handover

## Current Status

- Project: `murebbiye`
- Locked phases: **1 to 7 complete**
- Canonical context file: `docs/session-context.md`
- Current open work: production DB read-only verification and release closeout checks

## First Step On New OS

1. Clone repo and open project root (`murebbiye`).
2. Ensure Node 20+ and npm/npx are available.
3. Read `docs/session-context.md` fully before doing any work.

## Prompt Command For The New LLM

Copy and paste this as your first message to the new LLM:

```text
Read `murebbiye/docs/session-context.md` as the single source of truth.
Do not redo completed phases (1-7 are complete).
Current objective: production DB read-only verification and release handoff hardening.
Use session-scoped secrets only (no writing credentials to repo files).
Run only non-destructive checks unless explicitly requested otherwise.
Update `murebbiye/docs/session-context.md` on every iteration.
Use this response format exactly:
- Phase:
- Goal:
- Changes:
- Commands:
- Test Results:
- Decision Log:
- Risks:
- Next Action:
```

## Safe Production DB Check Command (PowerShell)

```powershell
Set-Location "<repo>/murebbiye"

$env:DATABASE_URL = "postgresql://readonly_user:URLENCODED_PASSWORD@prod-host:5432/prod_db?sslmode=require"

npx prisma migrate status
npx prisma db pull --print | Out-Null

Remove-Item Env:DATABASE_URL
```

## Guardrails

- Do not run destructive DB commands (`migrate deploy`, `db push`, direct writes) for production verification.
- Prefer read-only checks first.
- Keep all iteration notes synchronized into `docs/session-context.md`.
