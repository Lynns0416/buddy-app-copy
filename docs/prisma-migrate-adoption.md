# Adopting Prisma Migrate

Working checklist. Delete this file when the last box is ticked.

## Why

`prisma db push` has no way to express *how* a change is applied. The
`BuddyTier` rename in #140 proved it: push generated a drop-and-recreate of the
enum, and the `USING` cast failed against rows still holding `senior`. A
migration file would have carried `ALTER TYPE ... ADD VALUE` plus the backfill,
written by hand, in one reviewable artifact.

Staging now holds data, so this is no longer theoretical. See `DEPLOYMENT.md`
under "Schema Changes" for the verified behaviour of `db push` against populated
tables, including the case where it silently destroys data rather than aborting.

## Ordering constraint — read before starting

The baseline captures whatever `prisma/schema.prisma` currently says, and
`migrate resolve --applied` then *asserts* that a database already has it. If
staging is still on the six-value enum when you baseline, you will mark it as
having a schema it does not have, and every later migration will apply against
a wrong assumption.

So, in this order:

1. Merge #140.
2. Remap and push staging until it matches `schema.prisma`. SQL is in `DEPLOYMENT.md`.
3. Confirm they match: `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` must print no changes.
4. Only then baseline.

## Steps

- [ ] `git switch -c chore/prisma-migrate`
- [ ] Generate the baseline:
      `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`
- [ ] Mark it applied on every existing database, local and staging:
      `prisma migrate resolve --applied 0_init`
- [ ] Commit `prisma/migrations/` including the generated `migration_lock.toml`.
- [ ] Change the dev container command at `apps/api/Dockerfile:36` from
      `prisma db push --skip-generate` to `prisma migrate deploy`.
- [ ] Decide where `migrate deploy` runs on release. `scripts/deploy.sh` applies
      no DDL today and the production image carries no Prisma CLI, so this is a
      real decision, not a rename. Options are a one-shot job before traffic, or
      keeping it manual as `db push` is now.
- [ ] Verify the loop end to end: edit `schema.prisma`, run `prisma migrate dev
      --name <something>`, confirm the file generated and applied.

## Docs to update in the same PR

- [ ] `DEPLOYMENT.md` — "Schema Changes" section, drop the pre-release framing.
- [ ] `docs/architecture.md:57-59` — says the schema is applied with `db push`.
- [ ] `docs/deploy-plan.md:284` — the checklist item this work completes.
- [ ] `memory/project_prerelease.md` — delete it, and its line in `memory/MEMORY.md`.
- [ ] `docs/decisions.md` — new entry. Record that `db push` is closed off, and
      why enum renames were the forcing case.

## Verified vs assumed

Verified in the 2026-09-12 session, against this repo:

- The local `peacebuddy` role can create and drop databases, so `migrate dev`
  needs no `shadowDatabaseUrl` for local work.
- `migrate diff` produces the expected SQL for the tier rename.
- `scripts/deploy.sh` issues no schema command, and `apps/api/Dockerfile` ships
  no Prisma CLI in the `runner` stage.
- No `prisma/migrations/` directory exists yet.

Not verified, check before relying on it:

- `migrate resolve --applied` against Neon. Never run here.
- Staging's actual enum state and row counts. Not reachable from the dev machine.
- Whether the Neon role can create the shadow database, if anyone ever runs
  `migrate dev` against staging. `migrate deploy` does not need one.
