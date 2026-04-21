# Peace Buddy — Claude Context

Every session start:
1. Read `memory/project_state.md`
2. Run `git log --oneline main..HEAD` and `git log --oneline -10 main` to check what has merged since last recorded state
3. Update `memory/project_state.md` to reflect merged branches before doing anything else

After a PR merges to main:
1. Check off completed items in `docs/TASKS.md`
2. Update the **Built** list and **Next** section in `memory/project_state.md`

## Stack
- Monorepo: `apps/api` (Hono), `apps/web` (Next.js App Router + next-intl), `packages/types` (Zod)
- DB: Postgres via Prisma. All commands run in Docker.
- Auth: Firebase Auth → `__session` cookie → Hono middleware

## Patterns (never deviate)
- **API**: route → service → Prisma. Business logic in service only.
- **Prisma**: explicit `select` always. Never expose `internalNotes`, `tier`, `adminMemo`.
- **Types**: Zod schemas, enums, and all response types → `packages/types`. `apps/api/src/types.ts` holds Hono env types only (`FirebaseEnv`, `AuthEnv`, etc.) and internal API types (`ToursQuery`). HTTP transport/validation schemas → route file.
- **Enum values**: always use `SchemaName.enum.value` (e.g. `BuddyStatusSchema.enum.active`), never magic strings.
- **Zod**: validate at all system boundaries (routes). Parse, never cast.
- **i18n**: every UI string via `useTranslations`. Update `en.json` + `ja.json` together, always.
- **Tests**: Vitest, colocated `*.test.ts`. Route tests use `buildApp()` with stub auth middleware. Mock Prisma + Firebase via `vi.mock`.
- **Commits**: one concern per commit, no co-author signature.
- **Web routing**: always use `routes.*` from `apps/web/src/lib/routes.ts`, never raw strings.

## Key files
- `apps/api/src/routes/index.ts` — publicApp + protectedApp composition
- `apps/api/src/middleware/auth.ts` — token verify + DB lookup
- `apps/api/src/types.ts` — Hono env types only (`FirebaseEnv`, `AuthEnv`, `DbUser`, `ToursQuery`)
- `packages/types/src/index.ts` — shared Zod schemas, enums, and all response types
- `apps/web/src/lib/auth.tsx` — AuthProvider, session cookie
- `apps/web/src/middleware.ts` — cookie guard + next-intl
- `apps/web/src/lib/routes.ts` — all client-side routes; always use this, never raw strings

## Never
- Start implementing before user says go
- Add co-author to commits
- Hardcode UI strings
- Run commands outside Docker
- Hold decisions in memory only — update relevant docs (PRD.md, architecture.md, data-model.md, etc.) immediately when a decision is made
- Forget to update `memory/project_state.md` after a PR merges or branch work completes
