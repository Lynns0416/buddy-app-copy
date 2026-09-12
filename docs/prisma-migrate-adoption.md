# Adopting Prisma Migrate

Working checklist for issue #141. Delete this file when the last box is ticked.

The reasoning, the rejected alternatives, and the current state now live in
`docs/decisions.md` ("Prisma Migrate replaces db push") and `DEPLOYMENT.md`
("Schema Changes"). This file tracks only what is left.

## Done — 2026-09-12

- [x] Baseline generated into `prisma/migrations/0_init/migration.sql`, with
      `migration_lock.toml`.
- [x] Verified `migrate diff --from-url … --to-schema-datamodel` prints no
      changes against the local database before baselining it.
- [x] `migrate resolve --applied 0_init` on the local database.
- [x] Verified `migrate deploy` builds the schema from empty on a scratch
      database, and `migrate dev --name <change>` generates and applies a new
      migration. The local `peacebuddy` role creates the shadow database without
      a `shadowDatabaseUrl`.
- [x] Dev container command (`apps/api/Dockerfile`) runs `migrate deploy`.
- [x] CI drift check: `.github/workflows/ci.yml` replays `prisma/migrations/`
      into a throwaway Postgres and fails if it differs from `schema.prisma`.
      Written but not yet observed passing — no local Docker daemon.
- [x] Docs: `DEPLOYMENT.md`, `README.md`, `docs/architecture.md`,
      `docs/deploy-plan.md`, `docs/decisions.md`. Deleted
      `memory/project_prerelease.md`.

## Left

- [ ] **Staging.** Not reachable from the dev machine, so nothing here touched
      it. In order: remap the `BuddyTier` enum with the SQL in `DEPLOYMENT.md`,
      confirm `migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel
      prisma/schema.prisma --exit-code` exits 0, and only then run
      `migrate resolve --applied` once per directory in `prisma/migrations/`.
      Baselining a database that does not match makes every later migration
      apply on a false assumption; resolving only `0_init` when later
      migrations exist makes `migrate deploy` re-apply them.
- [ ] **Where `migrate deploy` runs on release.** Deferred to the Azure
      Container Apps move (`docs/deploy-plan.md` §6), because the answer is
      host-specific and `scripts/deploy.sh` is being replaced. Until then it is
      a manual step.

## Still unverified

- `migrate resolve --applied` against Neon. Never run there.
- Staging's actual enum state and row counts.
- Whether the Neon role can create a shadow database. Only `migrate dev` needs
  one; `migrate deploy` does not.
- Other worktrees' local databases predate `prisma/migrations/`, so their
  containers will fail on start with `P3005` until each is recreated or
  baselined. `README.md` has the command.
