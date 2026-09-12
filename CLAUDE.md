# Peace Buddy — Claude Context

At session start, read `docs/decisions.md` — it records why things are the way
they are, and which alternatives are already settled. Do not re-propose an
option rejected there without new information.

Source of truth for completed work is `git log`.

## Stack
- Monorepo: `apps/api` (Hono), `apps/web` (Next.js App Router + next-intl), `packages/types` (Zod)
- DB: Postgres via Prisma. All commands run in Docker.
- Auth: Firebase Auth → `__session` cookie → Hono middleware

## Patterns (never deviate)
- **API**: route → service → Prisma. Business logic in service only.
- **Prisma**: explicit `select` always. Never expose `internalNotes`, `adminMemo`. `tier` is buddy-visible on their own profile only — never another buddy's.
- **Types**: Zod schemas, enums, and all response types → `packages/types`. `apps/api/src/types.ts` holds Hono env types only (`FirebaseEnv`, `AuthEnv`, etc.) and internal API types (`ToursQuery`). HTTP transport/validation schemas → route file.
- **Enum values**: always use `SchemaName.enum.value` (e.g. `BuddyStatusSchema.enum.active`), never magic strings.
- **Zod**: validate at all system boundaries (routes). Parse, never cast.
- **i18n**: every UI string via `useTranslations`. Update `en.json` + `ja.json` together, always.
- **Tests**: Vitest, colocated `*.test.ts`. Route tests use `buildApp()` with stub auth middleware. Mock Prisma + Firebase via `vi.mock`.
- **Tests never hardcode user-facing text**: a copy edit must not break a logic test. Assert against the string resource, not a copy of it — import `messages.*.json` in `apps/api`, and in `apps/web` mock `useTranslations` to echo the key (`() => (key: string) => key`) so assertions read keys. Prefer `getByRole('button' | 'link', { name })` over `getByText` for anything interactive. Literals stay only for machine-readable values another system depends on: URLs and paths, encoding output, API error codes, and test data fixtures.
- **Commits**: few, grouped by layer. Branches are squash-merged, so granularity
  buys nothing and many small commits are unwanted — a feature branch is ~3
  commits (data model / API / UI), not 8. A follow-up fix to code written earlier
  in the same branch belongs *in* the unit that caused it, not appended as its
  own commit. Split only genuinely unrelated work. No co-author signature.
- **Web routing**: always use `routes.*` from `apps/web/src/lib/routes.ts`, never raw strings.
- **Admin tables**: all columns must be client-side sortable. Use the `SortIcon` component from `apps/web/src/components/sort-icon.tsx` with `SortField`/`SortDir`/`handleSort`/`sorted` pattern (see `admin/groups/page.tsx` for reference).
- **Diagrams**: all docs diagrams are mermaid fenced blocks (` ```mermaid `) — GitHub renders them natively. Never add ASCII art for entities, flows, or state machines. Directory trees stay plain ASCII (mermaid has no tree primitive). Pick the right type: `erDiagram` for schema, `stateDiagram-v2` for status lifecycles, `sequenceDiagram` for request/auth flows, `flowchart` for algorithms and infrastructure.

## Docs to update when implementing

Diagrams go stale silently — nothing typechecks them. When a change touches any of these, update the diagram **in the same commit as the code**:

| Change | Update |
|---|---|
| Any edit to `prisma/schema.prisma` | A migration file in `prisma/migrations/`, generated with `prisma migrate dev --name <change>` and committed with the schema edit. CI fails the branch otherwise. |
| `prisma/schema.prisma` model or relation | `docs/data-model.md` — both `erDiagram` blocks + the field table |
| Tour or booking status transition rules | `docs/PRD.md` §7.2 `stateDiagram-v2`, §8.4 matrix |
| New service, external dependency, or deploy step | `docs/architecture.md` — the relevant `flowchart` / `sequenceDiagram` |
| New or changed endpoint | `docs/api.md` |
| Notification event kind or cron job | `docs/PRD.md` §10, `docs/roadmap.md` |

Source of truth is the code — when a diagram and the schema disagree, fix the diagram.

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
- Rewrite the git tree — no `reset`, `rebase`, `--amend`, or force-push, including
  on commits made minutes ago. A wrong split gets squashed anyway; say so and
  leave it
- Hardcode UI strings
- Run commands outside Docker
- Hold decisions in memory only — update relevant docs (PRD.md, architecture.md, data-model.md, etc.) immediately when a decision is made
- Forget `docs/decisions.md` when a decision closes off an alternative — log the rejected option and why, not just the outcome
- Make excuse or correct silently without apologies. When you make a mistake and the message from user is valid, apologise. You can argue if it's not your fault, though.
