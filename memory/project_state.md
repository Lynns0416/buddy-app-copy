---
name: Project state
description: Current implementation state and what was decided/built so far
type: project
---

## What's been built (as of 2026-04-18)

### Branch: `chore/first-testing`

**Scaffold (already on main):**
- pnpm monorepo: `apps/api` (Hono), `apps/web` (Next.js App Router), `packages/types` (Zod schemas)
- Prisma schema (full data model)
- Docker setup for local Postgres
- next-intl i18n (ja/en, default ja)

**Auth implementation (on current branch):**
- Firebase Auth (Google sign-in; Apple UI kept but deferred — user applying for Apple Developer nonprofit)
- `apps/api/src/types.ts` — central Hono env/variable types (FirebaseEnv, AuthEnv, SchedulerEnv, UserResponse)
- `apps/api/src/middleware/firebaseAuth.ts` — token verify only, exposes `verifyFirebaseToken` util
- `apps/api/src/middleware/auth.ts` — token verify + DB lookup, sets user on context
- `apps/api/src/middleware/schedulerAuth.ts` — scheduler secret check
- `apps/api/src/services/auth.service.ts` — upsertUser, getUser (explicit Prisma select, no admin field leakage)
- `apps/api/src/routes/auth.ts` — POST /auth/register (upsert on first login), GET /auth/me
- `apps/api/src/routes/index.ts` — publicApp (firebaseAuth only) + protectedApp (full auth) composition
- `apps/web/src/lib/auth.tsx` — AuthProvider, onIdTokenChanged, session cookie, DbUser type
- `apps/web/src/app/[locale]/login/page.tsx` — sign-in page
- `apps/web/src/app/[locale]/pending/page.tsx` — pending approval page
- `apps/web/src/middleware.ts` — cookie-based route protection + next-intl

## What's next
- Set up env files for staging (Firebase staging project already created under Google Workspace org)
- Run the app against staging Firebase to test auth end-to-end
- Set up Vitest + write unit tests for services and middleware
- Implement buddy profile routes (GET/PUT /me/profile)
- Implement tour list (GET /tours)

## Firebase setup status
- Local dev: Firebase emulator (no real project needed) — firebase.json needs to be created
- Staging: Firebase project created under Google Workspace org — env vars needed
- Prod: Not yet created — applying for Google for Nonprofits first

## Key decisions made
- Apple sign-in UI kept in code, functionality deferred (nonprofit developer program pending)
- No unit tests yet — agreed to set up Vitest after auth is tested
- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)
- `packages/types` is for Zod enum schemas only — API response types live in `apps/api/src/types.ts`
- `RegisterRequestBodySchema` stays in shared types (used by both API for validation and potentially web)
