# Phase 1 Auth Setup Plan (for Phase 2 execution)

## Target
Implement email/password authentication with role-based routing for `admin` and `student`.

## Chosen Approach
- Use `next-auth` (Auth.js v5 beta) with Credentials provider.
- Persist users in PostgreSQL via Prisma (`User` model).
- Password storage via `bcryptjs` hash.
- Session strategy: JWT for MVP simplicity.

## Implementation Steps (Phase 2)
1. Add `src/auth.ts` with `NextAuth` config and credentials authorize function.
2. Add `/api/auth/[...nextauth]` route handler.
3. Build `/login` page with TR+EN labels.
4. Add role-aware middleware:
   - `/admin/**` -> only `ADMIN`
   - `/student/**` -> only `STUDENT`
5. Add seed utility for initial admin account.
6. Add smoke tests for login success/failure and role gating.

## Security Constraints
- No plain-text passwords.
- No optional PII beyond nickname + parent email.
- Generic error messages for failed logins.
- `NEXTAUTH_SECRET` mandatory in all environments.

## Acceptance Criteria for Phase 2
- Admin can sign in and access `/admin`.
- Student can sign in and access `/student`.
- Cross-role access is blocked.
- Session expires/refreshes correctly.
