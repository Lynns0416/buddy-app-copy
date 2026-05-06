---
name: Pre-release state — no migration needed
description: App has never been released to prod; schema changes require no migration. DELETE THIS MEMORY once app ships to production.
type: project
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
App has never shipped to production. Schema changes are applied with `prisma db push` — never `prisma migrate dev`. Do NOT create migration files.

**Why:** No production data exists. Migration files are unnecessary overhead and unwanted.

**How to apply:** Edit schema.prisma, then run `prisma db push` (never `prisma migrate dev`). Do not create or commit migration files.

**⚠️ DELETE THIS MEMORY FILE when the app is first deployed to production.**
