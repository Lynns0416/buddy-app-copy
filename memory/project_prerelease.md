---
name: Pre-release state — db push, but staging now has data
description: Schema changes still go through `prisma db push`, but staging exists, so a schema change now needs a deliberate deploy-time step. Not "no migration concerns".
type: project
originSessionId: 01PhqPzggzK8jeFh3aH22mn7
---
Pre-release, so schema changes go through `prisma db push` and there is no
`prisma/migrations/`. That is a tooling choice, not a licence to skip the
question: **a staging environment exists and holds data**, so renaming or
removing anything schema-level still needs a plan.

No deploy step applies DDL. `scripts/deploy.sh` only builds and deploys images,
and the production image has no Prisma CLI. Someone runs `db push` by hand.

Do not say "no migration needed" without first checking whether the target
database holds rows that block the change.

Full verified detail, including what `db push` does when data blocks it and when
to adopt Prisma Migrate, is in `DEPLOYMENT.md` under "Schema Changes".
Delete this file on first prod deploy and switch to `prisma migrate deploy`.
