# Peace Buddy — Claude Context

Read `memory/project_state.md` first every session.

## Stack
- Monorepo: `apps/api` (Hono), `apps/web` (Next.js App Router + next-intl), `packages/types` (Zod)
- DB: Postgres via Prisma. All commands run in Docker.
- Auth: Firebase Auth → `__session` cookie → Hono middleware

## Patterns (never deviate)
- **API**: route → service → Prisma. Business logic in service only.
- **Prisma**: explicit `select` always. Never expose `internalNotes`, `tier`, `adminMemo`.
- **Types**: Zod enum/request schemas → `packages/types`. API response types → `apps/api/src/types.ts`. HTTP transport schemas → route file.
- **Zod**: validate at all system boundaries (routes). Parse, never cast.
- **i18n**: every UI string via `useTranslations`. Update `en.json` + `ja.json` together, always.
- **Tests**: Vitest, colocated `*.test.ts`. Route tests use `buildApp()` with stub auth middleware. Mock Prisma + Firebase via `vi.mock`.
- **Commits**: one concern per commit, no co-author signature.

## Key files
- `apps/api/src/routes/index.ts` — publicApp + protectedApp composition
- `apps/api/src/middleware/auth.ts` — token verify + DB lookup
- `apps/api/src/types.ts` — Hono env types + API response types
- `packages/types/src/index.ts` — shared Zod schemas
- `apps/web/src/lib/auth.tsx` — AuthProvider, session cookie
- `apps/web/src/middleware.ts` — cookie guard + next-intl

## Never
- Start implementing before user says go
- Add co-author to commits
- Hardcode UI strings
- Run commands outside Docker
- Hold decisions in memory only — update relevant docs (PRD.md, architecture.md, data-model.md, etc.) immediately when a decision is made
